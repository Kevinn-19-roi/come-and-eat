-- Immutable subscription terms, independent of future catalog/plan edits.
create function public.subscription_clock() returns timestamptz language sql stable set search_path=public as $$select now()$$;
revoke all on function public.subscription_clock() from public,anon;
grant execute on function public.subscription_clock() to authenticated;
alter table public.customer_subscriptions add column duration_days_snapshot integer,
 add column delivery_terms_snapshot text,add column terms_snapshot text;
update public.customer_subscriptions s set duration_days_snapshot=case when s.starts_at is not null and s.expires_at is not null then greatest(1,ceil(extract(epoch from (s.expires_at-s.starts_at))/86400)::integer) else p.duration_days end,
 delivery_terms_snapshot=p.delivery_terms,terms_snapshot=p.terms from public.subscription_plans p where p.id=s.plan_id;
alter table public.customer_subscriptions alter column duration_days_snapshot set not null;
alter table public.customer_subscriptions add constraint subscription_duration_snapshot_valid check(duration_days_snapshot between 1 and 366);
create table public.subscription_product_entitlements(
 subscription_id uuid not null references public.customer_subscriptions(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 primary key(subscription_id,product_id)
);
insert into public.subscription_product_entitlements select s.id,e.product_id from public.customer_subscriptions s join public.subscription_eligible_products e on e.plan_id=s.plan_id;
alter table public.subscription_product_entitlements enable row level security;
create policy entitlements_read on public.subscription_product_entitlements for select to authenticated using(public.has_platform_permission('subscriptions.manage') or exists(select 1 from public.customer_subscriptions s where s.id=subscription_id and s.user_id=auth.uid()));
revoke all on public.subscription_product_entitlements from public,anon,authenticated;
grant select on public.subscription_product_entitlements to authenticated;

create function public.snapshot_subscription_contract() returns trigger language plpgsql security definer set search_path=public as $$
declare plan public.subscription_plans;
begin
 select * into plan from public.subscription_plans where id=new.plan_id and is_active for share;
 if not found or new.meal_count is distinct from plan.meal_count or new.unit_price is distinct from plan.unit_price or new.total::bigint is distinct from plan.meal_count::bigint*plan.unit_price then raise exception 'PLAN_CHANGED';end if;
 new.duration_days_snapshot:=plan.duration_days;new.delivery_terms_snapshot:=plan.delivery_terms;new.terms_snapshot:=plan.terms;
 return new;
end $$;
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
create function public.snapshot_subscription_products() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.subscription_product_entitlements select new.id,e.product_id from public.subscription_eligible_products e where e.plan_id=new.plan_id;
 if not found then raise exception 'PLAN_NOT_AVAILABLE';end if;return new;
end $$;
create trigger subscription_contract_snapshot before insert on public.customer_subscriptions for each row execute function public.snapshot_subscription_contract();
create trigger subscription_products_snapshot after insert on public.customer_subscriptions for each row execute function public.snapshot_subscription_products();
revoke all on function public.snapshot_subscription_contract(),public.snapshot_subscription_products() from public,anon,authenticated;

create or replace function public.confirm_subscription_payment(target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare subscription public.customer_subscriptions;
begin
 if not public.has_platform_permission('payment.confirm') then raise exception 'FORBIDDEN';end if;
 select * into subscription from public.customer_subscriptions where id=target for update;
 if not found or subscription.status='cancelled' then raise exception 'INVALID_SUBSCRIPTION';end if;
 if subscription.paid_at is not null then return;end if;
 update public.customer_subscriptions set status='active',paid_at=now(),paid_by=auth.uid(),starts_at=now(),expires_at=now()+make_interval(days=>subscription.duration_days_snapshot) where id=target;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'subscription.payment_confirmed',target,jsonb_build_object('amount',subscription.total));
end $$;
