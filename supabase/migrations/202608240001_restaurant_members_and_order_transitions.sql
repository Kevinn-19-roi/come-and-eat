-- Administration sûre des membres et transitions opérationnelles cohérentes.
create or replace function public.admin_manage_restaurant_member(
  target_restaurant uuid,
  target_user uuid,
  new_role public.restaurant_member_role default null,
  operation text default 'upsert'
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  if not exists(select 1 from public.restaurants where id=target_restaurant) then raise exception 'Restaurant introuvable.'; end if;
  if not exists(select 1 from public.profiles where id=target_user) then raise exception 'Utilisateur introuvable.'; end if;
  if operation='remove' then
    delete from public.restaurant_members where restaurant_id=target_restaurant and user_id=target_user;
  elsif operation='upsert' and new_role is not null then
    insert into public.restaurant_members(restaurant_id,user_id,role)
    values(target_restaurant,target_user,new_role)
    on conflict(restaurant_id,user_id) do update set role=excluded.role;
  else raise exception 'Action membre invalide.';
  end if;
end$$;
revoke all on function public.admin_manage_restaurant_member(uuid,uuid,public.restaurant_member_role,text) from public;
grant execute on function public.admin_manage_restaurant_member(uuid,uuid,public.restaurant_member_role,text) to authenticated;

create or replace function public.vendor_update_restaurant_order_status(target uuid,new_status public.restaurant_order_status)
returns public.restaurant_order_status language plpgsql security definer set search_path=public as $$
declare current_status public.restaurant_order_status;target_restaurant uuid;fulfillment public.fulfillment_type;
begin
  select ro.status,ro.restaurant_id,o.fulfillment into current_status,target_restaurant,fulfillment
  from public.restaurant_orders ro join public.orders o on o.id=ro.order_id where ro.id=target for update;
  if target_restaurant is null then raise exception 'Sous-commande introuvable.'; end if;
  if not (public.is_restaurant_member(target_restaurant) or public.is_admin()) then raise exception 'Accès refusé.'; end if;
  if new_status='cancelled' and current_status not in ('pending','confirmed','preparing') then raise exception 'Cette commande ne peut plus être annulée.'; end if;
  if new_status<>'cancelled' and not (
    (current_status='pending' and new_status='confirmed') or
    (current_status='confirmed' and new_status='preparing') or
    (current_status='preparing' and new_status='ready' and fulfillment='delivery') or
    (current_status='preparing' and new_status='ready_for_pickup' and fulfillment='pickup') or
    (current_status='ready' and new_status='out_for_delivery' and fulfillment='delivery') or
    (current_status='ready_for_pickup' and new_status='collected' and fulfillment='pickup') or
    (current_status='out_for_delivery' and new_status='delivered' and fulfillment='delivery')
  ) then raise exception 'Transition de statut non autorisée.'; end if;
  update public.restaurant_orders set status=new_status,updated_at=now() where id=target;
  return new_status;
end$$;
revoke all on function public.vendor_update_restaurant_order_status(uuid,public.restaurant_order_status) from public;
grant execute on function public.vendor_update_restaurant_order_status(uuid,public.restaurant_order_status) to authenticated;
