-- Migration: Update place_order_atomic and place_order_direct to save courier & service_type
-- Date: 2026-07-11

-- 1. Redefine place_order_atomic to save courier and service_type
CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_user_id       UUID,
  p_address_id    UUID,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_courier       TEXT    DEFAULT NULL,
  p_service_type  TEXT    DEFAULT NULL,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_address       RECORD;
  v_cart_item     RECORD;
  v_product       RECORD;
  v_order_id      UUID;
  v_order_number  TEXT;
  v_subtotal      NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_item_count    INT := 0;
BEGIN
  -- 1. Validate address belongs to user
  SELECT id, recipient_name, phone,
         COALESCE(address_line1, '') || ' ' || COALESCE(address_line2, '') AS full_address
  INTO v_address
  FROM user_addresses
  WHERE id = p_address_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Address not found or does not belong to this user';
  END IF;

  -- 2. Validate cart is not empty
  SELECT COUNT(*) INTO v_item_count
  FROM shopping_carts
  WHERE user_id = p_user_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- 3. Generate order number (UT-YYYYMMDD-RANDOM)
  v_order_number := 'UT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                    UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));

  -- 4. Create the order record (Saving courier & service_type)
  INSERT INTO orders (
    id, order_number, user_id, status, payment_status,
    shipping_address_id, shipping_recipient_name, shipping_phone, shipping_address,
    subtotal, shipping_cost, total_amount, payment_method,
    courier, service_type,
    expires_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_order_number,
    p_user_id,
    'awaiting_payment_method',
    'unpaid',
    p_address_id,
    v_address.recipient_name,
    v_address.phone,
    v_address.full_address,
    0,  -- will update after iterating items
    COALESCE(p_shipping_cost, 0),
    0,  -- will update after iterating items
    NULL,
    p_courier,
    p_service_type,
    p_expires_at,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 5. Iterate cart items: lock product row, validate stock, create order_item, decrement stock
  FOR v_cart_item IN
    SELECT sc.product_id, sc.quantity
    FROM shopping_carts sc
    WHERE sc.user_id = p_user_id
  LOOP
    -- Lock the product row to prevent concurrent stock modifications
    SELECT id, name, price, stock_quantity, is_available
    INTO v_product
    FROM products
    WHERE id = v_cart_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_cart_item.product_id;
    END IF;

    IF NOT v_product.is_available THEN
      RAISE EXCEPTION 'Product "%" is not available', v_product.name;
    END IF;

    IF v_product.stock_quantity < v_cart_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %',
        v_product.name, v_cart_item.quantity, v_product.stock_quantity;
    END IF;

    -- Insert order item (snapshot product name & price)
    INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
    VALUES (
      v_order_id,
      v_cart_item.product_id,
      v_product.name,
      v_product.price,
      v_cart_item.quantity,
      v_product.price * v_cart_item.quantity
    );

    -- Decrement stock
    UPDATE products
    SET stock_quantity = stock_quantity - v_cart_item.quantity
    WHERE id = v_cart_item.product_id;

    v_subtotal := v_subtotal + (v_product.price * v_cart_item.quantity);
  END LOOP;

  -- 6. Update order totals
  v_total := v_subtotal + COALESCE(p_shipping_cost, 0);

  UPDATE orders
  SET subtotal     = v_subtotal,
      total_amount = v_total
  WHERE id = v_order_id;

  -- 7. Clear the user's cart
  DELETE FROM shopping_carts WHERE user_id = p_user_id;

  -- 8. Return result
  RETURN jsonb_build_object(
    'success',      TRUE,
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'order', jsonb_build_object(
      'id',           v_order_id,
      'order_number', v_order_number,
      'subtotal',     v_subtotal,
      'shipping_cost', COALESCE(p_shipping_cost, 0),
      'total_amount', v_total,
      'status',       'awaiting_payment_method'
    )
  );
END;
$$;


-- 2. Redefine place_order_direct to save courier and service_type
CREATE OR REPLACE FUNCTION public.place_order_direct(
  p_user_id       UUID,
  p_address_id    UUID,
  p_items         JSONB,
  p_shipping_cost NUMERIC DEFAULT 0,
  p_courier       TEXT    DEFAULT NULL,
  p_service_type  TEXT    DEFAULT NULL,
  p_expires_at    TIMESTAMPTZ DEFAULT NULL,
  p_payment_method TEXT    DEFAULT NULL,
  p_amount_paid   NUMERIC DEFAULT 0,
  p_customer_info JSONB   DEFAULT NULL,
  p_is_offline    BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_address       RECORD;
  v_product       RECORD;
  v_item          JSONB;
  v_product_id    UUID;
  v_quantity      INT;
  v_order_id      UUID;
  v_order_number  TEXT;
  v_subtotal      NUMERIC := 0;
  v_total         NUMERIC := 0;
  v_payment_status TEXT;
  v_status        TEXT;
  v_customer_name VARCHAR(100);
  v_customer_phone VARCHAR(20);
  v_full_address  TEXT;
BEGIN
  -- 1. Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items cannot be empty';
  END IF;

  -- 2. Differentiate between Offline POS and Online Direct checkout
  IF p_is_offline THEN
    -- Offline POS flow
    IF p_payment_method NOT IN ('cash', 'card', 'qris', 'bank_transfer') THEN
      RAISE EXCEPTION 'Invalid payment method for offline order. Must be "cash", "card", "qris" or "bank_transfer"';
    END IF;

    IF p_amount_paid IS NULL OR p_amount_paid < 0 THEN
      RAISE EXCEPTION 'Amount paid must be a positive number';
    END IF;

    v_customer_name := COALESCE(p_customer_info ->> 'name', 'Customer');
    v_customer_phone := COALESCE(p_customer_info ->> 'phone', '-');
    v_full_address := 'POS Offline Transaction';

    IF p_payment_method = 'cash' THEN
      v_payment_status := 'paid';
      v_status := 'processing';
    ELSE
      v_payment_status := 'unpaid';
      v_status := 'awaiting_payment_method';
    END IF;
  ELSE
    -- Online Direct checkout flow
    SELECT id, recipient_name, phone,
           COALESCE(address_line1, '') || ' ' || COALESCE(address_line2, '') AS full_address
    INTO v_address
    FROM user_addresses
    WHERE id = p_address_id AND user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Address not found or does not belong to this user';
    END IF;

    v_customer_name := v_address.recipient_name;
    v_customer_phone := v_address.phone;
    v_full_address := v_address.full_address;
    v_payment_status := 'unpaid';
    v_status := 'awaiting_payment_method';
  END IF;

  -- 3. Generate order number
  v_order_number := 'UT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                    UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));

  -- 4. Create the order record (Saving courier & service_type)
  INSERT INTO orders (
    id, order_number, user_id, status, payment_status,
    shipping_address_id, shipping_recipient_name, shipping_phone, shipping_address,
    subtotal, shipping_cost, total_amount, payment_method,
    courier, service_type,
    expires_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_order_number,
    p_user_id, -- Admin UUID for offline, Customer UUID for online
    v_status,
    v_payment_status,
    CASE WHEN p_is_offline THEN NULL ELSE p_address_id END,
    v_customer_name,
    v_customer_phone,
    v_full_address,
    0, -- will update later
    COALESCE(p_shipping_cost, 0),
    0, -- will update later
    CASE WHEN p_is_offline THEN p_payment_method ELSE NULL END,
    p_courier,
    p_service_type,
    p_expires_at,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- 5. Iterate items: lock product, validate stock, create order_item, decrement stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;
    v_quantity   := (v_item ->> 'quantity')::INT;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;

    -- Lock the product row
    SELECT id, name, price, stock_quantity, is_available
    INTO v_product
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF NOT v_product.is_available THEN
      RAISE EXCEPTION 'Product "%" is not available', v_product.name;
    END IF;

    IF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %',
        v_product.name, v_quantity, v_product.stock_quantity;
    END IF;

    -- Insert order item
    INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
    VALUES (
      v_order_id,
      v_product_id,
      v_product.name,
      v_product.price,
      v_quantity,
      v_product.price * v_quantity
    );

    -- Decrement stock
    UPDATE products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product_id;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  END LOOP;

  -- 6. Update order totals
  v_total := v_subtotal + COALESCE(p_shipping_cost, 0);

  UPDATE orders
  SET subtotal     = v_subtotal,
      total_amount = v_total
  WHERE id = v_order_id;

  -- 7. Return result
  RETURN jsonb_build_object(
    'success', TRUE,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total,
    'subtotal', v_subtotal,
    'payment_method', COALESCE(p_payment_method, ''),
    'payment_status', v_payment_status,
    'status', v_status,
    'amount_paid', CASE WHEN p_is_offline THEN p_amount_paid ELSE 0 END,
    'change', CASE 
      WHEN p_is_offline AND p_payment_method = 'cash' THEN p_amount_paid - v_total 
      ELSE 0 
    END
  );
END;
$$;
