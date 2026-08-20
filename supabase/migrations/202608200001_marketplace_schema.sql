create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum ('customer','vendor','admin','super_admin');
create type public.restaurant_member_role as enum ('owner','manager','staff');
create type public.restaurant_status as enum ('open','closed','paused');
create type public.validation_status as enum ('draft','pending_review','approved','rejected','suspended');
create type public.seller_application_status as enum ('draft','submitted','under_review','approved','rejected','changes_requested');
create type public.option_group_type as enum ('accompaniment','drink','supplement','custom');
create type public.moderation_status as enum ('pending','approved','flagged','hidden');
create type public.fulfillment_type as enum ('delivery','pickup');
create type public.payment_status as enum ('pending','paid','failed','refunded');
create type public.restaurant_order_status as enum ('pending','confirmed','preparing','ready','ready_for_pickup','out_for_delivery','delivered','collected','cancelled');
create type public.promotion_scope as enum ('platform','restaurant','product','category');
create type public.discount_type as enum ('percent','fixed');
create type public.media_type as enum ('logo','cover','product','category','editorial','document','other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, description text not null default '',
  logo_path text, cover_path text, phone text, whatsapp text, email text,
  address text, commune text, latitude numeric(9,6), longitude numeric(9,6), maps_url text,
  timezone text not null default 'Africa/Abidjan', average_prep_minutes integer not null default 25 check(average_prep_minutes between 0 and 360),
  delivery_available boolean not null default true, pickup_available boolean not null default true,
  operating_status public.restaurant_status not null default 'closed',
  validation_status public.validation_status not null default 'draft',
  rejection_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.restaurant_member_role not null default 'staff',
  created_at timestamptz not null default now(), primary key(restaurant_id,user_id)
);

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_name text not null, description text not null default '', phone text not null,
  address text, commune text, latitude numeric(9,6), longitude numeric(9,6), maps_url text,
  logo_path text, cover_path text, cuisine_notes text[] not null default '{}', document_paths text[] not null default '{}',
  status public.seller_application_status not null default 'draft', admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null, submitted_at timestamptz, reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  image_path text, description text, sort_order integer not null default 0, is_active boolean not null default true,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cuisine_types (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.restaurant_cuisine_types (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cuisine_type_id uuid not null references public.cuisine_types(id) on delete restrict,
  primary key(restaurant_id,cuisine_type_id)
);
create table public.restaurant_hours (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week smallint not null check(day_of_week between 0 and 6), opens_at time, closes_at time,
  is_closed boolean not null default false, unique(restaurant_id,day_of_week),
  check(is_closed or (opens_at is not null and closes_at is not null))
);

create sequence public.product_sku_sequence start 1001;
create table public.media (
  id uuid primary key default gen_random_uuid(), path text not null unique, bucket text not null default 'restaurant-media',
  file_name text not null, mime_type text, size_bytes bigint check(size_bytes is null or size_bytes >= 0),
  alt_text text not null default '', owner_user_id uuid references public.profiles(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete cascade, type public.media_type not null default 'other',
  is_public boolean not null default true, created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete restrict, name text not null, slug text not null,
  sku text not null unique, description text not null default '', base_price integer not null check(base_price >= 0),
  media_id uuid references public.media(id) on delete set null, availability boolean not null default true,
  is_featured boolean not null default false, is_archived boolean not null default false, sort_order integer not null default 0,
  moderation_status public.moderation_status not null default 'pending', moderation_note text, hidden_by_admin boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(restaurant_id,slug)
);
create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, type public.option_group_type not null default 'custom', is_required boolean not null default false,
  min_choices integer not null default 0 check(min_choices >= 0), max_choices integer check(max_choices is null or max_choices > 0),
  sort_order integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(max_choices is null or max_choices >= min_choices)
);
create table public.product_options (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name text not null, price_delta integer not null default 0 check(price_delta >= 0), is_available boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_option_group_links (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  sort_order integer not null default 0, primary key(product_id,group_id)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid references public.restaurants(id) on delete cascade,
  name text not null, fee integer not null default 0 check(fee >= 0), is_active boolean not null default true
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  customer_user_id uuid references public.profiles(id) on delete set null, customer_name text not null, customer_phone text not null,
  customer_email text, fulfillment public.fulfillment_type not null, address text, commune text, latitude numeric(9,6), longitude numeric(9,6),
  customer_note text, wants_cutlery boolean not null default false, payment_method text not null,
  payment_status public.payment_status not null default 'pending', subtotal integer not null check(subtotal >= 0),
  delivery_fee integer not null default 0 check(delivery_fee >= 0), discount_total integer not null default 0 check(discount_total >= 0),
  total integer not null check(total >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.restaurant_orders (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  subtotal integer not null check(subtotal >= 0), delivery_fee integer not null default 0 check(delivery_fee >= 0),
  status public.restaurant_order_status not null default 'pending', prep_minutes integer, vendor_note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_id,restaurant_id)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), restaurant_order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  quantity integer not null check(quantity > 0), unit_price integer not null check(unit_price >= 0),
  options jsonb not null default '[]'::jsonb, line_total integer not null check(line_total >= 0)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade, product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(), check(num_nonnulls(restaurant_id,product_id)=1)
);
create unique index favorites_restaurant_unique on public.favorites(user_id,restaurant_id) where restaurant_id is not null;
create unique index favorites_product_unique on public.favorites(user_id,product_id) where product_id is not null;
create table public.promotions (
  id uuid primary key default gen_random_uuid(), name text not null, scope public.promotion_scope not null,
  discount_type public.discount_type not null, value integer not null check(value >= 0), code text,
  restaurant_id uuid references public.restaurants(id) on delete cascade, product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade, starts_at timestamptz, ends_at timestamptz,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.site_settings (
  key text primary key, value jsonb not null, is_public boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now()
);
create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(), section_key text not null unique, title text, subtitle text, body text,
  media_id uuid references public.media(id) on delete set null, product_id uuid references public.products(id) on delete set null,
  sort_order integer not null default 0, is_visible boolean not null default true,
  content jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.slugify(value text) returns text language sql immutable strict as $$
  select trim(both '-' from regexp_replace(lower(translate(value,'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ','AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),'[^a-z0-9]+','-','g'));
$$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
create or replace function public.set_generated_fields() returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug='' then new.slug=public.slugify(new.name); end if;
  if tg_table_name='products' and (new.sku is null or new.sku='') then
    new.sku='CEA-'||upper(substr(public.slugify(new.name),1,3))||'-'||lpad(nextval('public.product_sku_sequence')::text,4,'0');
  end if;
  return new;
end$$;
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$select role from public.profiles where id=auth.uid()$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.current_role() in ('admin','super_admin'),false)$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce(public.current_role()='super_admin',false)$$;
create or replace function public.is_restaurant_member(target uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.restaurant_members where restaurant_id=target and user_id=auth.uid())$$;
create or replace function public.restaurant_is_open(target uuid, at_time timestamptz default now()) returns boolean language sql stable as $$
 select exists(select 1 from public.restaurants r join public.restaurant_hours h on h.restaurant_id=r.id
 where r.id=target and r.operating_status='open' and r.validation_status='approved' and not h.is_closed
 and h.day_of_week=extract(dow from at_time at time zone r.timezone)::smallint
 and (at_time at time zone r.timezone)::time between h.opens_at and h.closes_at);
$$;
create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.role<>old.role and not (public.is_super_admin() or auth.role()='service_role' or (public.is_admin() and old.role='customer' and new.role='vendor')) then raise exception 'Ce rôle ne peut pas être modifié avec vos permissions.'; end if;
 return new;
end$$;
create or replace function public.admin_set_user_role(target_user uuid,new_role public.app_role) returns void language plpgsql security definer set search_path=public as $$
declare target_role public.app_role;
begin
 if not public.is_super_admin() then raise exception 'Seul un super administrateur peut modifier les rôles administratifs.'; end if;
 select role into target_role from public.profiles where id=target_user for update;
 if target_role='super_admin' and not public.is_super_admin() then raise exception 'Un administrateur ne peut pas modifier un super administrateur.'; end if;
 if new_role='super_admin' and not public.is_super_admin() then raise exception 'Seul un super administrateur peut accorder ce rôle.'; end if;
 update public.profiles set role=new_role,updated_at=now() where id=target_user;
end$$;
create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name','')) on conflict do nothing; return new; end$$;
create or replace function public.approve_seller_application(application_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare application public.seller_applications;restaurant_id uuid;
begin
 if not public.is_admin() then raise exception 'Accès refusé.'; end if;
 select * into application from public.seller_applications where id=application_id for update;
 if application.id is null or application.status not in ('submitted','under_review') then raise exception 'Cette demande ne peut pas être validée.'; end if;
 insert into public.restaurants(name,description,phone,address,commune,latitude,longitude,maps_url,logo_path,cover_path,validation_status)
 values(application.restaurant_name,application.description,application.phone,application.address,application.commune,application.latitude,application.longitude,application.maps_url,application.logo_path,application.cover_path,'approved') returning id into restaurant_id;
 insert into public.restaurant_members(restaurant_id,user_id,role) values(restaurant_id,application.user_id,'owner');
 update public.profiles set role='vendor',updated_at=now() where id=application.user_id and role='customer';
 update public.seller_applications set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=application_id;
 return restaurant_id;
end$$;
create or replace function public.place_marketplace_order(payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare new_order_id uuid;new_reference text;restaurant record;item record;restaurant_order_id uuid;restaurant_subtotal integer;grand_total integer:=0;option_total integer;line_total integer;
begin
 if jsonb_array_length(coalesce(payload->'items','[]'::jsonb))=0 then raise exception 'Le panier est vide.'; end if;
 new_reference='CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,address,commune,customer_note,wants_cutlery,payment_method,subtotal,delivery_fee,total)
 values(new_reference,auth.uid(),payload->>'customer_name',payload->>'customer_phone',nullif(payload->>'customer_email',''),(payload->>'fulfillment')::public.fulfillment_type,nullif(payload->>'address',''),nullif(payload->>'commune',''),nullif(payload->>'customer_note',''),coalesce((payload->>'wants_cutlery')::boolean,false),payload->>'payment_method',0,0,0) returning id into new_order_id;
 for restaurant in select distinct p.restaurant_id from jsonb_to_recordset(payload->'items') as requested(product_id uuid,quantity integer,options jsonb) join public.products p on p.id=requested.product_id where requested.quantity>0 and p.availability and not p.is_archived and not p.hidden_by_admin and p.moderation_status='approved' loop
  restaurant_subtotal=0;
  insert into public.restaurant_orders(order_id,restaurant_id,subtotal,status) values(new_order_id,restaurant.restaurant_id,0,'pending') returning id into restaurant_order_id;
  for item in select requested.product_id,requested.quantity,coalesce(requested.options,'[]'::jsonb) options,p.name,p.base_price from jsonb_to_recordset(payload->'items') as requested(product_id uuid,quantity integer,options jsonb) join public.products p on p.id=requested.product_id where p.restaurant_id=restaurant.restaurant_id and requested.quantity>0 loop
   select coalesce(sum(po.price_delta),0)::integer into option_total from jsonb_array_elements_text(item.options) selected(option_id) join public.product_options po on po.id=selected.option_id::uuid join public.product_option_groups g on g.id=po.group_id join public.product_option_group_links link on link.group_id=g.id and link.product_id=item.product_id where po.is_available and g.is_active;
   line_total=(item.base_price+option_total)*item.quantity;restaurant_subtotal=restaurant_subtotal+line_total;
   insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total) values(restaurant_order_id,item.product_id,item.name,item.quantity,item.base_price,item.options,line_total);
  end loop;
  update public.restaurant_orders set subtotal=restaurant_subtotal where id=restaurant_order_id;grand_total=grand_total+restaurant_subtotal;
 end loop;
 if grand_total=0 then raise exception 'Aucun produit disponible dans ce panier.'; end if;
 update public.orders set subtotal=grand_total,total=grand_total where id=new_order_id;
 return jsonb_build_object('id',new_order_id,'reference',new_reference,'total',grand_total);
end$$;

create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();
create trigger auth_user_profile after insert on auth.users for each row execute function public.create_profile_for_user();
create trigger restaurants_generated before insert or update of name on public.restaurants for each row execute function public.set_generated_fields();
create trigger categories_generated before insert or update of name on public.categories for each row execute function public.set_generated_fields();
create trigger cuisine_types_generated before insert or update of name on public.cuisine_types for each row execute function public.set_generated_fields();
create trigger products_generated before insert or update of name on public.products for each row execute function public.set_generated_fields();
create trigger restaurants_updated before update on public.restaurants for each row execute function public.set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create index restaurants_public_idx on public.restaurants(validation_status,operating_status);
create index restaurants_name_search_idx on public.restaurants using gin(name gin_trgm_ops);
create index products_restaurant_idx on public.products(restaurant_id,is_archived,availability);
create index products_category_idx on public.products(category_id) where is_archived=false;
create index products_featured_idx on public.products(is_featured,sort_order) where is_archived=false and hidden_by_admin=false;
create index products_name_search_idx on public.products using gin(name gin_trgm_ops);
create index restaurant_orders_vendor_idx on public.restaurant_orders(restaurant_id,status,created_at desc);
create index orders_customer_idx on public.orders(customer_user_id,created_at desc);
create index seller_applications_status_idx on public.seller_applications(status,created_at desc);
create index media_restaurant_idx on public.media(restaurant_id,created_at desc);

alter table public.profiles enable row level security; alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security; alter table public.seller_applications enable row level security;
alter table public.categories enable row level security; alter table public.cuisine_types enable row level security;
alter table public.restaurant_cuisine_types enable row level security; alter table public.restaurant_hours enable row level security;
alter table public.media enable row level security; alter table public.products enable row level security;
alter table public.product_option_groups enable row level security; alter table public.product_options enable row level security;
alter table public.product_option_group_links enable row level security; alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security; alter table public.restaurant_orders enable row level security;
alter table public.order_items enable row level security; alter table public.favorites enable row level security;
alter table public.promotions enable row level security; alter table public.site_settings enable row level security;
alter table public.homepage_sections enable row level security;

create policy profiles_self_read on public.profiles for select using(id=auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using(id=auth.uid() or public.is_super_admin()) with check(id=auth.uid() or public.is_super_admin());
create policy restaurants_public_read on public.restaurants for select using(validation_status='approved' or public.is_restaurant_member(id) or public.is_admin());
create policy restaurants_member_write on public.restaurants for update using(public.is_restaurant_member(id) or public.is_admin()) with check(public.is_restaurant_member(id) or public.is_admin());
create policy restaurants_admin_insert on public.restaurants for insert with check(public.is_admin());
create policy members_read on public.restaurant_members for select using(user_id=auth.uid() or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy members_admin_write on public.restaurant_members for all using(public.is_admin()) with check(public.is_admin());
create policy applications_own on public.seller_applications for select using(user_id=auth.uid() or public.is_admin());
create policy applications_create on public.seller_applications for insert with check(user_id=auth.uid());
create policy applications_update on public.seller_applications for update using((user_id=auth.uid() and status in ('draft','changes_requested')) or public.is_admin());
create policy categories_public_read on public.categories for select using(is_active or public.is_admin());
create policy categories_admin_write on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy cuisines_public_read on public.cuisine_types for select using(is_active or public.is_admin());
create policy cuisines_admin_write on public.cuisine_types for all using(public.is_admin()) with check(public.is_admin());
create policy restaurant_cuisines_public_read on public.restaurant_cuisine_types for select using(true);
create policy restaurant_cuisines_member_write on public.restaurant_cuisine_types for all using(public.is_restaurant_member(restaurant_id) or public.is_admin()) with check(public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy hours_public_read on public.restaurant_hours for select using(true);
create policy hours_member_write on public.restaurant_hours for all using(public.is_restaurant_member(restaurant_id) or public.is_admin()) with check(public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy media_public_read on public.media for select using(is_public or owner_user_id=auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)) or public.is_admin());
create policy media_owner_insert on public.media for insert with check(owner_user_id=auth.uid() and (restaurant_id is null or public.is_restaurant_member(restaurant_id)) or public.is_admin());
create policy media_owner_write on public.media for update using(owner_user_id=auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)) or public.is_admin());
create policy media_owner_delete on public.media for delete using(owner_user_id=auth.uid() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)) or public.is_admin());
create policy products_public_read on public.products for select using((not is_archived and not hidden_by_admin and moderation_status='approved' and exists(select 1 from public.restaurants r where r.id=restaurant_id and r.validation_status='approved')) or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy products_member_write on public.products for all using(public.is_restaurant_member(restaurant_id) or public.is_admin()) with check(public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy option_groups_read on public.product_option_groups for select using(is_active or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy option_groups_write on public.product_option_groups for all using(public.is_restaurant_member(restaurant_id) or public.is_admin()) with check(public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy options_read on public.product_options for select using(exists(select 1 from public.product_option_groups g where g.id=group_id and (g.is_active or public.is_restaurant_member(g.restaurant_id) or public.is_admin())));
create policy options_write on public.product_options for all using(exists(select 1 from public.product_option_groups g where g.id=group_id and (public.is_restaurant_member(g.restaurant_id) or public.is_admin())));
create policy option_links_read on public.product_option_group_links for select using(true);
create policy option_links_write on public.product_option_group_links for all using(exists(select 1 from public.products p where p.id=product_id and (public.is_restaurant_member(p.restaurant_id) or public.is_admin())));
create policy zones_public_read on public.delivery_zones for select using(is_active or public.is_admin());
create policy zones_member_write on public.delivery_zones for all using(restaurant_id is not null and public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy orders_customer_read on public.orders for select using(customer_user_id=auth.uid() or public.is_admin() or exists(select 1 from public.restaurant_orders ro where ro.order_id=orders.id and public.is_restaurant_member(ro.restaurant_id)));
create policy orders_admin_update on public.orders for update using(public.is_admin());
create policy restaurant_orders_vendor_read on public.restaurant_orders for select using(public.is_restaurant_member(restaurant_id) or public.is_admin() or exists(select 1 from public.orders o where o.id=restaurant_orders.order_id and o.customer_user_id=auth.uid()));
create policy restaurant_orders_vendor_update on public.restaurant_orders for update using(public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy order_items_visible on public.order_items for select using(exists(select 1 from public.restaurant_orders ro join public.orders o on o.id=ro.order_id where ro.id=order_items.restaurant_order_id and (public.is_restaurant_member(ro.restaurant_id) or public.is_admin() or o.customer_user_id=auth.uid())));
create policy favorites_own on public.favorites for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy promotions_public_read on public.promotions for select using(is_active or public.is_admin() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)));
create policy promotions_member_write on public.promotions for all using(public.is_admin() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id))) with check(public.is_admin() or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)));
create policy settings_public_read on public.site_settings for select using(is_public or public.is_admin());
create policy settings_admin_write on public.site_settings for all using(public.is_admin()) with check(public.is_admin());
create policy homepage_public_read on public.homepage_sections for select using(is_visible or public.is_admin());
create policy homepage_admin_write on public.homepage_sections for all using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('restaurant-media','restaurant-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do update set public=excluded.public;
create policy storage_public_read on storage.objects for select using(bucket_id='restaurant-media');
create policy storage_member_insert on storage.objects for insert to authenticated with check(bucket_id='restaurant-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy storage_member_update on storage.objects for update to authenticated using(bucket_id='restaurant-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy storage_member_delete on storage.objects for delete to authenticated using(bucket_id='restaurant-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));

grant execute on function public.current_role() to authenticated; grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated; grant execute on function public.is_restaurant_member(uuid) to authenticated;
grant execute on function public.admin_set_user_role(uuid,public.app_role) to authenticated;
grant execute on function public.approve_seller_application(uuid) to authenticated;
revoke all on function public.place_marketplace_order(jsonb) from public;
grant execute on function public.place_marketplace_order(jsonb) to anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.restaurants,public.categories,public.cuisine_types,public.restaurant_cuisine_types,public.restaurant_hours,public.media,public.products,public.product_option_groups,public.product_options,public.product_option_group_links,public.delivery_zones,public.promotions,public.site_settings,public.homepage_sections to anon,authenticated;
grant select on public.profiles,public.restaurant_members,public.seller_applications,public.orders,public.restaurant_orders,public.order_items,public.favorites to authenticated;
grant usage,select on sequence public.product_sku_sequence to authenticated;
