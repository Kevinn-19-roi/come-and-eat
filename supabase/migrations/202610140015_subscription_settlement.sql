-- Prepaid receipts and meal value are separate: serving a prepaid meal is not
-- a second receipt. Only options/delivery not covered by credit remain payable.
alter table public.orders add column subscription_credit integer not null default 0 check(subscription_credit>=0 and subscription_credit<=subtotal),
 add column amount_due integer generated always as (greatest(total-subscription_credit,0)) stored;
alter table public.restaurant_orders add column subscription_credit integer not null default 0 check(subscription_credit>=0 and subscription_credit<=subtotal);

create table public.subscription_receipts(
 subscription_id uuid primary key references public.customer_subscriptions(id) on delete restrict,
 amount integer not null check(amount>=0),confirmed_at timestamptz not null,
 confirmed_by uuid references public.profiles(id),method text not null default 'wave' check(method='wave')
);
alter table public.subscription_receipts enable row level security;
create policy subscription_receipts_read on public.subscription_receipts for select to authenticated using(
 public.has_platform_permission('finance.read') or public.has_platform_permission('subscriptions.manage')
 or exists(select 1 from public.customer_subscriptions s where s.id=subscription_id and s.user_id=auth.uid())
);
revoke all on public.subscription_receipts from public,anon,authenticated;
grant select on public.subscription_receipts to authenticated;
insert into public.subscription_receipts(subscription_id,amount,confirmed_at,confirmed_by)
 select id,total,paid_at,paid_by from public.customer_subscriptions where paid_at is not null;

create function public.record_subscription_receipt() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.paid_at is not null then
  insert into public.subscription_receipts(subscription_id,amount,confirmed_at,confirmed_by)
   values(new.id,new.total,new.paid_at,new.paid_by) on conflict(subscription_id) do nothing;
 end if;
 return new;
end $$;
create trigger subscription_receipt after insert or update of paid_at on public.customer_subscriptions for each row execute function public.record_subscription_receipt();

create function public.protect_subscription_credit() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.subscription_credit is distinct from old.subscription_credit then raise exception 'IMMUTABLE_SUBSCRIPTION_CREDIT';end if;
 return new;
end $$;
create trigger orders_subscription_credit_immutable before update on public.orders for each row execute function public.protect_subscription_credit();
create trigger restaurant_orders_subscription_credit_immutable before update on public.restaurant_orders for each row execute function public.protect_subscription_credit();

create function public.settle_subscription_quota() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='completed' then update public.subscription_consumptions set status='consumed' where meal_id=new.id and status='reserved';
 elsif new.status='cancelled' then update public.subscription_consumptions set status='released' where meal_id=new.id and status='reserved';end if;
 return new;
end $$;
create trigger subscription_quota_settlement after update of status on public.scheduled_meals for each row execute function public.settle_subscription_quota();

create function public.subscription_reconciliation(target uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s public.customer_subscriptions;reserved integer;consumed integer;receipt integer;
begin
 select * into s from public.customer_subscriptions where id=target;
 if not found or not (s.user_id=auth.uid() or public.has_platform_permission('finance.read') or public.has_platform_permission('subscriptions.manage')) then raise exception 'FORBIDDEN';end if;
 select coalesce(sum(meals) filter(where status='reserved'),0),coalesce(sum(meals) filter(where status='consumed'),0) into reserved,consumed from public.subscription_consumptions where subscription_id=target;
 select amount into receipt from public.subscription_receipts where subscription_id=target;
 return jsonb_build_object('receipts',coalesce(receipt,0),'reserved_meals',reserved,'consumed_meals',consumed,
 'remaining_meals',greatest(s.meal_count-reserved-consumed,0),'served_value',consumed*s.unit_price,
 'prepaid_unserved',greatest(coalesce(receipt,0)-consumed*s.unit_price,0),'status',case when s.status='active' and s.expires_at<=now() then 'expired' else s.status end);
end $$;
revoke all on function public.subscription_reconciliation(uuid) from public,anon;
grant execute on function public.subscription_reconciliation(uuid) to authenticated;
create function public.subscription_balances()
returns table(subscription_id uuid,reconciliation jsonb) language sql stable security definer set search_path=public,pg_temp as $$
 select s.id,public.subscription_reconciliation(s.id) from public.customer_subscriptions s
 where s.user_id=auth.uid() or public.has_platform_permission('subscriptions.manage') or public.has_platform_permission('finance.read')
 order by s.created_at desc limit 100
$$;
revoke all on function public.subscription_balances() from public,anon;
grant execute on function public.subscription_balances() to authenticated;

create function public.cancel_subscription(target uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.customer_subscriptions;
begin
 select * into s from public.customer_subscriptions where id=target;
 if not found or not (s.user_id=auth.uid() or public.has_platform_permission('refund.approve')) then raise exception 'FORBIDDEN';end if;
 perform p.id from public.meal_plans p where exists(select 1 from public.scheduled_meals m where m.plan_id=p.id and m.subscription_id=target) order by p.id for update;
 perform m.id from public.scheduled_meals m where m.subscription_id=target order by m.id for update;
 select * into s from public.customer_subscriptions where id=target for update;
 if not found or not (s.user_id=auth.uid() or public.has_platform_permission('refund.approve')) then raise exception 'FORBIDDEN';end if;
 if s.status='cancelled' then return;end if;
 if s.paid_at is not null and not public.has_platform_permission('refund.approve') then raise exception 'CONTACT_SUPPORT';end if;
 if exists(select 1 from public.scheduled_meals where subscription_id=target and order_id is not null and status not in ('completed','cancelled')) then raise exception 'ACTIVE_ORDERS';end if;
 update public.scheduled_meals set status='cancelled' where subscription_id=target and order_id is null and status='requested';
 update public.customer_subscriptions set status='cancelled' where id=target;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'subscription.cancelled',target,jsonb_build_object('refund_executed',false));
end $$;
revoke all on function public.cancel_subscription(uuid) from public,anon;
grant execute on function public.cancel_subscription(uuid) to authenticated;

create function public.expire_subscriptions() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN';end if;
 perform p.id from public.meal_plans p where exists(select 1 from public.scheduled_meals m join public.customer_subscriptions s on s.id=m.subscription_id where m.plan_id=p.id and s.status='active' and s.expires_at<=now()) order by p.id for update;
 perform m.id from public.scheduled_meals m join public.customer_subscriptions s on s.id=m.subscription_id where s.status='active' and s.expires_at<=now() order by m.id for update of m;
 update public.customer_subscriptions set status='expired' where status='active' and expires_at<=now();get diagnostics changed=row_count;
 update public.scheduled_meals m set status='cancelled' from public.customer_subscriptions s where m.subscription_id=s.id and s.status='expired' and m.order_id is null and m.status='requested';
 return changed;
end $$;
revoke all on function public.expire_subscriptions() from public,anon,authenticated;
grant execute on function public.expire_subscriptions() to service_role;
revoke all on function public.record_subscription_receipt(),public.protect_subscription_credit(),public.settle_subscription_quota() from public,anon,authenticated;
create or replace function public.admin_statistics_summary(period_start timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public,pg_temp
as $$
declare result jsonb;
begin
  if not public.has_platform_permission('finance.read') then raise exception 'ADMIN_REQUIRED'; end if;

  with allocated as (
    select
      o.id as order_id,
      ro.id as restaurant_order_id,
      ro.status,
      ro.payment_status,
      ro.subscription_credit,
      coalesce(ro.gross_amount, ro.subtotal, 0) as gross_amount,
      coalesce(ro.delivery_fee, 0) as delivery_fee,
      coalesce(ro.platform_commission, 0) as platform_commission,
      coalesce(ro.seller_net_amount, ro.subtotal, 0) as seller_net_amount,
      coalesce(floor(
        coalesce(o.discount_total, 0)::numeric
        * coalesce(ro.subtotal, 0)
        / nullif(o.subtotal, 0)
      )::integer, 0) as discount_floor,
      row_number() over (partition by o.id order by ro.id) as allocation_rank,
      coalesce(o.discount_total, 0) - sum(
        coalesce(floor(
          coalesce(o.discount_total, 0)::numeric
          * coalesce(ro.subtotal, 0)
          / nullif(o.subtotal, 0)
        )::integer, 0)
      ) over (partition by o.id) as discount_remainder
    from public.orders o
    join public.restaurant_orders ro on ro.order_id = o.id
    where o.created_at >= period_start
  ), recognized as (
    select
      *,
      discount_floor + case when allocation_rank <= discount_remainder then 1 else 0 end as discount_share
    from allocated
    where payment_status = 'paid' and status <> 'cancelled'
  )
  select jsonb_build_object(
    'orders', (select count(*) from public.orders where created_at >= period_start),
    'revenue', coalesce(sum(greatest(0,gross_amount + delivery_fee - discount_share - subscription_credit)), 0),
    'platform_commission', coalesce(sum(platform_commission), 0),
    'seller_net_amount', coalesce(sum(seller_net_amount), 0)
  )
  into result
  from recognized;

  return result;
end;
$$;
create or replace function public.get_public_order_status(order_reference text, tracking_token uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'subscription_credit',o.subscription_credit,'amount_due',o.amount_due,'reference',o.reference,'total',o.total,'subtotal',o.subtotal,'delivery_fee',o.delivery_fee,'discount_total',o.discount_total,
  'payment_method',o.payment_method,'payment_status',o.payment_status,'fulfillment',o.fulfillment,'address',o.address,'commune',o.commune,'customer_note',o.customer_note,'created_at',o.created_at,
  'restaurant_orders',coalesce((select jsonb_agg(jsonb_build_object(
    'subscription_credit',ro.subscription_credit,'id',ro.id,'status',ro.status,'payment_status',ro.payment_status,'subtotal',ro.subtotal,'delivery_fee',ro.delivery_fee,'restaurant',jsonb_build_object('name',r.name),
    'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'options',oi.options,'line_total',oi.line_total) order by oi.id) from public.order_items oi where oi.restaurant_order_id=ro.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at) order by e.created_at) from public.order_status_events e where e.restaurant_order_id=ro.id),'[]'::jsonb)
  ) order by ro.created_at) from public.restaurant_orders ro join public.restaurants r on r.id=ro.restaurant_id where ro.order_id=o.id),'[]'::jsonb)
 ) from public.orders o where o.reference=order_reference and o.public_tracking_token=tracking_token;
$$;
create or replace function public.confirm_scheduled_meal(target uuid,expected_total integer,customer_label text,phone text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare meal public.scheduled_meals;plan public.meal_plans;product public.products;
 result uuid;suborder uuid;amount integer;extras integer;rate integer;commission integer;lead_minutes integer;fee integer:=0;zone_name text;subscription public.customer_subscriptions;credit integer:=0;due integer;unit integer;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select mp.* into plan from public.meal_plans mp join public.scheduled_meals sm on sm.plan_id=mp.id
 where sm.id=target and mp.user_id=auth.uid() for update of mp;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into meal from public.scheduled_meals where id=target for update;
 if meal.order_id is not null then return meal.order_id;end if;
 if plan.status<>'draft' or meal.status<>'requested' then raise exception 'NOT_EDITABLE';end if;
 if meal.subscription_id is not null then
 select * into subscription from public.customer_subscriptions where id=meal.subscription_id and user_id=auth.uid() for update;
 if not found or subscription.status<>'active' or subscription.paid_at is null or meal.scheduled_at<subscription.starts_at or meal.scheduled_at>=subscription.expires_at then raise exception 'SUBSCRIPTION_INACTIVE';end if;
 if not exists(select 1 from public.subscription_product_entitlements where subscription_id=subscription.id and product_id=meal.product_id)
 or not exists(select 1 from public.subscription_consumptions where subscription_id=subscription.id and meal_id=meal.id and status='reserved' and meals=meal.quantity) then raise exception 'INVALID_ENTITLEMENT';end if;
 credit:=subscription.unit_price*meal.quantity;
 end if;

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
  if exists(select 1 from public.scheduled_meals previous join public.restaurant_orders ro on ro.order_id=previous.order_id and ro.restaurant_id=previous.restaurant_id
   where previous.plan_id=plan.id and previous.scheduled_at=meal.scheduled_at and previous.restaurant_id=meal.restaurant_id and previous.fulfillment=meal.fulfillment
   and previous.zone_id is not distinct from meal.zone_id and previous.address is not distinct from meal.address and ro.delivery_fee>0 and ro.status<>'cancelled') then fee:=0;end if;
 end if;
 select * into product from public.products where id=meal.product_id and restaurant_id=meal.restaurant_id and availability and not is_archived and not hidden_by_admin and moderation_status='approved' for share;
 if not found then raise exception 'PRODUCT_UNAVAILABLE';end if;
 if exists(select 1 from unnest(meal.option_ids) s(id) left join public.product_options o on o.id=s.id left join public.product_option_groups g on g.id=o.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=product.id where o.id is null or not o.is_available or not g.is_active or l.product_id is null) then raise exception 'INVALID_OPTION';end if;
 if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id where l.product_id=product.id and g.is_active and ((select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)<g.min_choices or (g.max_choices is not null and (select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)>g.max_choices))) then raise exception 'OPTION_RULES';end if;
 select coalesce(sum(price_delta),0) into extras from public.product_options where id=any(meal.option_ids);
 unit:=coalesce(subscription.unit_price,product.base_price);amount:=((unit::bigint+extras)*meal.quantity)::integer;due:=amount+fee-credit;
 if expected_total is null or amount+fee<>expected_total then raise exception 'PRICE_CHANGED';end if;
 select coalesce((value->>'rate_bps')::integer,0) into rate from public.site_settings where key='marketplace_commission';rate:=coalesce(rate,0);
 if exists(select 1 from public.restaurants where id=meal.restaurant_id and is_official) then rate:=0;end if;
 if rate not between 0 and 10000 then raise exception 'INVALID_COMMISSION';end if;
 commission:=round(amount::numeric*rate/10000)::integer;
 insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,address,commune,payment_method,subtotal,delivery_fee,discount_total,total,checkout_idempotency_key,scheduled_for,subscription_credit,payment_status)
 values('CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid(),trim(customer_label),trim(phone),(select email from auth.users where id=auth.uid() and email_confirmed_at is not null),meal.fulfillment::public.fulfillment_type,meal.address,zone_name,plan.payment_method,amount,fee,0,amount+fee,meal.id,meal.scheduled_at,credit,(case when due=0 then 'paid' else 'pending' end)::public.payment_status) returning id into result;
 insert into public.restaurant_orders(order_id,restaurant_id,subtotal,delivery_fee,status,payment_status,gross_amount,commission_rate_bps,platform_commission,seller_net_amount,subscription_credit)
 values(result,meal.restaurant_id,amount,fee,'pending',(case when due=0 then 'paid' else 'pending' end)::public.payment_status,amount,rate,commission,amount-commission,credit) returning id into suborder;
 insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total)
 select suborder,product.id,product.name,meal.quantity,unit,coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price_delta)),'[]'::jsonb),amount from public.product_options o where o.id=any(meal.option_ids);
 if plan.payment_method='wave' and due>0 then
 insert into public.payment_attempts(order_id,provider,idempotency_key,amount,currency,status,metadata)
 values(result,'wave_payment_link',meal.id,due,'XOF','pending',jsonb_build_object('source','scheduled_meal','meal_id',meal.id));end if;
 update public.scheduled_meals set order_id=result,estimated_subtotal=amount,estimated_delivery=fee,commission_rate_bps=rate,payment_status=case when due=0 then 'paid' else 'pending' end where id=meal.id;
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(meal.id,auth.uid(),meal.status,meal.status,'Commande programmée créée. Disponibilité à confirmer, paiement non confirmé.');
 return result;
end $$;
