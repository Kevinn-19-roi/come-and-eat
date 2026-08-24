-- Sprint 6.1: suivi client detaille, confirmation Wave manuelle et administration sure.
alter table public.payment_attempts
  add column if not exists paid_at timestamptz,
  add column if not exists confirmed_by uuid references public.profiles(id) on delete set null;

create table if not exists public.payment_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  from_status public.payment_status,
  to_status public.payment_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.payment_status_events enable row level security;
drop policy if exists payment_status_events_admin_read on public.payment_status_events;
create policy payment_status_events_admin_read on public.payment_status_events for select to authenticated using(public.is_admin());
grant select on public.payment_status_events to authenticated;

create or replace function public.admin_confirm_manual_payment(target_order uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_attempt public.payment_attempts; v_before public.payment_status;
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  select * into v_order from public.orders where id=target_order for update;
  if v_order.id is null then raise exception 'Commande introuvable.'; end if;
  select * into v_attempt from public.payment_attempts where order_id=target_order and provider='wave_payment_link' order by created_at desc limit 1 for update;
  if v_attempt.id is null then raise exception 'Tentative de paiement Wave introuvable.'; end if;
  if v_order.payment_status='paid' and v_attempt.status='paid' then
    return jsonb_build_object('already_confirmed',true,'paid_at',coalesce(v_attempt.paid_at,v_attempt.processed_at));
  end if;
  v_before:=v_order.payment_status;
  update public.payment_attempts set status='paid',paid_at=coalesce(paid_at,now()),processed_at=coalesce(processed_at,now()),confirmed_by=coalesce(confirmed_by,auth.uid()),updated_at=now() where id=v_attempt.id;
  update public.orders set payment_status='paid',updated_at=now() where id=target_order;
  insert into public.payment_status_events(order_id,payment_attempt_id,from_status,to_status,changed_by,note)
  values(target_order,v_attempt.id,v_before,'paid',auth.uid(),'Paiement Wave vérifié manuellement par Come & Eat.');
  insert into public.payment_events(payment_attempt_id,provider,provider_event_id,event_type,verified,payload_hash)
  values(v_attempt.id,'wave_payment_link','manual-'||v_attempt.id,'manual_payment_confirmed',true,md5(target_order::text||auth.uid()::text))
  on conflict(provider,provider_event_id) do nothing;
  return jsonb_build_object('already_confirmed',false,'paid_at',now());
end$$;
revoke all on function public.admin_confirm_manual_payment(uuid) from public;
grant execute on function public.admin_confirm_manual_payment(uuid) to authenticated;

create or replace function public.admin_delete_product_if_unused(target_product uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  if exists(select 1 from public.order_items where product_id=target_product) then
    raise exception 'Ce produit possède un historique. Archivez-le plutôt.';
  end if;
  delete from public.products where id=target_product;
  if not found then raise exception 'Produit introuvable.'; end if;
end$$;
revoke all on function public.admin_delete_product_if_unused(uuid) from public;
grant execute on function public.admin_delete_product_if_unused(uuid) to authenticated;

create or replace function public.quote_marketplace_order(payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_subtotal integer:=0; v_delivery integer:=0; v_discount integer:=0; v_promo public.promotions; v_restaurant record; v_fee integer;
begin
  if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')=0 then raise exception 'Votre panier est vide.'; end if;
  select coalesce(sum((p.base_price+coalesce(opts.total,0))*requested.quantity),0)::integer into v_subtotal
  from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb)
  join public.products p on p.id=requested.product_id
  left join lateral(select coalesce(sum(po.price_delta),0) total from jsonb_array_elements_text(coalesce(requested.options,'[]'::jsonb)) x join public.product_options po on po.id=x::uuid) opts on true
  where requested.quantity between 1 and 50 and p.availability and not p.is_archived and not p.hidden_by_admin and p.moderation_status='approved';
  if v_subtotal<=0 then raise exception 'Aucun produit disponible dans ce panier.'; end if;
  if payload->>'fulfillment'='delivery' then
    select fee into v_fee from public.delivery_zones where id=(payload->>'delivery_zone_id')::uuid and restaurant_id is null and is_active;
    if v_fee is null then raise exception 'Cette zone de livraison n’est plus disponible.'; end if;
    select count(distinct p.restaurant_id)*v_fee into v_delivery from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb) join public.products p on p.id=requested.product_id;
  end if;
  if nullif(trim(payload->>'promotion_code'),'') is not null then
    select * into v_promo from public.promotions where upper(code)=upper(trim(payload->>'promotion_code')) and is_active and archived_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and scope='platform' limit 1;
    if v_promo.id is null then raise exception 'Ce code promotionnel n’est pas valide, actif ou applicable.'; end if;
    v_discount:=case when v_promo.discount_type='percent' then least(v_subtotal,round(v_subtotal*v_promo.value/100.0)::integer) else least(v_subtotal,v_promo.value) end;
  end if;
  return jsonb_build_object('subtotal',v_subtotal,'delivery_fee',v_delivery,'discount_total',v_discount,'total',greatest(0,v_subtotal+v_delivery-v_discount),'promotion_name',v_promo.name);
end$$;
revoke all on function public.quote_marketplace_order(jsonb) from public;
grant execute on function public.quote_marketplace_order(jsonb) to anon,authenticated;

create or replace function public.get_public_order_status(order_reference text, tracking_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'reference',o.reference,'total',o.total,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'discount_total',o.discount_total,
  'payment_status',o.payment_status,'fulfillment',o.fulfillment,'address',o.address,'commune',o.commune,'customer_note',o.customer_note,'created_at',o.created_at,
  'restaurant_orders',coalesce((select jsonb_agg(jsonb_build_object(
    'id',ro.id,'status',ro.status,'subtotal',ro.subtotal,'delivery_fee',ro.delivery_fee,'restaurant',jsonb_build_object('name',r.name),
    'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'options',oi.options,'line_total',oi.line_total) order by oi.id) from public.order_items oi where oi.restaurant_order_id=ro.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.order_status_events e where e.restaurant_order_id=ro.id),'[]'::jsonb)
  ) order by ro.created_at) from public.restaurant_orders ro join public.restaurants r on r.id=ro.restaurant_id where ro.order_id=o.id),'[]'::jsonb)
 ) from public.orders o where o.reference=order_reference and o.public_tracking_token=tracking_token;
$$;
revoke all on function public.get_public_order_status(text,uuid) from public;
grant execute on function public.get_public_order_status(text,uuid) to anon,authenticated;

insert into public.site_settings(key,value,is_public)
values('marketplace_commission','{"rate_bps":1000}'::jsonb,false)
on conflict(key) do nothing;
