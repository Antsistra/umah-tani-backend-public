-- 006_create_shopping_carts_table.sql
-- Shopping cart untuk customer (authenticated via Supabase Auth)

CREATE TABLE shopping_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        UNIQUE (user_id, product_id)
);

-- Indexes
CREATE INDEX idx_shopping_carts_user_id ON shopping_carts (user_id);

CREATE INDEX idx_shopping_carts_product_id ON shopping_carts (product_id);

COMMENT ON
TABLE shopping_carts IS 'Keranjang belanja customer, user_id merujuk ke auth.users.id (Supabase Auth)';