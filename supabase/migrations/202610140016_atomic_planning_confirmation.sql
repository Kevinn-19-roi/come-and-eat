create table public.planning_confirmations(
 id uuid primary key,plan_id uuid not null unique references public.meal_plans(id) on delete restrict,
 user_id uuid not null references public.profiles(id),order_ids uuid[] not null,
 confirmed_value integer not null check(confirmed_value>=0),created_at timestamptz not null default now()
);
alter table public.planning_confirmations enable row level security;
create policy planning_confirmations_read on public.planning_confirmations for select to authenticated using(user_id=auth.uid() or public.has_platform_permission('planning.manage'));
revoke all on public.planning_confirmations from public,anon,authenticated;
grant select on public.planning_confirmations to authenticated;

create function public.quote_meal_plan(target uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;meal_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.meal_plans where id=target and user_id=auth.uid() and status='draft') then raise exception 'FORBIDDEN';end if;
 select count(*) into meal_count from public.scheduled_meals where plan_id=target and status='requested' and order_id is null;
 if meal_count not between 1 and 50 then raise exception 'INVALID_PLAN_SIZE';end if;
 if exists(select 1 from public.scheduled_meals m left join public.delivery_zones z on z.id=m.zone_id and z.is_active and z.restaurant_id is null where m.plan_id=target and m.status='requested' and m.order_id is null and m.fulfillment='delivery' and z.id is null) then raise exception 'INVALID_ZONE';end if;
 with priced as (
  select m.*,((coalesce(s.unit_price,p.base_price)::bigint+coalesce((select sum(o.price_delta) from public.product_options o where o.id=any(m.option_ids)),0))*m.quantity)::integer gross,
   coalesce(s.unit_price*m.quantity,0) credit,case when m.fulfillment='delivery' then z.fee else 0 end full_fee,
   row_number() over(partition by m.scheduled_at,m.restaurant_id,m.fulfillment,m.zone_id,m.address order by m.id) position,
   exists(select 1 from public.scheduled_meals previous join public.restaurant_orders ro on ro.order_id=previous.order_id and ro.restaurant_id=previous.restaurant_id where previous.plan_id=m.plan_id and previous.scheduled_at=m.scheduled_at and previous.restaurant_id=m.restaurant_id and previous.fulfillment=m.fulfillment and previous.zone_id is not distinct from m.zone_id and previous.address is not distinct from m.address and ro.delivery_fee>0 and ro.status<>'cancelled') fee_already_assigned
  from public.scheduled_meals m join public.products p on p.id=m.product_id
  left join public.customer_subscriptions s on s.id=m.subscription_id
  left join public.delivery_zones z on z.id=m.zone_id
  where m.plan_id=target and m.status='requested' and m.order_id is null
 ), allocated as(select *,case when position=1 and not fee_already_assigned then full_fee else 0 end allocated_fee from priced)
 select jsonb_build_object('total',sum(gross+allocated_fee),'credit',sum(credit),'amount_due',sum(gross+allocated_fee-credit),'meals',jsonb_agg(jsonb_build_object('id',id,'expected_total',gross+allocated_fee,'delivery_fee',allocated_fee) order by id)) into result from allocated;
 return result;
end $$;
revoke all on function public.quote_meal_plan(uuid) from public,anon;
grant execute on function public.quote_meal_plan(uuid) to authenticated;
create function public.meal_plan_quotes() returns table(plan_id uuid,quote jsonb,issue text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p record;
begin
 if auth.uid() is null then raise exception 'FORBIDDEN';end if;
 for p in select id from public.meal_plans where user_id=auth.uid() and status='draft' order by created_at desc limit 30 loop
  plan_id:=p.id;quote:=null;issue:=null;
  begin quote:=public.quote_meal_plan(p.id);exception when others then issue:=case when sqlerrm in ('INVALID_PLAN_SIZE','INVALID_ZONE') then sqlerrm else 'ESTIMATE_UNAVAILABLE' end;end;
  return next;
 end loop;
end $$;
revoke all on function public.meal_plan_quotes() from public,anon;
grant execute on function public.meal_plan_quotes() to authenticated;

create function public.confirm_meal_plan(target uuid,request_key uuid,expected_total integer,customer_label text,phone text)
returns uuid[] language plpgsql security definer set search_path=public,pg_temp as $$
declare plan public.meal_plans;receipt public.planning_confirmations;quote jsonb;meal jsonb;created uuid;results uuid[]:='{}';
begin
 if auth.uid() is null or request_key is null then raise exception 'FORBIDDEN';end if;
 select * into plan from public.meal_plans where id=target and user_id=auth.uid() for update;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into receipt from public.planning_confirmations where id=request_key or plan_id=target;
 if found then
  if receipt.user_id<>auth.uid() or receipt.plan_id<>target then raise exception 'KEY_REUSED';end if;
  return receipt.order_ids;
 end if;
 perform s.id from public.customer_subscriptions s where exists(select 1 from public.scheduled_meals m where m.plan_id=target and m.subscription_id=s.id and m.status='requested' and m.order_id is null) order by s.id for update;
 quote:=public.quote_meal_plan(target);
 if expected_total is null or (quote->>'total')::integer<>expected_total then raise exception 'PRICE_CHANGED';end if;
 -- All orders are created in this transaction. Any later validation failure rolls
 -- back earlier orders too. No provider call or notification happens here.
 for meal in select value from jsonb_array_elements(quote->'meals') loop
  created:=public.confirm_scheduled_meal((meal->>'id')::uuid,(meal->>'expected_total')::integer,customer_label,phone);
  results:=array_append(results,created);
 end loop;
 insert into public.planning_confirmations(id,plan_id,user_id,order_ids,confirmed_value) values(request_key,target,auth.uid(),results,expected_total);
 update public.meal_plans set status='submitted' where id=target;
 return results;
end $$;
revoke all on function public.confirm_meal_plan(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.confirm_meal_plan(uuid,uuid,integer,text,text) to authenticated;
