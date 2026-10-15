create table public.platform_delivery_hours(
 day_of_week smallint primary key check(day_of_week between 0 and 6),opens_at time,closes_at time,is_closed boolean not null default true,
 check(is_closed or opens_at is not null and closes_at is not null and opens_at<>closes_at)
);
alter table public.platform_delivery_hours enable row level security;
create policy delivery_hours_public_read on public.platform_delivery_hours for select using(true);
revoke all on public.platform_delivery_hours from anon,authenticated;
grant select on public.platform_delivery_hours to anon,authenticated;

create function public.platform_fulfillment_available(mode text,at_time timestamptz,require_hours boolean default false)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare setting jsonb;moment timestamp;day integer;clock time;today public.platform_delivery_hours;yesterday public.platform_delivery_hours;
begin
 if mode is null or mode not in ('delivery','pickup') or at_time is null then return false;end if;
 select value into setting from public.site_settings where key='platform';
 if setting->>'ordering_enabled'='false' or mode='delivery' and setting->>'delivery_enabled'='false' or mode='pickup' and setting->>'pickup_enabled'='false' then return false;end if;
 if mode='pickup' then return true;end if;
 if not exists(select 1 from public.platform_delivery_hours) then return not require_hours;end if;
 moment:=at_time at time zone 'Africa/Abidjan';day:=extract(dow from moment)::integer;clock:=moment::time;
 select * into today from public.platform_delivery_hours where day_of_week=day;
 select * into yesterday from public.platform_delivery_hours where day_of_week=(day+6)%7;
 return coalesce(not today.is_closed and ((today.opens_at<today.closes_at and clock>=today.opens_at and clock<today.closes_at) or (today.opens_at>today.closes_at and clock>=today.opens_at)),false)
 or coalesce(not yesterday.is_closed and yesterday.opens_at>yesterday.closes_at and clock<yesterday.closes_at,false);
end $$;
revoke all on function public.platform_fulfillment_available(text,timestamptz,boolean) from public;
grant execute on function public.platform_fulfillment_available(text,timestamptz,boolean) to anon,authenticated;

create function public.save_platform_delivery_hours(hours jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare row jsonb;day integer;opening time;closing time;closed boolean;
begin
 if not public.has_platform_permission('delivery.operate') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(hours) is distinct from 'array' or jsonb_array_length(hours)<>7 then raise exception 'INVALID_HOURS';end if;
 if (select count(distinct (value->>'day')::integer) from jsonb_array_elements(hours))<>7 then raise exception 'INVALID_HOURS';end if;
 perform pg_advisory_xact_lock(715,11);
 for row in select value from jsonb_array_elements(hours) loop
  day:=(row->>'day')::integer;closed:=(row->>'closed')::boolean;opening:=nullif(row->>'opens','')::time;closing:=nullif(row->>'closes','')::time;
  if day is null or day not between 0 and 6 or closed is null or not closed and (opening is null or closing is null or opening=closing) then raise exception 'INVALID_HOURS';end if;
  insert into public.platform_delivery_hours values(day,opening,closing,closed) on conflict(day_of_week) do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed;
 end loop;
 insert into public.platform_audit_events(actor_id,action,details) values(auth.uid(),'delivery.hours_updated',jsonb_build_object('days',7));
end $$;
revoke all on function public.save_platform_delivery_hours(jsonb) from public,anon;
grant execute on function public.save_platform_delivery_hours(jsonb) to authenticated;
create function public.confirm_scheduled_meal(target uuid,expected_total integer,customer_label text,phone text)
returns uuid language plpgsql security definer set search_path=public as $$
declare meal public.scheduled_meals;plan public.meal_plans;product public.products;
 result uuid;suborder uuid;amount integer;extras integer;rate integer;commission integer;lead_minutes integer;fee integer:=0;zone_name text;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select mp.* into plan from public.meal_plans mp join public.scheduled_meals sm on sm.plan_id=mp.id
 where sm.id=target and mp.user_id=auth.uid() for update of mp;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into meal from public.scheduled_meals where id=target for update;
 if meal.order_id is not null then return meal.order_id;end if;
 if plan.status<>'draft' or meal.status<>'requested' then raise exception 'NOT_EDITABLE';end if;
 if meal.subscription_id is not null then raise exception 'SUBSCRIPTION_SETTLEMENT_NOT_READY';end if;

 if length(trim(coalesce(customer_label,''))) not between 2 and 100 or phone is null or phone !~ '^\+?[0-9 ()-]+$'
 or length(regexp_replace(phone,'[^0-9]','','g')) not between 8 and 15 then raise exception 'INVALID_CONTACT';end if;
 select coalesce((value->>'minimum_lead_minutes')::integer,120) into lead_minutes from public.site_settings where key='scheduling';
 if meal.scheduled_at<now()+make_interval(mins=>greatest(coalesce(lead_minutes,120),0)) then raise exception 'TOO_LATE';end if;
 if not public.platform_fulfillment_available(meal.fulfillment,meal.scheduled_at,true) then raise exception 'PLATFORM_CLOSED';end if;
 if not public.restaurant_is_open(meal.restaurant_id,meal.scheduled_at) or not exists(select 1 from public.restaurants where id=meal.restaurant_id and (meal.fulfillment='pickup' and pickup_available or meal.fulfillment='delivery' and delivery_available)) then raise exception 'RESTAURANT_UNAVAILABLE';end if;
 if meal.fulfillment='delivery' then
  if length(trim(coalesce(meal.address,'')))<3 then raise exception 'INVALID_ADDRESS';end if;
  select z.fee,z.name into fee,zone_name from public.delivery_zones z where z.id=meal.zone_id and z.is_active and z.restaurant_id is null for share;
  if fee is null then raise exception 'INVALID_ZONE';end if;
 end if;
 select * into product from public.products where id=meal.product_id and restaurant_id=meal.restaurant_id and availability and not is_archived and not hidden_by_admin and moderation_status='approved' for share;
 if not found then raise exception 'PRODUCT_UNAVAILABLE';end if;
 if exists(select 1 from unnest(meal.option_ids) s(id) left join public.product_options o on o.id=s.id left join public.product_option_groups g on g.id=o.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=product.id where o.id is null or not o.is_available or not g.is_active or l.product_id is null) then raise exception 'INVALID_OPTION';end if;
 if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id where l.product_id=product.id and g.is_active and ((select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)<g.min_choices or (g.max_choices is not null and (select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)>g.max_choices))) then raise exception 'OPTION_RULES';end if;
 select coalesce(sum(price_delta),0) into extras from public.product_options where id=any(meal.option_ids);
 amount:=((product.base_price::bigint+extras)*meal.quantity)::integer;
 if expected_total is null or amount+fee<>expected_total then raise exception 'PRICE_CHANGED';end if;
 select coalesce((value->>'rate_bps')::integer,0) into rate from public.site_settings where key='marketplace_commission';rate:=coalesce(rate,0);
 if exists(select 1 from public.restaurants where id=meal.restaurant_id and is_official) then rate:=0;end if;
 if rate not between 0 and 10000 then raise exception 'INVALID_COMMISSION';end if;
 commission:=round(amount::numeric*rate/10000)::integer;
 insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,address,commune,payment_method,subtotal,delivery_fee,discount_total,total,checkout_idempotency_key,scheduled_for)
 values('CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid(),trim(customer_label),trim(phone),(select email from auth.users where id=auth.uid() and email_confirmed_at is not null),meal.fulfillment::public.fulfillment_type,meal.address,zone_name,plan.payment_method,amount,fee,0,amount+fee,meal.id,meal.scheduled_at) returning id into result;
 insert into public.restaurant_orders(order_id,restaurant_id,subtotal,delivery_fee,status,payment_status,gross_amount,commission_rate_bps,platform_commission,seller_net_amount)
 values(result,meal.restaurant_id,amount,fee,'pending','pending',amount,rate,commission,amount-commission) returning id into suborder;
 insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total)
 select suborder,product.id,product.name,meal.quantity,product.base_price,coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price_delta)),'[]'::jsonb),amount from public.product_options o where o.id=any(meal.option_ids);
 if plan.payment_method='wave' then
 insert into public.payment_attempts(order_id,provider,idempotency_key,amount,currency,status,metadata)
 values(result,'wave_payment_link',meal.id,amount+fee,'XOF','pending',jsonb_build_object('source','scheduled_meal','meal_id',meal.id));end if;
 update public.scheduled_meals set order_id=result,estimated_subtotal=amount,estimated_delivery=fee,commission_rate_bps=rate where id=meal.id;
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(meal.id,auth.uid(),meal.status,meal.status,'Commande programmée créée. Disponibilité à confirmer, paiement non confirmé.');
 return result;
end $$;
revoke all on function public.confirm_scheduled_meal(uuid,integer,text,text) from public,anon;
grant execute on function public.confirm_scheduled_meal(uuid,integer,text,text) to authenticated;
create or replace function public.confirm_scheduled_pickup(target uuid,expected_total integer,customer_label text,phone text) returns uuid language sql security definer set search_path=public as $$select public.confirm_scheduled_meal(target,expected_total,customer_label,phone)$$;
create or replace function public.schedule_meal(payload jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.products; plan public.meal_plans; subscription public.customer_subscriptions;
 scheduled timestamptz; qty integer; options uuid[]; option_total integer; fee integer:=0; result uuid; lead_minutes integer; used integer; rate integer;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select m.id into result from public.scheduled_meals m join public.meal_plans mp on mp.id=m.plan_id where m.idempotency_key=(payload->>'key')::uuid and mp.user_id=auth.uid();
 if found then return result; end if;
 select * into plan from public.meal_plans where id=(payload->>'plan_id')::uuid and user_id=auth.uid() and status='draft' for update;
 if not found then raise exception 'PLAN_NOT_EDITABLE'; end if;
 select m.id into result from public.scheduled_meals m where m.idempotency_key=(payload->>'key')::uuid and m.plan_id=plan.id;
 if found then return result; end if;
 scheduled:=(payload->>'scheduled_at')::timestamptz;qty:=(payload->>'quantity')::integer;
 select coalesce((value->>'minimum_lead_minutes')::integer,120) into lead_minutes from public.site_settings where key='scheduling';lead_minutes:=coalesce(lead_minutes,120);
 if scheduled is null or qty is null or scheduled<now()+make_interval(mins=>greatest(lead_minutes,0)) or scheduled>now()+interval '90 days' or qty not between 1 and 50 then raise exception 'INVALID_SCHEDULE'; end if;
 if not public.platform_fulfillment_available(payload->>'fulfillment',scheduled,true) then raise exception 'DELIVERY_UNAVAILABLE';end if;
 select * into p from public.products where id=(payload->>'product_id')::uuid and availability and not is_archived and not hidden_by_admin and moderation_status='approved';
 if not found or not public.restaurant_is_open(p.restaurant_id,scheduled) then raise exception 'RESTAURANT_UNAVAILABLE'; end if;
 options:=array(select distinct value::uuid from jsonb_array_elements_text(coalesce(payload->'option_ids','[]')));
 if exists(select 1 from unnest(options) selected(option_id) left join public.product_options o on o.id=selected.option_id left join public.product_option_groups g on g.id=o.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=p.id where o.id is null or not o.is_available or not g.is_active or l.product_id is null) then raise exception 'INVALID_OPTION'; end if;
 if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id where l.product_id=p.id and g.is_active and ((select count(*) from public.product_options o where o.id=any(options) and o.group_id=g.id)<g.min_choices or (g.max_choices is not null and (select count(*) from public.product_options o where o.id=any(options) and o.group_id=g.id)>g.max_choices))) then raise exception 'OPTION_RULES'; end if;
 select coalesce(sum(price_delta),0) into option_total from public.product_options where id=any(options);
 if payload->>'fulfillment'='delivery' then
  if not exists(select 1 from public.restaurants where id=p.restaurant_id and delivery_available) or length(trim(coalesce(payload->>'address','')))<3 then raise exception 'DELIVERY_UNAVAILABLE'; end if;
  select z.fee into fee from public.delivery_zones z where z.id=(payload->>'zone_id')::uuid and z.is_active and z.restaurant_id is null;
  if fee is null then raise exception 'INVALID_ZONE'; end if;
 elsif payload->>'fulfillment'<>'pickup' or not exists(select 1 from public.restaurants where id=p.restaurant_id and pickup_available) then raise exception 'INVALID_FULFILLMENT'; end if;
 if nullif(payload->>'subscription_id','') is not null then
  select * into subscription from public.customer_subscriptions where id=(payload->>'subscription_id')::uuid and user_id=auth.uid() for update;
  if not found or subscription.status<>'active' or subscription.paid_at is null or scheduled>=subscription.expires_at then raise exception 'SUBSCRIPTION_INACTIVE'; end if;
  if not exists(select 1 from public.subscription_product_entitlements where subscription_id=subscription.id and product_id=p.id) then raise exception 'NOT_ELIGIBLE'; end if;
  select coalesce(sum(meals),0) into used from public.subscription_consumptions where subscription_id=subscription.id and status in ('reserved','consumed');
  if used+qty>subscription.meal_count then raise exception 'QUOTA_EXCEEDED'; end if;
 end if;
 select coalesce((value->>'rate_bps')::integer,0) into rate from public.site_settings where key='marketplace_commission';rate:=coalesce(rate,0);
 if exists(select 1 from public.restaurants where id=p.restaurant_id and is_official) then rate:=0; end if;
 insert into public.scheduled_meals(plan_id,restaurant_id,product_id,scheduled_at,quantity,option_ids,fulfillment,zone_id,address,estimated_subtotal,estimated_delivery,commission_rate_bps,subscription_id,idempotency_key)
 values(plan.id,p.restaurant_id,p.id,scheduled,qty,options,payload->>'fulfillment',nullif(payload->>'zone_id','')::uuid,payload->>'address',(case when subscription.id is not null then subscription.unit_price else p.base_price end+option_total)*qty,fee,rate,subscription.id,(payload->>'key')::uuid) returning id into result;
 if subscription.id is not null then insert into public.subscription_consumptions(subscription_id,meal_id,meals) values(subscription.id,result,qty);end if;
 return result;
end $$;
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

  if not public.platform_fulfillment_available(payload->>'fulfillment',now(),false) then raise exception 'La livraison ou le retrait est fermé pour le moment.';end if;
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

create or replace function public.enqueue_due_scheduled_pickups() returns integer
language plpgsql security definer set search_path=public as $$
declare queued integer;
begin
 update public.v2_notification_jobs j set status='cancelled' where j.event_type='scheduled_order_ready' and j.status in ('pending','failed')
 and not exists(select 1 from public.restaurant_orders ro join public.orders o on o.id=ro.order_id join public.restaurants r on r.id=ro.restaurant_id where ro.id::text=j.payload->>'restaurantOrderId' and ro.status in ('pending','confirmed') and (o.payment_method='cash' or ro.payment_status='paid') and r.email=j.recipient);
 insert into public.v2_notification_jobs(event_key,event_type,recipient,payload)
 select 'scheduled-ready-'||ro.id,'scheduled_order_ready',r.email,
 jsonb_build_object('restaurantOrderId',ro.id,'name',r.name,'reference',o.reference,'scheduledAt',to_char(o.scheduled_for at time zone 'Africa/Abidjan','DD/MM/YYYY HH24:MI'))
 from public.restaurant_orders ro join public.orders o on o.id=ro.order_id join public.restaurants r on r.id=ro.restaurant_id
 where o.scheduled_for between now()-interval '15 minutes' and now()+interval '2 hours'
 and ro.status in ('pending','confirmed') and (o.payment_method='cash' or ro.payment_status='paid')
 and public.platform_fulfillment_available(o.fulfillment::text,o.scheduled_for,true) and public.restaurant_is_open(r.id,o.scheduled_for) and r.email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
 and not exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.restaurant_order_id=ro.id and (not p.availability or p.is_archived or p.hidden_by_admin or p.moderation_status<>'approved'))
 order by o.scheduled_for limit 100 on conflict(event_key) do nothing;
 get diagnostics queued=row_count;return queued;
end $$;
