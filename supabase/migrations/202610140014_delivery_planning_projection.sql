-- Delivery staff receive operational details, not subscription contracts or
-- commission/estimated financial columns from the planning tables.
alter policy meal_plans_read on public.meal_plans using(
  user_id=auth.uid() or public.has_platform_permission('planning.manage')
);
alter policy scheduled_read on public.scheduled_meals using(
  public.is_restaurant_member(restaurant_id)
  or public.has_platform_permission('planning.manage')
  or exists(select 1 from public.meal_plans p where p.id=plan_id and p.user_id=auth.uid())
);

create function public.delivery_planning(from_time timestamptz,to_time timestamptz)
returns table(meal_id uuid,scheduled_at timestamptz,restaurant_name text,product_name text,quantity integer,address text,customer_name text,customer_phone text,reference text,status text)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.has_platform_permission('planning.deliveries') then raise exception 'FORBIDDEN';end if;
  if from_time is null or to_time is null or to_time<=from_time or to_time-from_time>interval '93 days' then raise exception 'INVALID_PERIOD';end if;
  return query select m.id,m.scheduled_at,r.name,oi.product_name,oi.quantity,m.address,o.customer_name,o.customer_phone,o.reference,ro.status::text
    from public.scheduled_meals m
    join public.orders o on o.id=m.order_id
    join public.restaurant_orders ro on ro.order_id=o.id and ro.restaurant_id=m.restaurant_id
    join public.restaurants r on r.id=m.restaurant_id
    join public.order_items oi on oi.restaurant_order_id=ro.id and oi.product_id=m.product_id
    where m.fulfillment='delivery' and m.scheduled_at>=from_time and m.scheduled_at<to_time
    order by m.scheduled_at,m.id limit 100;
end $$;
revoke all on function public.delivery_planning(timestamptz,timestamptz) from public,anon;
grant execute on function public.delivery_planning(timestamptz,timestamptz) to authenticated;
