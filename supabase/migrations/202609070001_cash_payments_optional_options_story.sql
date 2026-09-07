-- Paiement en espèces par sous-commande, options facultatives et contenu Histoire.

alter table public.product_option_groups alter column is_required set default false;
alter table public.product_option_groups alter column min_choices set default 0;
update public.product_option_groups
set is_required=false,min_choices=0,updated_at=now()
where type in ('accompaniment','drink','supplement') and (is_required or min_choices<>0);

alter table public.orders drop constraint if exists orders_payment_method_allowed;
alter table public.orders add constraint orders_payment_method_allowed
  check(payment_method in ('wave','cash')) not valid;
alter table public.orders validate constraint orders_payment_method_allowed;

alter table public.restaurant_orders
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists cash_collected_at timestamptz,
  add column if not exists cash_collected_by uuid references public.profiles(id) on delete set null;

update public.restaurant_orders ro set payment_status='paid'
from public.orders o where o.id=ro.order_id and o.payment_method='wave' and o.payment_status='paid';

create table if not exists public.restaurant_payment_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  from_status public.payment_status,
  to_status public.payment_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.restaurant_payment_events enable row level security;
drop policy if exists restaurant_payment_events_read on public.restaurant_payment_events;
create policy restaurant_payment_events_read on public.restaurant_payment_events for select to authenticated
using(public.is_admin() or exists(
  select 1 from public.restaurant_orders ro
  where ro.id=restaurant_order_id and public.is_restaurant_member(ro.restaurant_id)
));
grant select on public.restaurant_payment_events to authenticated;

create or replace function public.confirm_cash_collection(target_restaurant_order uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sub public.restaurant_orders; v_order public.orders; v_before public.payment_status;
begin
  select * into v_sub from public.restaurant_orders where id=target_restaurant_order for update;
  if v_sub.id is null then raise exception 'Sous-commande introuvable.'; end if;
  if not (public.is_admin() or public.is_restaurant_member(v_sub.restaurant_id)) then raise exception 'Accès refusé.'; end if;
  select * into v_order from public.orders where id=v_sub.order_id for update;
  if v_order.payment_method<>'cash' then raise exception 'Cette commande ne doit pas être encaissée en espèces.'; end if;
  if v_sub.payment_status='paid' then
    return jsonb_build_object('already_confirmed',true,'collected_at',v_sub.cash_collected_at);
  end if;
  v_before:=v_sub.payment_status;
  update public.restaurant_orders set payment_status='paid',cash_collected_at=now(),cash_collected_by=auth.uid(),updated_at=now() where id=v_sub.id;
  insert into public.restaurant_payment_events(restaurant_order_id,from_status,to_status,changed_by,note)
  values(v_sub.id,v_before,'paid',auth.uid(),'Paiement en espèces encaissé.');
  if not exists(select 1 from public.restaurant_orders where order_id=v_order.id and payment_status<>'paid') then
    update public.orders set payment_status='paid',updated_at=now() where id=v_order.id;
    if v_order.payment_status<>'paid' then
      insert into public.payment_status_events(order_id,from_status,to_status,changed_by,note)
      values(v_order.id,v_order.payment_status,'paid',auth.uid(),'Tous les paiements en espèces ont été encaissés.');
    end if;
  end if;
  return jsonb_build_object('already_confirmed',false,'collected_at',now());
end$$;
revoke all on function public.confirm_cash_collection(uuid) from public;
grant execute on function public.confirm_cash_collection(uuid) to authenticated;

create or replace function public.admin_confirm_manual_payment(target_order uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders; v_attempt public.payment_attempts; v_before public.payment_status;
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  select * into v_order from public.orders where id=target_order for update;
  if v_order.id is null then raise exception 'Commande introuvable.'; end if;
  if v_order.payment_method<>'wave' then raise exception 'Cette commande n’utilise pas Wave.'; end if;
  select * into v_attempt from public.payment_attempts where order_id=target_order and provider='wave_payment_link' order by created_at desc limit 1 for update;
  if v_attempt.id is null then raise exception 'Tentative de paiement Wave introuvable.'; end if;
  if v_order.payment_status='paid' and v_attempt.status='paid' then
    return jsonb_build_object('already_confirmed',true,'paid_at',coalesce(v_attempt.paid_at,v_attempt.processed_at));
  end if;
  v_before:=v_order.payment_status;
  update public.payment_attempts set status='paid',paid_at=coalesce(paid_at,now()),processed_at=coalesce(processed_at,now()),confirmed_by=coalesce(confirmed_by,auth.uid()),updated_at=now() where id=v_attempt.id;
  update public.orders set payment_status='paid',updated_at=now() where id=target_order;
  update public.restaurant_orders set payment_status='paid',updated_at=now() where order_id=target_order;
  insert into public.payment_status_events(order_id,payment_attempt_id,from_status,to_status,changed_by,note)
  values(target_order,v_attempt.id,v_before,'paid',auth.uid(),'Paiement Wave vérifié manuellement par Come & Eat.');
  insert into public.payment_events(payment_attempt_id,provider,provider_event_id,event_type,verified,payload_hash)
  values(v_attempt.id,'wave_payment_link','manual-'||v_attempt.id,'manual_payment_confirmed',true,md5(target_order::text||auth.uid()::text))
  on conflict(provider,provider_event_id) do nothing;
  return jsonb_build_object('already_confirmed',false,'paid_at',now());
end$$;
revoke all on function public.admin_confirm_manual_payment(uuid) from public;
grant execute on function public.admin_confirm_manual_payment(uuid) to authenticated;

create or replace function public.place_marketplace_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders; v_key uuid; v_method text; v_restaurant record; v_item record; v_suborder_id uuid;
  v_subtotal integer:=0; v_restaurant_subtotal integer; v_option_total integer; v_line_total integer;
  v_delivery_total integer:=0; v_restaurant_fee integer; v_discount integer:=0; v_promotion public.promotions;
  v_commission_bps integer; v_is_official boolean;
begin
  if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')=0 then raise exception 'Le panier est vide.'; end if;
  if coalesce(length(trim(payload->>'customer_name')),0)<2 then raise exception 'Indiquez votre nom.'; end if;
  if coalesce(length(regexp_replace(payload->>'customer_phone','[^0-9]','','g')),0)<8 then raise exception 'Indiquez un numéro de téléphone valide.'; end if;
  v_method:=coalesce(nullif(payload->>'payment_method',''),'wave');
  if v_method not in ('wave','cash') then raise exception 'Choisissez un moyen de paiement valide.'; end if;
  v_key:=(payload->>'idempotency_key')::uuid;
  select * into v_order from public.orders where checkout_idempotency_key=v_key;
  if v_order.id is not null then return jsonb_build_object('id',v_order.id,'reference',v_order.reference,'total',v_order.total,'tracking_token',v_order.public_tracking_token,'payment_method',v_order.payment_method,'reused',true); end if;

  insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,address,commune,customer_note,wants_cutlery,payment_method,subtotal,delivery_fee,discount_total,total,checkout_idempotency_key)
  values('CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),auth.uid(),trim(payload->>'customer_name'),trim(payload->>'customer_phone'),nullif(trim(payload->>'customer_email'),''),(payload->>'fulfillment')::public.fulfillment_type,nullif(trim(payload->>'address'),''),nullif(trim(payload->>'commune'),''),nullif(trim(payload->>'customer_note'),''),coalesce((payload->>'wants_cutlery')::boolean,false),v_method,0,0,0,0,v_key) returning * into v_order;

  for v_restaurant in select distinct r.id,r.is_official from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb) join public.products p on p.id=requested.product_id join public.restaurants r on r.id=p.restaurant_id loop
    if not public.restaurant_is_open(v_restaurant.id,now()) then raise exception 'Un restaurant ne prend pas de nouvelles commandes actuellement.'; end if;
    v_restaurant_subtotal:=0;
    insert into public.restaurant_orders(order_id,restaurant_id,subtotal,status,payment_status) values(v_order.id,v_restaurant.id,0,'pending','pending') returning id into v_suborder_id;
    for v_item in select requested.product_id,requested.quantity,coalesce(requested.options,'[]'::jsonb) options,p.name,p.base_price from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb) join public.products p on p.id=requested.product_id where p.restaurant_id=v_restaurant.id loop
      if v_item.quantity<1 or v_item.quantity>50 then raise exception 'Quantité invalide.'; end if;
      if not exists(select 1 from public.products p where p.id=v_item.product_id and p.availability and not p.is_archived and not p.hidden_by_admin and p.moderation_status='approved') then raise exception 'Un produit du panier n’est plus disponible.'; end if;
      if exists(select 1 from jsonb_array_elements_text(v_item.options) x(id) left join public.product_options po on po.id=x.id::uuid left join public.product_option_groups g on g.id=po.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=v_item.product_id where po.id is null or not po.is_available or not g.is_active or l.product_id is null) then raise exception 'Une option sélectionnée n’est plus disponible.'; end if;
      if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id left join lateral(select count(*) c from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid and po.group_id=g.id) s on true where l.product_id=v_item.product_id and (s.c<g.min_choices or (g.max_choices is not null and s.c>g.max_choices))) then raise exception 'Les choix d’options ne respectent pas les règles du produit.'; end if;
      select coalesce(sum(po.price_delta),0)::integer into v_option_total from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid;
      v_line_total:=(v_item.base_price+v_option_total)*v_item.quantity; v_restaurant_subtotal:=v_restaurant_subtotal+v_line_total;
      insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total)
      select v_suborder_id,v_item.product_id,v_item.name,v_item.quantity,v_item.base_price,coalesce(jsonb_agg(jsonb_build_object('id',po.id,'name',po.name,'price',po.price_delta)),'[]'::jsonb),v_line_total from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid;
    end loop;
    if payload->>'fulfillment'='delivery' then select fee into v_restaurant_fee from public.delivery_zones where id=(payload->>'delivery_zone_id')::uuid and is_active and restaurant_id is null limit 1; if v_restaurant_fee is null then raise exception 'Cette zone de livraison n’est pas disponible.'; end if; else v_restaurant_fee:=0; end if;
    v_is_official:=v_restaurant.is_official; select nullif(value->>'rate_bps','')::integer into v_commission_bps from public.site_settings where key='marketplace_commission'; v_commission_bps:=coalesce(v_commission_bps,0); if v_is_official then v_commission_bps:=0; end if;
    update public.restaurant_orders set subtotal=v_restaurant_subtotal,delivery_fee=v_restaurant_fee,gross_amount=v_restaurant_subtotal,commission_rate_bps=v_commission_bps,platform_commission=round(v_restaurant_subtotal*v_commission_bps/10000.0)::integer,seller_net_amount=v_restaurant_subtotal-round(v_restaurant_subtotal*v_commission_bps/10000.0)::integer where id=v_suborder_id;
    v_subtotal:=v_subtotal+v_restaurant_subtotal; v_delivery_total:=v_delivery_total+v_restaurant_fee;
  end loop;
  if v_subtotal=0 then raise exception 'Aucun produit disponible dans ce panier.'; end if;
  if nullif(trim(payload->>'promotion_code'),'') is not null then select * into v_promotion from public.promotions where upper(code)=upper(trim(payload->>'promotion_code')) and is_active and archived_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and scope='platform' limit 1; if v_promotion.id is null then raise exception 'Ce code promotionnel n’est pas valide.'; end if; v_discount:=case when v_promotion.discount_type='percent' then least(v_subtotal,round(v_subtotal*v_promotion.value/100.0)::integer) else least(v_subtotal,v_promotion.value) end; end if;
  update public.orders set subtotal=v_subtotal,delivery_fee=v_delivery_total,discount_total=v_discount,total=greatest(0,v_subtotal+v_delivery_total-v_discount),promotion_id=v_promotion.id,promotion_code=nullif(trim(payload->>'promotion_code'),'') where id=v_order.id returning * into v_order;
  if v_method='wave' then insert into public.payment_attempts(order_id,provider,idempotency_key,amount,currency,status,metadata) values(v_order.id,'wave_payment_link',v_key,v_order.total,'XOF','pending',jsonb_build_object('source','checkout')); end if;
  return jsonb_build_object('id',v_order.id,'reference',v_order.reference,'total',v_order.total,'tracking_token',v_order.public_tracking_token,'payment_method',v_method,'reused',false);
end$$;
revoke all on function public.place_marketplace_order(jsonb) from public;
grant execute on function public.place_marketplace_order(jsonb) to anon,authenticated;

create or replace function public.get_public_order_status(order_reference text, tracking_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'reference',o.reference,'total',o.total,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'discount_total',o.discount_total,
  'payment_method',o.payment_method,'payment_status',o.payment_status,'fulfillment',o.fulfillment,'address',o.address,'commune',o.commune,'customer_note',o.customer_note,'created_at',o.created_at,
  'restaurant_orders',coalesce((select jsonb_agg(jsonb_build_object(
    'id',ro.id,'status',ro.status,'payment_status',ro.payment_status,'subtotal',ro.subtotal,'delivery_fee',ro.delivery_fee,'restaurant',jsonb_build_object('name',r.name),
    'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'options',oi.options,'line_total',oi.line_total) order by oi.id) from public.order_items oi where oi.restaurant_order_id=ro.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.order_status_events e where e.restaurant_order_id=ro.id),'[]'::jsonb)
  ) order by ro.created_at) from public.restaurant_orders ro join public.restaurants r on r.id=ro.restaurant_id where ro.order_id=o.id),'[]'::jsonb)
 ) from public.orders o where o.reference=order_reference and o.public_tracking_token=tracking_token;
$$;
revoke all on function public.get_public_order_status(text,uuid) from public;
grant execute on function public.get_public_order_status(text,uuid) to anon,authenticated;

insert into public.site_settings(key,value,is_public)
values('story',jsonb_build_object(
  'title','Derrière chaque plat, l''envie de bien faire.',
  'body',$story$Le constat d'Abidjan :

À Abidjan, la pause-repas est un moment précieux, mais trouver une option qui allie le vrai goût du « fait maison », la qualité et la praticité au milieu d'un emploi du temps effréné relève souvent du défi. C’est exactement de ce constat qu'est née notre aventure. Deux jeunes entrepreneurs, passionnés de bonne cuisine, ont décidé de dire stop aux repas pris à la hâte.

Qui sommes-nous ?

Nous sommes LATIF TIENDREBEOGO et HABIB COULIBALY, deux jeunes entrepreneurs abidjanais, unis par une même vision de l'entrepreneuriat et de la restauration. Aux commandes de la gestion stratégique, nous unissons nos forces au quotidien pour structurer, faire grandir et optimiser notre service.

Notre objectif ? Mettre notre dynamisme et notre rigueur au service de vos papilles, en toute transparence.

Notre vision :

Notre promesse est simple mais exigeante : vous offrir du bon goût, du « fait maison » authentique, préparé avec soin, et livré là où vous en avez besoin. Pas de compromis entre la rapidité et la qualité : nous voulons que chaque bouchée vous rappelle la chaleur et la générosité d'un repas fait à la maison.

Une gestion rigoureuse, un esprit accessible :

Si notre projet a germé en dehors de nos parcours académiques, nous le pilotons avec une exigence de chaque instant. Nous mettons un point d'honneur à allier rigueur professionnelle, transparence totale et décontraction au quotidien. Nous voulons grandir avec vous, en toute simplicité.

Aujourd'hui et demain :

Chaque commande passée chez nous est le fruit d'un travail mûrement réfléchi et d'une passion intacte. Merci de faire partie de notre histoire. Prêt à découvrir ce que nous avons préparé pour vous aujourd'hui ?$story$,
  'photo_path',''
),true) on conflict(key) do nothing;
