-- Sprint 6: checkout autoritaire, paiements idempotents et commissions.
alter type public.payment_status add value if not exists 'processing';
alter type public.payment_status add value if not exists 'cancelled';
alter type public.payment_status add value if not exists 'partially_refunded';

alter table public.orders
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists public_tracking_token uuid default gen_random_uuid(),
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null,
  add column if not exists promotion_code text;
create unique index if not exists orders_checkout_idempotency_key_unique on public.orders(checkout_idempotency_key);
create unique index if not exists orders_public_tracking_token_unique on public.orders(public_tracking_token);

alter table public.restaurant_orders
  add column if not exists gross_amount integer,
  add column if not exists platform_commission integer,
  add column if not exists seller_net_amount integer,
  add column if not exists commission_rate_bps integer;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text,
  idempotency_key uuid not null,
  amount integer not null check(amount >= 0),
  currency text not null default 'XOF' check(currency = 'XOF'),
  status public.payment_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  initiated_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,idempotency_key)
);
create unique index if not exists payment_attempts_provider_reference_unique
  on public.payment_attempts(provider,provider_reference) where provider_reference is not null;
create index if not exists payment_attempts_order_idx on public.payment_attempts(order_id,created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  verified boolean not null default false,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict,
  amount integer not null check(amount > 0),
  status text not null check(status in ('pending','processing','succeeded','failed','cancelled')),
  provider_reference text,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
drop policy if exists payment_attempts_customer_read on public.payment_attempts;
create policy payment_attempts_customer_read on public.payment_attempts for select to authenticated
using(public.is_admin() or exists(select 1 from public.orders o where o.id=order_id and o.customer_user_id=auth.uid()));
drop policy if exists payment_attempts_admin_write on public.payment_attempts;
create policy payment_attempts_admin_write on public.payment_attempts for all to authenticated
using(public.is_admin()) with check(public.is_admin());
drop policy if exists payment_events_admin_read on public.payment_events;
create policy payment_events_admin_read on public.payment_events for select to authenticated using(public.is_admin());
drop policy if exists refunds_admin_all on public.refunds;
create policy refunds_admin_all on public.refunds for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.place_marketplace_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders;
  v_key uuid;
  v_restaurant record;
  v_item record;
  v_suborder_id uuid;
  v_subtotal integer := 0;
  v_restaurant_subtotal integer;
  v_option_total integer;
  v_line_total integer;
  v_delivery_total integer := 0;
  v_restaurant_fee integer;
  v_discount integer := 0;
  v_promotion public.promotions;
  v_commission_bps integer;
  v_is_official boolean;
  v_selected_count integer;
begin
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'Le panier est vide.'; end if;
  if coalesce(length(trim(payload->>'customer_name')),0) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if coalesce(length(regexp_replace(payload->>'customer_phone','[^0-9]','','g')),0) < 8 then raise exception 'Indiquez un numéro de téléphone valide.'; end if;
  v_key := (payload->>'idempotency_key')::uuid;
  select * into v_order from public.orders where checkout_idempotency_key=v_key;
  if v_order.id is not null then
    return jsonb_build_object('id',v_order.id,'reference',v_order.reference,'total',v_order.total,'tracking_token',v_order.public_tracking_token,'reused',true);
  end if;

  insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,address,commune,customer_note,wants_cutlery,payment_method,subtotal,delivery_fee,discount_total,total,checkout_idempotency_key)
  values('CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),auth.uid(),trim(payload->>'customer_name'),trim(payload->>'customer_phone'),nullif(trim(payload->>'customer_email'),''),(payload->>'fulfillment')::public.fulfillment_type,nullif(trim(payload->>'address'),''),nullif(trim(payload->>'commune'),''),nullif(trim(payload->>'customer_note'),''),coalesce((payload->>'wants_cutlery')::boolean,false),'wave',0,0,0,0,v_key)
  returning * into v_order;

  for v_restaurant in
    select distinct r.id,r.is_official
    from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb)
    join public.products p on p.id=requested.product_id
    join public.restaurants r on r.id=p.restaurant_id
  loop
    if not exists(select 1 from public.restaurants r where r.id=v_restaurant.id and r.validation_status='approved' and r.operating_status='open' and r.archived_at is null) then
      raise exception 'Un restaurant ne prend pas de nouvelles commandes actuellement.';
    end if;
    v_restaurant_subtotal:=0;
    insert into public.restaurant_orders(order_id,restaurant_id,subtotal,status) values(v_order.id,v_restaurant.id,0,'pending') returning id into v_suborder_id;
    for v_item in
      select requested.product_id,requested.quantity,coalesce(requested.options,'[]'::jsonb) options,p.name,p.base_price,p.category_id
      from jsonb_to_recordset(payload->'items') requested(product_id uuid,quantity integer,options jsonb)
      join public.products p on p.id=requested.product_id
      where p.restaurant_id=v_restaurant.id
    loop
      if v_item.quantity < 1 or v_item.quantity > 50 then raise exception 'Quantité invalide.'; end if;
      if not exists(select 1 from public.products p where p.id=v_item.product_id and p.availability and not p.is_archived and not p.hidden_by_admin and p.moderation_status='approved') then raise exception 'Un produit du panier n’est plus disponible.'; end if;
      if exists(select 1 from jsonb_array_elements_text(v_item.options) x(id) left join public.product_options po on po.id=x.id::uuid left join public.product_option_groups g on g.id=po.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=v_item.product_id where po.id is null or not po.is_available or not g.is_active or l.product_id is null) then raise exception 'Une option sélectionnée n’est plus disponible.'; end if;
      for v_selected_count in select count(*) from jsonb_array_elements_text(v_item.options) loop null; end loop;
      if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id left join lateral(select count(*) c from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid and po.group_id=g.id) s on true where l.product_id=v_item.product_id and (s.c < g.min_choices or (g.max_choices is not null and s.c > g.max_choices))) then raise exception 'Les choix d’options ne respectent pas les règles du produit.'; end if;
      select coalesce(sum(po.price_delta),0)::integer into v_option_total from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid;
      v_line_total:=(v_item.base_price+v_option_total)*v_item.quantity;
      v_restaurant_subtotal:=v_restaurant_subtotal+v_line_total;
      insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total)
      select v_suborder_id,v_item.product_id,v_item.name,v_item.quantity,v_item.base_price,coalesce(jsonb_agg(jsonb_build_object('id',po.id,'name',po.name,'price',po.price_delta)),'[]'::jsonb),v_line_total from jsonb_array_elements_text(v_item.options) x join public.product_options po on po.id=x::uuid;
    end loop;
    if (payload->>'fulfillment')='delivery' then
      select fee into v_restaurant_fee from public.delivery_zones where id=(payload->>'delivery_zone_id')::uuid and is_active and (restaurant_id is null or restaurant_id=v_restaurant.id) order by restaurant_id nulls last limit 1;
      if v_restaurant_fee is null then raise exception 'Cette zone de livraison n’est pas disponible pour un restaurant du panier.'; end if;
    else v_restaurant_fee:=0; end if;
    v_is_official:=v_restaurant.is_official;
    select nullif(value->>'rate_bps','')::integer into v_commission_bps from public.site_settings where key='marketplace_commission';
    if v_is_official then v_commission_bps:=0; end if;
    update public.restaurant_orders set subtotal=v_restaurant_subtotal,delivery_fee=v_restaurant_fee,gross_amount=v_restaurant_subtotal,commission_rate_bps=v_commission_bps,platform_commission=case when v_commission_bps is null then null else round(v_restaurant_subtotal*v_commission_bps/10000.0)::integer end,seller_net_amount=case when v_commission_bps is null then null else v_restaurant_subtotal-round(v_restaurant_subtotal*v_commission_bps/10000.0)::integer end where id=v_suborder_id;
    v_subtotal:=v_subtotal+v_restaurant_subtotal;v_delivery_total:=v_delivery_total+v_restaurant_fee;
  end loop;
  if v_subtotal=0 then raise exception 'Aucun produit disponible dans ce panier.'; end if;

  if nullif(trim(payload->>'promotion_code'),'') is not null then
    select * into v_promotion from public.promotions where upper(code)=upper(trim(payload->>'promotion_code')) and is_active and archived_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and scope='platform' limit 1;
    if v_promotion.id is null then raise exception 'Ce code promotionnel n’est pas valide.'; end if;
    v_discount:=case when v_promotion.discount_type='percent' then least(v_subtotal,round(v_subtotal*v_promotion.value/100.0)::integer) else least(v_subtotal,v_promotion.value) end;
  end if;
  update public.orders set subtotal=v_subtotal,delivery_fee=v_delivery_total,discount_total=v_discount,total=greatest(0,v_subtotal+v_delivery_total-v_discount),promotion_id=v_promotion.id,promotion_code=nullif(trim(payload->>'promotion_code'),'') where id=v_order.id returning * into v_order;
  insert into public.payment_attempts(order_id,provider,idempotency_key,amount,currency,status,metadata) values(v_order.id,'wave_payment_link',v_key,v_order.total,'XOF','pending',jsonb_build_object('source','checkout'));
  return jsonb_build_object('id',v_order.id,'reference',v_order.reference,'total',v_order.total,'tracking_token',v_order.public_tracking_token,'reused',false);
exception when others then
  raise;
end$$;

create or replace function public.get_public_order_status(order_reference text, tracking_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('reference',o.reference,'total',o.total,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'discount_total',o.discount_total,'payment_status',o.payment_status,'created_at',o.created_at,'statuses',coalesce((select jsonb_agg(ro.status order by ro.created_at) from public.restaurant_orders ro where ro.order_id=o.id),'[]'::jsonb))
 from public.orders o where o.reference=order_reference and o.public_tracking_token=tracking_token;
$$;

revoke all on function public.get_public_order_status(text,uuid) from public;
grant execute on function public.get_public_order_status(text,uuid) to anon,authenticated;
revoke all on function public.place_marketplace_order(jsonb) from public;
grant execute on function public.place_marketplace_order(jsonb) to anon,authenticated;
grant select on public.payment_attempts,public.payment_events,public.refunds to authenticated;
