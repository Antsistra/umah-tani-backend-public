drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";

create type "public"."cart_status" as enum ('active', 'ordered', 'abandoned');

create type "public"."product_status" as enum ('draft', 'active', 'archived');


  create table "public"."activity_logs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "action" character varying(50) not null,
    "module" character varying(30) not null,
    "entity_type" character varying(50),
    "entity_id" uuid,
    "entity_name" text,
    "description" text,
    "metadata" jsonb,
    "ip_address" inet,
    "user_agent" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."activity_logs" enable row level security;


  create table "public"."aturan_rekomendasi" (
    "id" uuid not null default gen_random_uuid(),
    "tanaman_id" uuid not null,
    "varietas_id" uuid,
    "hst_min" integer not null,
    "hst_max" integer not null,
    "label_opsi" character varying(20) not null,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."blog_articles" (
    "id" uuid not null default gen_random_uuid(),
    "title" character varying(500) not null,
    "slug" character varying(500) not null,
    "excerpt" text,
    "content" text not null,
    "featured_image_url" character varying(500),
    "category_id" uuid,
    "author_name" character varying(255) default 'Admin'::character varying,
    "is_published" boolean default false,
    "is_featured" boolean default false,
    "published_at" timestamp without time zone,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table "public"."blog_categories" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(255) not null,
    "slug" character varying(255) not null,
    "description" text,
    "icon_url" character varying(500),
    "is_active" boolean default true,
    "created_at" timestamp without time zone default now(),
    "updated_at" timestamp without time zone default now()
      );



  create table "public"."detail_rekomendasi" (
    "id" uuid not null default gen_random_uuid(),
    "aturan_id" uuid not null,
    "pupuk_id" uuid not null,
    "dosis_per_ha" numeric(10,2) not null,
    "keterangan" text,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."product_categories" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" character varying(100) not null,
    "slug" character varying(120) not null,
    "description" text,
    "image_url" character varying(500),
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."products" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "category_id" uuid,
    "name" character varying(200) not null,
    "slug" character varying(220) not null,
    "description" text,
    "price" numeric(12,2) not null,
    "stock_quantity" integer not null default 0,
    "unit" character varying(50) not null default 'pcs'::character varying,
    "weight_gram" integer,
    "image_url" character varying(500),
    "is_available" boolean default true,
    "min_order_quantity" integer default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."profiles" (
    "id" uuid not null,
    "name" text,
    "email" text,
    "role" text default 'owner'::text,
    "avatar_url" text,
    "created_at" timestamp with time zone default now(),
    "status" text not null default 'Aktif'::text
      );



  create table "public"."pupuk" (
    "id" uuid not null default gen_random_uuid(),
    "nama" character varying(100) not null,
    "satuan" character varying(20) not null default 'kg'::character varying,
    "deskripsi" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."shopping_carts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "product_id" uuid not null,
    "quantity" integer not null default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."tanaman" (
    "id" uuid not null default gen_random_uuid(),
    "nama" character varying(100) not null,
    "deskripsi" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );



  create table "public"."varietas" (
    "id" uuid not null default gen_random_uuid(),
    "tanaman_id" uuid not null,
    "nama" character varying(100) not null,
    "deskripsi" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id);

CREATE UNIQUE INDEX aturan_rekomendasi_pkey ON public.aturan_rekomendasi USING btree (id);

CREATE UNIQUE INDEX blog_articles_pkey ON public.blog_articles USING btree (id);

CREATE UNIQUE INDEX blog_articles_slug_key ON public.blog_articles USING btree (slug);

CREATE UNIQUE INDEX blog_categories_pkey ON public.blog_categories USING btree (id);

CREATE UNIQUE INDEX blog_categories_slug_key ON public.blog_categories USING btree (slug);

CREATE UNIQUE INDEX detail_rekomendasi_aturan_id_pupuk_id_key ON public.detail_rekomendasi USING btree (aturan_id, pupuk_id);

CREATE UNIQUE INDEX detail_rekomendasi_pkey ON public.detail_rekomendasi USING btree (id);

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);

CREATE INDEX idx_activity_logs_action_module ON public.activity_logs USING btree (action, module);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id) WHERE (entity_id IS NOT NULL);

CREATE INDEX idx_activity_logs_module ON public.activity_logs USING btree (module);

CREATE INDEX idx_activity_logs_module_date ON public.activity_logs USING btree (module, created_at DESC);

CREATE INDEX idx_activity_logs_user_date ON public.activity_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);

CREATE INDEX idx_aturan_fc_lookup ON public.aturan_rekomendasi USING btree (tanaman_id, varietas_id, hst_min, hst_max);

CREATE INDEX idx_aturan_label_opsi ON public.aturan_rekomendasi USING btree (label_opsi);

CREATE INDEX idx_aturan_tanaman_id ON public.aturan_rekomendasi USING btree (tanaman_id);

CREATE INDEX idx_aturan_varietas_id ON public.aturan_rekomendasi USING btree (varietas_id);

CREATE INDEX idx_blog_articles_category ON public.blog_articles USING btree (category_id);

CREATE INDEX idx_blog_articles_featured ON public.blog_articles USING btree (is_featured);

CREATE INDEX idx_blog_articles_published ON public.blog_articles USING btree (is_published);

CREATE INDEX idx_blog_articles_published_at ON public.blog_articles USING btree (published_at);

CREATE INDEX idx_blog_articles_published_category ON public.blog_articles USING btree (is_published, category_id);

CREATE INDEX idx_blog_articles_slug ON public.blog_articles USING btree (slug);

CREATE INDEX idx_blog_categories_active ON public.blog_categories USING btree (is_active);

CREATE INDEX idx_blog_categories_slug ON public.blog_categories USING btree (slug);

CREATE INDEX idx_detail_rekomendasi_aturan_id ON public.detail_rekomendasi USING btree (aturan_id);

CREATE INDEX idx_detail_rekomendasi_pupuk_id ON public.detail_rekomendasi USING btree (pupuk_id);

CREATE INDEX idx_product_categories_is_active ON public.product_categories USING btree (is_active);

CREATE INDEX idx_product_categories_name ON public.product_categories USING btree (name);

CREATE INDEX idx_product_categories_slug ON public.product_categories USING btree (slug);

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);

CREATE INDEX idx_products_is_available ON public.products USING btree (is_available);

CREATE INDEX idx_products_name ON public.products USING gin (to_tsvector('indonesian'::regconfig, (name)::text));

CREATE INDEX idx_products_price ON public.products USING btree (price);

CREATE INDEX idx_products_slug ON public.products USING btree (slug);

CREATE INDEX idx_products_stock ON public.products USING btree (stock_quantity);

CREATE INDEX idx_pupuk_nama ON public.pupuk USING btree (nama);

CREATE INDEX idx_shopping_carts_product_id ON public.shopping_carts USING btree (product_id);

CREATE INDEX idx_shopping_carts_user_id ON public.shopping_carts USING btree (user_id);

CREATE INDEX idx_tanaman_nama ON public.tanaman USING btree (nama);

CREATE INDEX idx_varietas_nama ON public.varietas USING btree (nama);

CREATE INDEX idx_varietas_tanaman_id ON public.varietas USING btree (tanaman_id);

CREATE UNIQUE INDEX product_categories_name_key ON public.product_categories USING btree (name);

CREATE UNIQUE INDEX product_categories_pkey ON public.product_categories USING btree (id);

CREATE UNIQUE INDEX product_categories_slug_key ON public.product_categories USING btree (slug);

CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);

CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX pupuk_nama_key ON public.pupuk USING btree (nama);

CREATE UNIQUE INDEX pupuk_pkey ON public.pupuk USING btree (id);

CREATE UNIQUE INDEX shopping_carts_pkey ON public.shopping_carts USING btree (id);

CREATE UNIQUE INDEX shopping_carts_user_id_product_id_key ON public.shopping_carts USING btree (user_id, product_id);

CREATE UNIQUE INDEX tanaman_nama_key ON public.tanaman USING btree (nama);

CREATE UNIQUE INDEX tanaman_pkey ON public.tanaman USING btree (id);

CREATE UNIQUE INDEX varietas_pkey ON public.varietas USING btree (id);

CREATE UNIQUE INDEX varietas_tanaman_id_nama_key ON public.varietas USING btree (tanaman_id, nama);

alter table "public"."activity_logs" add constraint "activity_logs_pkey" PRIMARY KEY using index "activity_logs_pkey";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_pkey" PRIMARY KEY using index "aturan_rekomendasi_pkey";

alter table "public"."blog_articles" add constraint "blog_articles_pkey" PRIMARY KEY using index "blog_articles_pkey";

alter table "public"."blog_categories" add constraint "blog_categories_pkey" PRIMARY KEY using index "blog_categories_pkey";

alter table "public"."detail_rekomendasi" add constraint "detail_rekomendasi_pkey" PRIMARY KEY using index "detail_rekomendasi_pkey";

alter table "public"."product_categories" add constraint "product_categories_pkey" PRIMARY KEY using index "product_categories_pkey";

alter table "public"."products" add constraint "products_pkey" PRIMARY KEY using index "products_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."pupuk" add constraint "pupuk_pkey" PRIMARY KEY using index "pupuk_pkey";

alter table "public"."shopping_carts" add constraint "shopping_carts_pkey" PRIMARY KEY using index "shopping_carts_pkey";

alter table "public"."tanaman" add constraint "tanaman_pkey" PRIMARY KEY using index "tanaman_pkey";

alter table "public"."varietas" add constraint "varietas_pkey" PRIMARY KEY using index "varietas_pkey";

alter table "public"."activity_logs" add constraint "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_user_id_fkey";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_hst_max_check" CHECK ((hst_max >= 0)) not valid;

alter table "public"."aturan_rekomendasi" validate constraint "aturan_rekomendasi_hst_max_check";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_hst_min_check" CHECK ((hst_min >= 0)) not valid;

alter table "public"."aturan_rekomendasi" validate constraint "aturan_rekomendasi_hst_min_check";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_label_opsi_check" CHECK (((label_opsi)::text = ANY ((ARRAY['ekonomis'::character varying, 'standar'::character varying, 'lengkap'::character varying])::text[]))) not valid;

alter table "public"."aturan_rekomendasi" validate constraint "aturan_rekomendasi_label_opsi_check";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_tanaman_id_fkey" FOREIGN KEY (tanaman_id) REFERENCES public.tanaman(id) ON DELETE CASCADE not valid;

alter table "public"."aturan_rekomendasi" validate constraint "aturan_rekomendasi_tanaman_id_fkey";

alter table "public"."aturan_rekomendasi" add constraint "aturan_rekomendasi_varietas_id_fkey" FOREIGN KEY (varietas_id) REFERENCES public.varietas(id) ON DELETE SET NULL not valid;

alter table "public"."aturan_rekomendasi" validate constraint "aturan_rekomendasi_varietas_id_fkey";

alter table "public"."aturan_rekomendasi" add constraint "hst_range_valid" CHECK ((hst_max >= hst_min)) not valid;

alter table "public"."aturan_rekomendasi" validate constraint "hst_range_valid";

alter table "public"."blog_articles" add constraint "blog_articles_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL not valid;

alter table "public"."blog_articles" validate constraint "blog_articles_category_id_fkey";

alter table "public"."blog_articles" add constraint "blog_articles_slug_key" UNIQUE using index "blog_articles_slug_key";

alter table "public"."blog_categories" add constraint "blog_categories_slug_key" UNIQUE using index "blog_categories_slug_key";

alter table "public"."detail_rekomendasi" add constraint "detail_rekomendasi_aturan_id_fkey" FOREIGN KEY (aturan_id) REFERENCES public.aturan_rekomendasi(id) ON DELETE CASCADE not valid;

alter table "public"."detail_rekomendasi" validate constraint "detail_rekomendasi_aturan_id_fkey";

alter table "public"."detail_rekomendasi" add constraint "detail_rekomendasi_aturan_id_pupuk_id_key" UNIQUE using index "detail_rekomendasi_aturan_id_pupuk_id_key";

alter table "public"."detail_rekomendasi" add constraint "detail_rekomendasi_dosis_per_ha_check" CHECK ((dosis_per_ha > (0)::numeric)) not valid;

alter table "public"."detail_rekomendasi" validate constraint "detail_rekomendasi_dosis_per_ha_check";

alter table "public"."detail_rekomendasi" add constraint "detail_rekomendasi_pupuk_id_fkey" FOREIGN KEY (pupuk_id) REFERENCES public.pupuk(id) ON DELETE CASCADE not valid;

alter table "public"."detail_rekomendasi" validate constraint "detail_rekomendasi_pupuk_id_fkey";

alter table "public"."product_categories" add constraint "product_categories_name_key" UNIQUE using index "product_categories_name_key";

alter table "public"."product_categories" add constraint "product_categories_slug_key" UNIQUE using index "product_categories_slug_key";

alter table "public"."products" add constraint "products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL not valid;

alter table "public"."products" validate constraint "products_category_id_fkey";

alter table "public"."products" add constraint "products_min_order_quantity_check" CHECK ((min_order_quantity > 0)) not valid;

alter table "public"."products" validate constraint "products_min_order_quantity_check";

alter table "public"."products" add constraint "products_price_check" CHECK ((price >= (0)::numeric)) not valid;

alter table "public"."products" validate constraint "products_price_check";

alter table "public"."products" add constraint "products_slug_key" UNIQUE using index "products_slug_key";

alter table "public"."products" add constraint "products_stock_quantity_check" CHECK ((stock_quantity >= 0)) not valid;

alter table "public"."products" validate constraint "products_stock_quantity_check";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."pupuk" add constraint "pupuk_nama_key" UNIQUE using index "pupuk_nama_key";

alter table "public"."shopping_carts" add constraint "shopping_carts_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE not valid;

alter table "public"."shopping_carts" validate constraint "shopping_carts_product_id_fkey";

alter table "public"."shopping_carts" add constraint "shopping_carts_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."shopping_carts" validate constraint "shopping_carts_quantity_check";

alter table "public"."shopping_carts" add constraint "shopping_carts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."shopping_carts" validate constraint "shopping_carts_user_id_fkey";

alter table "public"."shopping_carts" add constraint "shopping_carts_user_id_product_id_key" UNIQUE using index "shopping_carts_user_id_product_id_key";

alter table "public"."tanaman" add constraint "tanaman_nama_key" UNIQUE using index "tanaman_nama_key";

alter table "public"."varietas" add constraint "varietas_tanaman_id_fkey" FOREIGN KEY (tanaman_id) REFERENCES public.tanaman(id) ON DELETE CASCADE not valid;

alter table "public"."varietas" validate constraint "varietas_tanaman_id_fkey";

alter table "public"."varietas" add constraint "varietas_tanaman_id_nama_key" UNIQUE using index "varietas_tanaman_id_nama_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'customer');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_published_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- If is_published is being changed to true and published_at is null
    IF NEW.is_published = true AND OLD.is_published = false AND NEW.published_at IS NULL THEN
        NEW.published_at = NOW();
    -- If is_published is being changed to false, clear published_at
    ELSIF NEW.is_published = false AND OLD.is_published = true THEN
        NEW.published_at = NULL;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_cart_activity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update public.carts
     set last_activity_at = now(),
         updated_at = now()
   where id = coalesce(new.cart_id, old.cart_id);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_activity_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

create or replace view "public"."v_activity_logs_with_users" as  SELECT al.id,
    al.user_id,
    al.action,
    al.module,
    al.entity_type,
    al.entity_id,
    al.entity_name,
    al.description,
    al.metadata,
    al.ip_address,
    al.user_agent,
    al.created_at,
    al.updated_at,
    u.email AS user_email,
    (u.raw_user_meta_data ->> 'name'::text) AS user_name,
    (u.raw_user_meta_data ->> 'role'::text) AS user_role,
    u.created_at AS user_created_at
   FROM (public.activity_logs al
     JOIN auth.users u ON ((al.user_id = u.id)))
  ORDER BY al.created_at DESC;


create or replace view "public"."v_daily_activity_summary" as  SELECT date(created_at) AS activity_date,
    module,
    action,
    count(*) AS total_activities,
    count(DISTINCT user_id) AS unique_users
   FROM public.activity_logs
  GROUP BY (date(created_at)), module, action
  ORDER BY (date(created_at)) DESC, (count(*)) DESC;


grant delete on table "public"."activity_logs" to "anon";

grant insert on table "public"."activity_logs" to "anon";

grant references on table "public"."activity_logs" to "anon";

grant select on table "public"."activity_logs" to "anon";

grant trigger on table "public"."activity_logs" to "anon";

grant truncate on table "public"."activity_logs" to "anon";

grant update on table "public"."activity_logs" to "anon";

grant delete on table "public"."activity_logs" to "authenticated";

grant insert on table "public"."activity_logs" to "authenticated";

grant references on table "public"."activity_logs" to "authenticated";

grant select on table "public"."activity_logs" to "authenticated";

grant trigger on table "public"."activity_logs" to "authenticated";

grant truncate on table "public"."activity_logs" to "authenticated";

grant update on table "public"."activity_logs" to "authenticated";

grant delete on table "public"."activity_logs" to "service_role";

grant insert on table "public"."activity_logs" to "service_role";

grant references on table "public"."activity_logs" to "service_role";

grant select on table "public"."activity_logs" to "service_role";

grant trigger on table "public"."activity_logs" to "service_role";

grant truncate on table "public"."activity_logs" to "service_role";

grant update on table "public"."activity_logs" to "service_role";

grant delete on table "public"."aturan_rekomendasi" to "anon";

grant insert on table "public"."aturan_rekomendasi" to "anon";

grant references on table "public"."aturan_rekomendasi" to "anon";

grant select on table "public"."aturan_rekomendasi" to "anon";

grant trigger on table "public"."aturan_rekomendasi" to "anon";

grant truncate on table "public"."aturan_rekomendasi" to "anon";

grant update on table "public"."aturan_rekomendasi" to "anon";

grant delete on table "public"."aturan_rekomendasi" to "authenticated";

grant insert on table "public"."aturan_rekomendasi" to "authenticated";

grant references on table "public"."aturan_rekomendasi" to "authenticated";

grant select on table "public"."aturan_rekomendasi" to "authenticated";

grant trigger on table "public"."aturan_rekomendasi" to "authenticated";

grant truncate on table "public"."aturan_rekomendasi" to "authenticated";

grant update on table "public"."aturan_rekomendasi" to "authenticated";

grant delete on table "public"."aturan_rekomendasi" to "service_role";

grant insert on table "public"."aturan_rekomendasi" to "service_role";

grant references on table "public"."aturan_rekomendasi" to "service_role";

grant select on table "public"."aturan_rekomendasi" to "service_role";

grant trigger on table "public"."aturan_rekomendasi" to "service_role";

grant truncate on table "public"."aturan_rekomendasi" to "service_role";

grant update on table "public"."aturan_rekomendasi" to "service_role";

grant delete on table "public"."blog_articles" to "anon";

grant insert on table "public"."blog_articles" to "anon";

grant references on table "public"."blog_articles" to "anon";

grant select on table "public"."blog_articles" to "anon";

grant trigger on table "public"."blog_articles" to "anon";

grant truncate on table "public"."blog_articles" to "anon";

grant update on table "public"."blog_articles" to "anon";

grant delete on table "public"."blog_articles" to "authenticated";

grant insert on table "public"."blog_articles" to "authenticated";

grant references on table "public"."blog_articles" to "authenticated";

grant select on table "public"."blog_articles" to "authenticated";

grant trigger on table "public"."blog_articles" to "authenticated";

grant truncate on table "public"."blog_articles" to "authenticated";

grant update on table "public"."blog_articles" to "authenticated";

grant delete on table "public"."blog_articles" to "service_role";

grant insert on table "public"."blog_articles" to "service_role";

grant references on table "public"."blog_articles" to "service_role";

grant select on table "public"."blog_articles" to "service_role";

grant trigger on table "public"."blog_articles" to "service_role";

grant truncate on table "public"."blog_articles" to "service_role";

grant update on table "public"."blog_articles" to "service_role";

grant delete on table "public"."blog_categories" to "anon";

grant insert on table "public"."blog_categories" to "anon";

grant references on table "public"."blog_categories" to "anon";

grant select on table "public"."blog_categories" to "anon";

grant trigger on table "public"."blog_categories" to "anon";

grant truncate on table "public"."blog_categories" to "anon";

grant update on table "public"."blog_categories" to "anon";

grant delete on table "public"."blog_categories" to "authenticated";

grant insert on table "public"."blog_categories" to "authenticated";

grant references on table "public"."blog_categories" to "authenticated";

grant select on table "public"."blog_categories" to "authenticated";

grant trigger on table "public"."blog_categories" to "authenticated";

grant truncate on table "public"."blog_categories" to "authenticated";

grant update on table "public"."blog_categories" to "authenticated";

grant delete on table "public"."blog_categories" to "service_role";

grant insert on table "public"."blog_categories" to "service_role";

grant references on table "public"."blog_categories" to "service_role";

grant select on table "public"."blog_categories" to "service_role";

grant trigger on table "public"."blog_categories" to "service_role";

grant truncate on table "public"."blog_categories" to "service_role";

grant update on table "public"."blog_categories" to "service_role";

grant delete on table "public"."detail_rekomendasi" to "anon";

grant insert on table "public"."detail_rekomendasi" to "anon";

grant references on table "public"."detail_rekomendasi" to "anon";

grant select on table "public"."detail_rekomendasi" to "anon";

grant trigger on table "public"."detail_rekomendasi" to "anon";

grant truncate on table "public"."detail_rekomendasi" to "anon";

grant update on table "public"."detail_rekomendasi" to "anon";

grant delete on table "public"."detail_rekomendasi" to "authenticated";

grant insert on table "public"."detail_rekomendasi" to "authenticated";

grant references on table "public"."detail_rekomendasi" to "authenticated";

grant select on table "public"."detail_rekomendasi" to "authenticated";

grant trigger on table "public"."detail_rekomendasi" to "authenticated";

grant truncate on table "public"."detail_rekomendasi" to "authenticated";

grant update on table "public"."detail_rekomendasi" to "authenticated";

grant delete on table "public"."detail_rekomendasi" to "service_role";

grant insert on table "public"."detail_rekomendasi" to "service_role";

grant references on table "public"."detail_rekomendasi" to "service_role";

grant select on table "public"."detail_rekomendasi" to "service_role";

grant trigger on table "public"."detail_rekomendasi" to "service_role";

grant truncate on table "public"."detail_rekomendasi" to "service_role";

grant update on table "public"."detail_rekomendasi" to "service_role";

grant delete on table "public"."product_categories" to "anon";

grant insert on table "public"."product_categories" to "anon";

grant references on table "public"."product_categories" to "anon";

grant select on table "public"."product_categories" to "anon";

grant trigger on table "public"."product_categories" to "anon";

grant truncate on table "public"."product_categories" to "anon";

grant update on table "public"."product_categories" to "anon";

grant delete on table "public"."product_categories" to "authenticated";

grant insert on table "public"."product_categories" to "authenticated";

grant references on table "public"."product_categories" to "authenticated";

grant select on table "public"."product_categories" to "authenticated";

grant trigger on table "public"."product_categories" to "authenticated";

grant truncate on table "public"."product_categories" to "authenticated";

grant update on table "public"."product_categories" to "authenticated";

grant delete on table "public"."product_categories" to "service_role";

grant insert on table "public"."product_categories" to "service_role";

grant references on table "public"."product_categories" to "service_role";

grant select on table "public"."product_categories" to "service_role";

grant trigger on table "public"."product_categories" to "service_role";

grant truncate on table "public"."product_categories" to "service_role";

grant update on table "public"."product_categories" to "service_role";

grant delete on table "public"."products" to "anon";

grant insert on table "public"."products" to "anon";

grant references on table "public"."products" to "anon";

grant select on table "public"."products" to "anon";

grant trigger on table "public"."products" to "anon";

grant truncate on table "public"."products" to "anon";

grant update on table "public"."products" to "anon";

grant delete on table "public"."products" to "authenticated";

grant insert on table "public"."products" to "authenticated";

grant references on table "public"."products" to "authenticated";

grant select on table "public"."products" to "authenticated";

grant trigger on table "public"."products" to "authenticated";

grant truncate on table "public"."products" to "authenticated";

grant update on table "public"."products" to "authenticated";

grant delete on table "public"."products" to "service_role";

grant insert on table "public"."products" to "service_role";

grant references on table "public"."products" to "service_role";

grant select on table "public"."products" to "service_role";

grant trigger on table "public"."products" to "service_role";

grant truncate on table "public"."products" to "service_role";

grant update on table "public"."products" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."pupuk" to "anon";

grant insert on table "public"."pupuk" to "anon";

grant references on table "public"."pupuk" to "anon";

grant select on table "public"."pupuk" to "anon";

grant trigger on table "public"."pupuk" to "anon";

grant truncate on table "public"."pupuk" to "anon";

grant update on table "public"."pupuk" to "anon";

grant delete on table "public"."pupuk" to "authenticated";

grant insert on table "public"."pupuk" to "authenticated";

grant references on table "public"."pupuk" to "authenticated";

grant select on table "public"."pupuk" to "authenticated";

grant trigger on table "public"."pupuk" to "authenticated";

grant truncate on table "public"."pupuk" to "authenticated";

grant update on table "public"."pupuk" to "authenticated";

grant delete on table "public"."pupuk" to "service_role";

grant insert on table "public"."pupuk" to "service_role";

grant references on table "public"."pupuk" to "service_role";

grant select on table "public"."pupuk" to "service_role";

grant trigger on table "public"."pupuk" to "service_role";

grant truncate on table "public"."pupuk" to "service_role";

grant update on table "public"."pupuk" to "service_role";

grant delete on table "public"."shopping_carts" to "anon";

grant insert on table "public"."shopping_carts" to "anon";

grant references on table "public"."shopping_carts" to "anon";

grant select on table "public"."shopping_carts" to "anon";

grant trigger on table "public"."shopping_carts" to "anon";

grant truncate on table "public"."shopping_carts" to "anon";

grant update on table "public"."shopping_carts" to "anon";

grant delete on table "public"."shopping_carts" to "authenticated";

grant insert on table "public"."shopping_carts" to "authenticated";

grant references on table "public"."shopping_carts" to "authenticated";

grant select on table "public"."shopping_carts" to "authenticated";

grant trigger on table "public"."shopping_carts" to "authenticated";

grant truncate on table "public"."shopping_carts" to "authenticated";

grant update on table "public"."shopping_carts" to "authenticated";

grant delete on table "public"."shopping_carts" to "service_role";

grant insert on table "public"."shopping_carts" to "service_role";

grant references on table "public"."shopping_carts" to "service_role";

grant select on table "public"."shopping_carts" to "service_role";

grant trigger on table "public"."shopping_carts" to "service_role";

grant truncate on table "public"."shopping_carts" to "service_role";

grant update on table "public"."shopping_carts" to "service_role";

grant delete on table "public"."tanaman" to "anon";

grant insert on table "public"."tanaman" to "anon";

grant references on table "public"."tanaman" to "anon";

grant select on table "public"."tanaman" to "anon";

grant trigger on table "public"."tanaman" to "anon";

grant truncate on table "public"."tanaman" to "anon";

grant update on table "public"."tanaman" to "anon";

grant delete on table "public"."tanaman" to "authenticated";

grant insert on table "public"."tanaman" to "authenticated";

grant references on table "public"."tanaman" to "authenticated";

grant select on table "public"."tanaman" to "authenticated";

grant trigger on table "public"."tanaman" to "authenticated";

grant truncate on table "public"."tanaman" to "authenticated";

grant update on table "public"."tanaman" to "authenticated";

grant delete on table "public"."tanaman" to "service_role";

grant insert on table "public"."tanaman" to "service_role";

grant references on table "public"."tanaman" to "service_role";

grant select on table "public"."tanaman" to "service_role";

grant trigger on table "public"."tanaman" to "service_role";

grant truncate on table "public"."tanaman" to "service_role";

grant update on table "public"."tanaman" to "service_role";

grant delete on table "public"."varietas" to "anon";

grant insert on table "public"."varietas" to "anon";

grant references on table "public"."varietas" to "anon";

grant select on table "public"."varietas" to "anon";

grant trigger on table "public"."varietas" to "anon";

grant truncate on table "public"."varietas" to "anon";

grant update on table "public"."varietas" to "anon";

grant delete on table "public"."varietas" to "authenticated";

grant insert on table "public"."varietas" to "authenticated";

grant references on table "public"."varietas" to "authenticated";

grant select on table "public"."varietas" to "authenticated";

grant trigger on table "public"."varietas" to "authenticated";

grant truncate on table "public"."varietas" to "authenticated";

grant update on table "public"."varietas" to "authenticated";

grant delete on table "public"."varietas" to "service_role";

grant insert on table "public"."varietas" to "service_role";

grant references on table "public"."varietas" to "service_role";

grant select on table "public"."varietas" to "service_role";

grant trigger on table "public"."varietas" to "service_role";

grant truncate on table "public"."varietas" to "service_role";

grant update on table "public"."varietas" to "service_role";


  create policy "activity_logs_admin_read"
  on "public"."activity_logs"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text)))));



  create policy "activity_logs_owner_access"
  on "public"."activity_logs"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'owner'::text)))));



  create policy "activity_logs_penyuluh_blog_read"
  on "public"."activity_logs"
  as permissive
  for select
  to public
using ((((module)::text = 'blog'::text) AND (EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'penyuluh'::text))))));



  create policy "activity_logs_system_insert"
  on "public"."activity_logs"
  as permissive
  for insert
  to public
with check (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM auth.users
  WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['owner'::text, 'admin'::text, 'penyuluh'::text])))))));



  create policy "activity_logs_user_own_read"
  on "public"."activity_logs"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));


CREATE TRIGGER trigger_activity_logs_updated_at BEFORE UPDATE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.update_activity_logs_updated_at();

CREATE TRIGGER update_aturan_rekomendasi_updated_at BEFORE UPDATE ON public.aturan_rekomendasi FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_blog_articles_published_at BEFORE UPDATE ON public.blog_articles FOR EACH ROW EXECUTE FUNCTION public.set_published_at();

CREATE TRIGGER update_blog_articles_updated_at BEFORE UPDATE ON public.blog_articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pupuk_updated_at BEFORE UPDATE ON public.pupuk FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tanaman_updated_at BEFORE UPDATE ON public.tanaman FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_varietas_updated_at BEFORE UPDATE ON public.varietas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Authenticated delete own product images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'product-images'::text) AND (owner = auth.uid())));



  create policy "Authenticated update own product images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'product-images'::text) AND (owner = auth.uid())))
with check (((bucket_id = 'product-images'::text) AND (owner = auth.uid())));



  create policy "Authenticated upload product images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'product-images'::text));



  create policy "Authenticated write blog bucket"
  on "storage"."objects"
  as permissive
  for all
  to public
using (((bucket_id = 'blog'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Public read blog bucket"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'blog'::text));



  create policy "Public read product images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'product-images'::text));



