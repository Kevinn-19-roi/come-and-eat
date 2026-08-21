drop policy if exists seller_documents_create on public.seller_application_documents;
create policy seller_documents_create on public.seller_application_documents for insert to authenticated
with check (
  owner_user_id=auth.uid()
  and storage_path like auth.uid()::text || '/%'
  and exists (
    select 1 from public.seller_applications application
    where application.id=application_id and application.user_id=auth.uid()
      and application.status in ('draft','changes_requested')
  )
);

create or replace function public.review_seller_application(
  target_application_id uuid,
  decision public.seller_application_status,
  review_note text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare application public.seller_applications; target_restaurant_id uuid;
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  if decision not in ('approved','rejected','changes_requested','under_review') then raise exception 'Décision non autorisée.'; end if;
  if decision in ('rejected','changes_requested') and nullif(trim(review_note),'') is null then raise exception 'Une explication est nécessaire.'; end if;
  select * into application from public.seller_applications where id=target_application_id for update;
  if application.id is null then raise exception 'Demande introuvable.'; end if;
  if application.status not in ('submitted','under_review','changes_requested') then raise exception 'Cette demande ne peut pas être examinée dans son état actuel.'; end if;
  target_restaurant_id:=application.restaurant_id;
  if decision='approved' then
    if target_restaurant_id is null then
      insert into public.restaurants(name,description,phone,whatsapp,email,address,commune,latitude,longitude,maps_url,logo_path,cover_path,delivery_available,pickup_available,validation_status,operating_status)
      values(application.restaurant_name,application.description,application.phone,application.whatsapp,application.email,application.address,application.commune,application.latitude,application.longitude,application.maps_url,application.logo_path,application.cover_path,application.delivery_available,application.pickup_available,'approved','closed') returning id into target_restaurant_id;
    else update public.restaurants set validation_status='approved',rejection_reason=null,updated_at=now() where id=target_restaurant_id; end if;
    insert into public.restaurant_members(restaurant_id,user_id,role) values(target_restaurant_id,application.user_id,'owner') on conflict(restaurant_id,user_id) do update set role='owner';
    update public.profiles set role='vendor',updated_at=now() where id=application.user_id and role='customer';
    delete from public.restaurant_cuisine_types where restaurant_id=target_restaurant_id;
    insert into public.restaurant_cuisine_types(restaurant_id,cuisine_type_id) select target_restaurant_id,cuisine.id from public.cuisine_types cuisine where cuisine.name=any(application.cuisine_notes) on conflict do nothing;
  end if;
  update public.seller_applications set status=decision,admin_notes=nullif(trim(review_note),''),reviewed_by=auth.uid(),reviewed_at=now(),restaurant_id=coalesce(target_restaurant_id,restaurant_id),updated_at=now() where id=target_application_id;
  insert into public.seller_application_events(application_id,actor_user_id,status,note) values(target_application_id,auth.uid(),decision,nullif(trim(review_note),''));
  return target_restaurant_id;
end;$$;
