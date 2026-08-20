-- Sprint 3: permissions vendeur, demandes enrichies et actions opérationnelles sûres.

alter table public.seller_applications
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists delivery_available boolean not null default true,
  add column if not exists pickup_available boolean not null default true;

create table if not exists public.category_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  requested_name text not null check(char_length(trim(requested_name)) between 2 and 80),
  note text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.category_requests enable row level security;

create or replace function public.restaurant_member_role_for(target uuid)
returns public.restaurant_member_role
language sql stable security definer set search_path=public
as $$
  select role from public.restaurant_members
  where restaurant_id=target and user_id=auth.uid()
$$;

create or replace function public.can_manage_restaurant(target uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce(public.restaurant_member_role_for(target) in ('owner','manager'),false) or public.is_admin()
$$;

create or replace function public.protect_restaurant_moderation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() and
    (new.validation_status is distinct from old.validation_status or
     new.rejection_reason is distinct from old.rejection_reason) then
    raise exception 'La validation du restaurant est gérée par Come & Eat.';
  end if;
  return new;
end$$;

create or replace function public.protect_product_moderation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() and
    (new.moderation_status is distinct from old.moderation_status or
     new.moderation_note is distinct from old.moderation_note or
     new.hidden_by_admin is distinct from old.hidden_by_admin or
     new.is_featured is distinct from old.is_featured) then
    raise exception 'La modération du produit est gérée par Come & Eat.';
  end if;
  return new;
end$$;

drop trigger if exists restaurants_protect_moderation on public.restaurants;
create trigger restaurants_protect_moderation before update on public.restaurants
for each row execute function public.protect_restaurant_moderation();
drop trigger if exists products_protect_moderation on public.products;
create trigger products_protect_moderation before update on public.products
for each row execute function public.protect_product_moderation();

drop policy if exists restaurants_member_write on public.restaurants;
create policy restaurants_manager_write on public.restaurants for update
using(public.can_manage_restaurant(id)) with check(public.can_manage_restaurant(id));
drop policy if exists restaurant_cuisines_member_write on public.restaurant_cuisine_types;
create policy restaurant_cuisines_manager_write on public.restaurant_cuisine_types for all
using(public.can_manage_restaurant(restaurant_id)) with check(public.can_manage_restaurant(restaurant_id));
drop policy if exists hours_member_write on public.restaurant_hours;
create policy hours_manager_write on public.restaurant_hours for all
using(public.can_manage_restaurant(restaurant_id)) with check(public.can_manage_restaurant(restaurant_id));
drop policy if exists products_member_write on public.products;
create policy products_manager_write on public.products for all
using(public.can_manage_restaurant(restaurant_id)) with check(public.can_manage_restaurant(restaurant_id));
drop policy if exists option_groups_write on public.product_option_groups;
create policy option_groups_manager_write on public.product_option_groups for all
using(public.can_manage_restaurant(restaurant_id)) with check(public.can_manage_restaurant(restaurant_id));
drop policy if exists options_write on public.product_options;
create policy options_manager_write on public.product_options for all using(
  exists(select 1 from public.product_option_groups g where g.id=group_id and public.can_manage_restaurant(g.restaurant_id))
);
drop policy if exists option_links_write on public.product_option_group_links;
create policy option_links_manager_write on public.product_option_group_links for all using(
  exists(select 1 from public.products p where p.id=product_id and public.can_manage_restaurant(p.restaurant_id))
);
drop policy if exists media_owner_write on public.media;
drop policy if exists media_owner_delete on public.media;
drop policy if exists media_owner_insert on public.media;
create policy media_manager_insert on public.media for insert with check(
  owner_user_id=auth.uid() and (restaurant_id is null or public.can_manage_restaurant(restaurant_id)) or public.is_admin()
);
create policy media_manager_write on public.media for update using(
  owner_user_id=auth.uid() and (restaurant_id is null or public.can_manage_restaurant(restaurant_id)) or public.is_admin()
);
create policy media_manager_delete on public.media for delete using(
  owner_user_id=auth.uid() and (restaurant_id is null or public.can_manage_restaurant(restaurant_id)) or public.is_admin()
);
drop policy if exists promotions_member_write on public.promotions;
create policy promotions_manager_write on public.promotions for all
using(public.is_admin() or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id)))
with check(public.is_admin() or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id)));

drop policy if exists applications_update on public.seller_applications;
create policy applications_update on public.seller_applications for update
using((user_id=auth.uid() and status in ('draft','changes_requested')) or public.is_admin())
with check((user_id=auth.uid() and status in ('draft','submitted')) or public.is_admin());
create policy category_requests_own_read on public.category_requests for select
using(user_id=auth.uid() or public.is_admin());
create policy category_requests_own_create on public.category_requests for insert
with check(user_id=auth.uid() and (restaurant_id is null or public.can_manage_restaurant(restaurant_id)));
create policy category_requests_admin_update on public.category_requests for update
using(public.is_admin()) with check(public.is_admin());

create or replace function public.vendor_update_restaurant_order_status(target uuid,new_status public.restaurant_order_status)
returns public.restaurant_order_status
language plpgsql security definer set search_path=public as $$
declare current_status public.restaurant_order_status; target_restaurant uuid; fulfillment public.fulfillment_type;
begin
  select ro.status,ro.restaurant_id,o.fulfillment into current_status,target_restaurant,fulfillment
  from public.restaurant_orders ro join public.orders o on o.id=ro.order_id where ro.id=target for update;
  if target_restaurant is null or not (public.is_restaurant_member(target_restaurant) or public.is_admin()) then raise exception 'Accès refusé.'; end if;
  if new_status='cancelled' and current_status not in ('pending','confirmed','preparing') then raise exception 'Cette commande ne peut plus être annulée.'; end if;
  if new_status<>'cancelled' and not (
    (current_status='pending' and new_status='confirmed') or
    (current_status='confirmed' and new_status='preparing') or
    (current_status='preparing' and new_status in ('ready','ready_for_pickup')) or
    (current_status='ready' and new_status='out_for_delivery' and fulfillment='delivery') or
    (current_status='ready_for_pickup' and new_status='collected' and fulfillment='pickup') or
    (current_status='out_for_delivery' and new_status='delivered')
  ) then raise exception 'Transition de statut non autorisée.'; end if;
  update public.restaurant_orders set status=new_status,updated_at=now() where id=target;
  return new_status;
end$$;

create or replace function public.approve_seller_application(application_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare application public.seller_applications;restaurant_id uuid;
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  select * into application from public.seller_applications where id=application_id for update;
  if application.id is null or application.status not in ('submitted','under_review') then raise exception 'Cette demande ne peut pas être validée.'; end if;
  insert into public.restaurants(name,description,phone,whatsapp,email,address,commune,latitude,longitude,maps_url,logo_path,cover_path,delivery_available,pickup_available,validation_status)
  values(application.restaurant_name,application.description,application.phone,application.whatsapp,application.email,application.address,application.commune,application.latitude,application.longitude,application.maps_url,application.logo_path,application.cover_path,application.delivery_available,application.pickup_available,'approved') returning id into restaurant_id;
  insert into public.restaurant_members(restaurant_id,user_id,role) values(restaurant_id,application.user_id,'owner');
  insert into public.restaurant_cuisine_types(restaurant_id,cuisine_type_id)
  select restaurant_id,ct.id from public.cuisine_types ct where ct.name=any(application.cuisine_notes) on conflict do nothing;
  update public.profiles set role='vendor',updated_at=now() where id=application.user_id and role='customer';
  update public.seller_applications set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=application_id;
  return restaurant_id;
end$$;

grant execute on function public.restaurant_member_role_for(uuid) to authenticated;
grant execute on function public.can_manage_restaurant(uuid) to authenticated;
grant execute on function public.vendor_update_restaurant_order_status(uuid,public.restaurant_order_status) to authenticated;
grant select,insert,update on public.seller_applications to authenticated;
grant select,insert,update on public.restaurants to authenticated;
grant select,insert,update,delete on public.restaurant_cuisine_types,public.restaurant_hours,public.media,public.product_option_groups,public.product_options,public.product_option_group_links,public.promotions to authenticated;
grant select,insert,update on public.products to authenticated;
grant select,insert on public.category_requests to authenticated;
grant update on public.category_requests to authenticated;
revoke update on public.restaurant_orders from authenticated;
