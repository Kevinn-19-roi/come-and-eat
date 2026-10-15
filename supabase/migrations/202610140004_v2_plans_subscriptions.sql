create table public.subscription_plans (
 id uuid primary key default gen_random_uuid(),name text not null,
 audience text not null check(audience in ('student','professional')),
 meal_count integer check(meal_count between 1 and 1000),unit_price integer not null check(unit_price>=0),
 duration_days integer not null default 30 check(duration_days between 1 and 366),
 delivery_terms text,terms text,is_active boolean not null default false,
 created_at timestamptz not null default now(),
 check(not is_active or (meal_count is not null and length(trim(coalesce(delivery_terms,'')))>=10 and length(trim(coalesce(terms,'')))>=10))
);
create table public.subscription_eligible_products (
 plan_id uuid references public.subscription_plans(id) on delete cascade,product_id uuid references public.products(id) on delete restrict,
 primary key(plan_id,product_id)
);
create table public.customer_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete restrict,
 plan_id uuid not null references public.subscription_plans(id) on delete restrict,
 name_snapshot text not null,meal_count integer not null,unit_price integer not null,total integer not null,
 starts_at timestamptz,expires_at timestamptz,
 status text not null default 'pending_payment' check(status in ('pending_payment','active','expired','cancelled')),
 paid_at timestamptz,paid_by uuid references public.profiles(id),
 idempotency_key uuid not null unique,created_at timestamptz not null default now()
);
create table public.meal_plans (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete restrict,
 name text not null default 'Mes repas',payment_method text not null check(payment_method in ('wave','cash')),
 status text not null default 'draft' check(status in ('draft','submitted','cancelled','completed')),
 created_at timestamptz not null default now()
);
create table public.scheduled_meals (
 id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.meal_plans(id) on delete restrict,
 restaurant_id uuid not null references public.restaurants(id) on delete restrict,product_id uuid not null references public.products(id) on delete restrict,
 scheduled_at timestamptz not null,quantity integer not null check(quantity between 1 and 50),option_ids uuid[] not null default '{}',
 fulfillment text not null check(fulfillment in ('delivery','pickup')),zone_id uuid references public.delivery_zones(id),address text,
 estimated_subtotal integer not null,estimated_delivery integer not null,
 commission_rate_bps integer not null check(commission_rate_bps between 0 and 10000),
 status text not null default 'requested' check(status in ('requested','confirmed','preparing','ready','completed','cancelled','incident')),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid')),
 subscription_id uuid references public.customer_subscriptions(id),
 order_id uuid references public.orders(id) on delete restrict,
 idempotency_key uuid not null unique,created_at timestamptz not null default now()
);
create index scheduled_meals_due_idx on public.scheduled_meals(scheduled_at,status);
create index scheduled_meals_restaurant_idx on public.scheduled_meals(restaurant_id,scheduled_at);
create index customer_subscriptions_owner_idx on public.customer_subscriptions(user_id,created_at desc);
create index meal_plans_owner_idx on public.meal_plans(user_id,created_at desc);
create table public.subscription_consumptions (
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.customer_subscriptions(id) on delete restrict,
 meal_id uuid not null unique references public.scheduled_meals(id) on delete restrict,
 meals integer not null check(meals>0),status text not null default 'reserved' check(status in ('reserved','consumed','released')),
 created_at timestamptz not null default now()
);
create table public.scheduled_meal_events (
 id uuid primary key default gen_random_uuid(),meal_id uuid not null references public.scheduled_meals(id) on delete cascade,
 actor_id uuid references public.profiles(id),from_status text,to_status text not null,note text,created_at timestamptz not null default now()
);
create index subscription_consumptions_quota_idx on public.subscription_consumptions(subscription_id,status);
insert into public.subscription_plans(name,audience,meal_count,unit_price,delivery_terms,terms,is_active)
values('Abonnement Étudiant','student',20,1450,null,null,false),('Abonnement Professionnel','professional',null,1450,null,null,false);

alter table public.subscription_plans enable row level security;
alter table public.subscription_eligible_products enable row level security;
alter table public.customer_subscriptions enable row level security;
alter table public.meal_plans enable row level security;
alter table public.scheduled_meals enable row level security;
alter table public.subscription_consumptions enable row level security;
alter table public.scheduled_meal_events enable row level security;
create policy plan_read on public.subscription_plans for select using(is_active or public.has_platform_permission('subscriptions.manage'));
create policy eligible_read on public.subscription_eligible_products for select using(exists(select 1 from public.subscription_plans p where p.id=plan_id and p.is_active) or public.has_platform_permission('subscriptions.manage'));
create policy subscriptions_read on public.customer_subscriptions for select to authenticated using(user_id=auth.uid() or public.has_platform_permission('subscriptions.manage'));
create policy meal_plans_read on public.meal_plans for select to authenticated using(user_id=auth.uid() or public.has_platform_permission('planning.manage') or public.has_platform_permission('planning.deliveries'));
create policy scheduled_read on public.scheduled_meals for select to authenticated using(public.is_restaurant_member(restaurant_id) or public.has_platform_permission('planning.manage') or public.has_platform_permission('planning.deliveries') or exists(select 1 from public.meal_plans p where p.id=plan_id and p.user_id=auth.uid()));
create policy consumptions_read on public.subscription_consumptions for select to authenticated using(public.has_platform_permission('subscriptions.manage') or exists(select 1 from public.customer_subscriptions s where s.id=subscription_id and s.user_id=auth.uid()));
create policy meal_events_read on public.scheduled_meal_events for select to authenticated using(exists(select 1 from public.scheduled_meals m where m.id=meal_id));
revoke all on public.subscription_plans,public.subscription_eligible_products,public.customer_subscriptions,public.meal_plans,public.scheduled_meals,public.subscription_consumptions,public.scheduled_meal_events from anon,authenticated;
grant select on public.subscription_plans,public.subscription_eligible_products to anon,authenticated;
grant select on public.customer_subscriptions,public.meal_plans,public.scheduled_meals,public.subscription_consumptions,public.scheduled_meal_events to authenticated;

create function public.subscribe_to_plan(target_plan uuid,request_key uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.subscription_plans; result uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 select id into result from public.customer_subscriptions where idempotency_key=request_key and user_id=auth.uid();if found then return result; end if;
 select * into p from public.subscription_plans where id=target_plan and is_active;
 if not found or not exists(select 1 from public.subscription_eligible_products where plan_id=p.id) then raise exception 'PLAN_NOT_AVAILABLE'; end if;
 insert into public.customer_subscriptions(user_id,plan_id,name_snapshot,meal_count,unit_price,total,idempotency_key)
 values(auth.uid(),p.id,p.name,p.meal_count,p.unit_price,p.meal_count*p.unit_price,request_key) returning id into result;
 return result;
end $$;
create function public.confirm_subscription_payment(target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.customer_subscriptions; duration integer;
begin
 if not public.has_platform_permission('payment.confirm') then raise exception 'FORBIDDEN'; end if;
 select * into s from public.customer_subscriptions where id=target for update;
 if not found or s.status='cancelled' then raise exception 'INVALID_SUBSCRIPTION'; end if;
 if s.paid_at is not null then return; end if;
 select duration_days into duration from public.subscription_plans where id=s.plan_id;
 update public.customer_subscriptions set status='active',paid_at=now(),paid_by=auth.uid(),starts_at=now(),expires_at=now()+make_interval(days=>duration) where id=target;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'subscription.payment_confirmed',target,jsonb_build_object('amount',s.total));
end $$;

create function public.schedule_meal(payload jsonb)
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
  if not exists(select 1 from public.subscription_eligible_products where plan_id=subscription.plan_id and product_id=p.id) then raise exception 'NOT_ELIGIBLE'; end if;
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
create function public.update_scheduled_meal(target uuid,next_status text,note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare meal public.scheduled_meals; manager boolean;
begin
 select * into meal from public.scheduled_meals where id=target for update;if not found then raise exception 'NOT_FOUND';end if;
 manager:=public.has_platform_permission('planning.manage');
 if not manager and not public.is_restaurant_member(meal.restaurant_id) then raise exception 'FORBIDDEN';end if;
 if not (next_status='confirmed' and meal.status='requested' or next_status='preparing' and meal.status='confirmed' and meal.scheduled_at<=now()+interval '2 hours' or next_status='ready' and meal.status='preparing' or next_status='completed' and meal.status='ready' or next_status in ('cancelled','incident') and manager and length(trim(note))>=5) then raise exception 'INVALID_TRANSITION';end if;
 update public.scheduled_meals set status=next_status where id=target;
 if next_status='cancelled' then update public.subscription_consumptions set status='released' where meal_id=target and status='reserved';end if;
 if next_status='completed' then update public.subscription_consumptions set status='consumed' where meal_id=target and status='reserved';end if;
 insert into public.scheduled_meal_events(meal_id,actor_id,from_status,to_status,note) values(target,auth.uid(),meal.status,next_status,note);
end $$;
create function public.create_meal_plan(label text,method text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null or method not in ('wave','cash') or length(label) not between 1 and 100 then raise exception 'INVALID_PLAN';end if;
 insert into public.meal_plans(user_id,name,payment_method) values(auth.uid(),label,method) returning id into result;return result;
end $$;
revoke all on function public.subscribe_to_plan(uuid,uuid),public.confirm_subscription_payment(uuid),public.schedule_meal(jsonb),public.update_scheduled_meal(uuid,text,text),public.create_meal_plan(text,text) from public,anon;
grant execute on function public.subscribe_to_plan(uuid,uuid),public.confirm_subscription_payment(uuid),public.schedule_meal(jsonb),public.update_scheduled_meal(uuid,text,text),public.create_meal_plan(text,text) to authenticated;

-- Configuration préparatoire : la publication commerciale reste volontairement désactivée.
create function public.configure_subscription_plan(target uuid,label text,meals integer,price integer,duration integer,delivery text,conditions text,eligible uuid[])
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_platform_permission('finance.configure') then raise exception 'FORBIDDEN';end if;
 if label is null or length(trim(label)) not between 2 and 100 or meals is not null and meals not between 1 and 1000 or price is null or price not between 0 and 1000000 or duration is null or duration not between 1 and 366 or length(coalesce(delivery,''))>4000 or length(coalesce(conditions,''))>4000 then raise exception 'INVALID_PLAN';end if;
 perform 1 from public.subscription_plans where id=target for update;if not found then raise exception 'NOT_FOUND';end if;
 if exists(select 1 from unnest(coalesce(eligible,'{}'::uuid[])) e(id) left join public.products p on p.id=e.id where p.id is null or p.is_archived) then raise exception 'INVALID_PRODUCT';end if;
 update public.subscription_plans set name=trim(label),meal_count=meals,unit_price=price,duration_days=duration,delivery_terms=delivery,terms=conditions,is_active=false where id=target;
 delete from public.subscription_eligible_products where plan_id=target;
 insert into public.subscription_eligible_products(plan_id,product_id) select target,e.id from (select distinct unnest(coalesce(eligible,'{}'::uuid[])) id) e;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'subscription.plan_configured',target,jsonb_build_object('meals',meals,'unit_price',price,'published',false));
end $$;
revoke all on function public.configure_subscription_plan(uuid,text,integer,integer,integer,text,text,uuid[]) from public,anon;
grant execute on function public.configure_subscription_plan(uuid,text,integer,integer,integer,text,text,uuid[]) to authenticated;
