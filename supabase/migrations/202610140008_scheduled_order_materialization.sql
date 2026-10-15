-- First safe materialization path: ordinary scheduled pickup orders.
-- Delivery and subscription settlements remain closed until their financial rules are integrated.
alter table public.orders add column scheduled_for timestamptz;
create unique index scheduled_meals_order_unique on public.scheduled_meals(order_id) where order_id is not null;

create function public.confirm_scheduled_pickup(target uuid,expected_total integer,customer_label text,phone text)
returns uuid language plpgsql security definer set search_path=public as $$
declare meal public.scheduled_meals;plan public.meal_plans;product public.products;
 result uuid;suborder uuid;amount integer;extras integer;rate integer;commission integer;lead_minutes integer;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select mp.* into plan from public.meal_plans mp join public.scheduled_meals sm on sm.plan_id=mp.id
 where sm.id=target and mp.user_id=auth.uid() for update of mp;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into meal from public.scheduled_meals where id=target for update;
 if meal.order_id is not null then return meal.order_id;end if;
 if plan.status<>'draft' or meal.status<>'requested' then raise exception 'NOT_EDITABLE';end if;
 if meal.subscription_id is not null then raise exception 'SUBSCRIPTION_SETTLEMENT_NOT_READY';end if;
 if meal.fulfillment<>'pickup' then raise exception 'SCHEDULED_DELIVERY_NOT_READY';end if;
 if length(trim(coalesce(customer_label,''))) not between 2 and 100 or phone is null or phone !~ '^\+?[0-9 ()-]+$'
 or length(regexp_replace(phone,'[^0-9]','','g')) not between 8 and 15 then raise exception 'INVALID_CONTACT';end if;
 select coalesce((value->>'minimum_lead_minutes')::integer,120) into lead_minutes from public.site_settings where key='scheduling';
 if meal.scheduled_at<now()+make_interval(mins=>greatest(coalesce(lead_minutes,120),0)) then raise exception 'TOO_LATE';end if;
 if exists(select 1 from public.site_settings where key='platform' and (value->>'pickup_enabled'='false' or value->>'ordering_enabled'='false')) then raise exception 'PLATFORM_CLOSED';end if;
 if not public.restaurant_is_open(meal.restaurant_id,meal.scheduled_at) or not exists(select 1 from public.restaurants where id=meal.restaurant_id and pickup_available) then raise exception 'RESTAURANT_UNAVAILABLE';end if;
 select * into product from public.products where id=meal.product_id and restaurant_id=meal.restaurant_id and availability and not is_archived and not hidden_by_admin and moderation_status='approved' for share;
 if not found then raise exception 'PRODUCT_UNAVAILABLE';end if;
 if exists(select 1 from unnest(meal.option_ids) s(id) left join public.product_options o on o.id=s.id left join public.product_option_groups g on g.id=o.group_id left join public.product_option_group_links l on l.group_id=g.id and l.product_id=product.id where o.id is null or not o.is_available or not g.is_active or l.product_id is null) then raise exception 'INVALID_OPTION';end if;
 if exists(select 1 from public.product_option_group_links l join public.product_option_groups g on g.id=l.group_id where l.product_id=product.id and g.is_active and ((select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)<g.min_choices or (g.max_choices is not null and (select count(*) from public.product_options o where o.id=any(meal.option_ids) and o.group_id=g.id)>g.max_choices))) then raise exception 'OPTION_RULES';end if;
 select coalesce(sum(price_delta),0) into extras from public.product_options where id=any(meal.option_ids);
 amount:=((product.base_price::bigint+extras)*meal.quantity)::integer;
 if expected_total is null or amount<>expected_total then raise exception 'PRICE_CHANGED';end if;
 select coalesce((value->>'rate_bps')::integer,0) into rate from public.site_settings where key='marketplace_commission';rate:=coalesce(rate,0);
 if exists(select 1 from public.restaurants where id=meal.restaurant_id and is_official) then rate:=0;end if;
 if rate not between 0 and 10000 then raise exception 'INVALID_COMMISSION';end if;
 commission:=round(amount::numeric*rate/10000)::integer;
 insert into public.orders(reference,customer_user_id,customer_name,customer_phone,customer_email,fulfillment,payment_method,subtotal,delivery_fee,discount_total,total,checkout_idempotency_key,scheduled_for)
 values('CEA-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),auth.uid(),trim(customer_label),trim(phone),(select email from auth.users where id=auth.uid() and email_confirmed_at is not null),'pickup',plan.payment_method,amount,0,0,amount,meal.id,meal.scheduled_at) returning id into result;
 insert into public.restaurant_orders(order_id,restaurant_id,subtotal,delivery_fee,status,payment_status,gross_amount,commission_rate_bps,platform_commission,seller_net_amount)
 values(result,meal.restaurant_id,amount,0,'pending','pending',amount,rate,commission,amount-commission) returning id into suborder;
 insert into public.order_items(restaurant_order_id,product_id,product_name,quantity,unit_price,options,line_total)
 select suborder,product.id,product.name,meal.quantity,product.base_price,coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'price',o.price_delta)),'[]'::jsonb),amount from public.product_options o where o.id=any(meal.option_ids);
 if plan.payment_method='wave' then
 insert into public.payment_attempts(order_id,provider,idempotency_key,amount,currency,status,metadata)
 values(result,'wave_payment_link',meal.id,amount,'XOF','pending',jsonb_build_object('source','scheduled_pickup','meal_id',meal.id));end if;
 update public.scheduled_meals set order_id=result,estimated_subtotal=amount,estimated_delivery=0,commission_rate_bps=rate where id=meal.id;
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(meal.id,auth.uid(),meal.status,meal.status,'Commande de retrait créée. Disponibilité à confirmer, paiement non confirmé.');
 return result;
end $$;
revoke all on function public.confirm_scheduled_pickup(uuid,integer,text,text) from public,anon;
grant execute on function public.confirm_scheduled_pickup(uuid,integer,text,text) to authenticated;

-- Enforce timing/payment even through older RPCs or direct updates.
create function public.guard_scheduled_order_operation() returns trigger language plpgsql security definer set search_path=public as $$
declare scheduled timestamptz;method text;
begin
 select o.scheduled_for,o.payment_method into scheduled,method from public.orders o where o.id=new.order_id;
 if scheduled is null or new.status=old.status or new.status='cancelled' then return new;end if;
 if method='wave' and new.payment_status<>'paid' then raise exception 'PAYMENT_REQUIRED';end if;
 if new.status not in ('pending','confirmed') and scheduled>now()+interval '2 hours' then raise exception 'PREPARATION_TOO_EARLY';end if;
 return new;
end $$;
create trigger scheduled_order_operation_guard before update on public.restaurant_orders for each row execute function public.guard_scheduled_order_operation();

create function public.sync_scheduled_order_state() returns trigger language plpgsql security definer set search_path=public as $$
declare meal public.scheduled_meals;state text;
begin
 select * into meal from public.scheduled_meals where order_id=new.order_id and restaurant_id=new.restaurant_id for update;
 if not found then return new;end if;
 state:=case new.status::text when 'pending' then 'requested' when 'confirmed' then 'confirmed' when 'preparing' then 'preparing' when 'ready' then 'ready' when 'ready_for_pickup' then 'ready' when 'out_for_delivery' then 'ready' when 'delivered' then 'completed' when 'collected' then 'completed' when 'cancelled' then 'cancelled' else meal.status end;
 update public.scheduled_meals set status=state,payment_status=case when new.payment_status::text='paid' then 'paid' else 'pending' end where id=meal.id;
 if state<>meal.status then insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(meal.id,auth.uid(),meal.status,state,'Statut synchronisé depuis la sous-commande.');end if;
 return new;
end $$;
create trigger scheduled_order_state_sync after update on public.restaurant_orders for each row execute function public.sync_scheduled_order_state();

create function public.guard_materialized_meal_state() returns trigger language plpgsql security definer set search_path=public as $$
declare actual text;
begin
 if old.order_id is null or new.status=old.status then return new;end if;
 select case ro.status::text when 'pending' then 'requested' when 'ready_for_pickup' then 'ready' when 'out_for_delivery' then 'ready' when 'delivered' then 'completed' when 'collected' then 'completed' else ro.status::text end into actual from public.restaurant_orders ro where ro.order_id=old.order_id and ro.restaurant_id=old.restaurant_id;
 if actual is distinct from new.status then raise exception 'USE_RESTAURANT_ORDER_WORKFLOW';end if;
 return new;
end $$;
create trigger materialized_meal_state_guard before update on public.scheduled_meals for each row execute function public.guard_materialized_meal_state();
revoke all on function public.guard_scheduled_order_operation(),public.sync_scheduled_order_state(),public.guard_materialized_meal_state() from public,anon,authenticated;

-- A server invocation queues reminders, never starts cooking or confirms payment.
create function public.enqueue_due_scheduled_pickups() returns integer
language plpgsql security definer set search_path=public as $$
declare queued integer;
begin
 update public.v2_notification_jobs j set status='cancelled' where j.event_type='scheduled_order_ready' and j.status in ('pending','failed')
 and not exists(select 1 from public.restaurant_orders ro join public.orders o on o.id=ro.order_id join public.restaurants r on r.id=ro.restaurant_id where ro.id::text=j.payload->>'restaurantOrderId' and ro.status in ('pending','confirmed') and (o.payment_method='cash' or ro.payment_status='paid') and r.email=j.recipient);
 insert into public.v2_notification_jobs(event_key,event_type,recipient,payload)
 select 'scheduled-ready-'||ro.id,'scheduled_order_ready',r.email,
 jsonb_build_object('restaurantOrderId',ro.id,'name',r.name,'reference',o.reference,'scheduledAt',to_char(o.scheduled_for at time zone 'Africa/Abidjan','DD/MM/YYYY HH24:MI'))
 from public.restaurant_orders ro join public.orders o on o.id=ro.order_id join public.restaurants r on r.id=ro.restaurant_id
 where o.scheduled_for between now()-interval '15 minutes' and now()+interval '2 hours' and o.fulfillment='pickup'
 and ro.status in ('pending','confirmed') and (o.payment_method='cash' or ro.payment_status='paid')
 and public.restaurant_is_open(r.id,o.scheduled_for) and r.email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
 and not exists(select 1 from public.order_items oi join public.products p on p.id=oi.product_id where oi.restaurant_order_id=ro.id and (not p.availability or p.is_archived or p.hidden_by_admin or p.moderation_status<>'approved'))
 order by o.scheduled_for limit 100 on conflict(event_key) do nothing;
 get diagnostics queued=row_count;return queued;
end $$;
revoke all on function public.enqueue_due_scheduled_pickups() from public,anon,authenticated;
grant execute on function public.enqueue_due_scheduled_pickups() to service_role;
