create or replace function public.user_can_read_order(target_order_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.is_admin()
    or exists(select 1 from public.orders where id=target_order_id and customer_user_id=auth.uid())
    or exists(select 1 from public.restaurant_orders where order_id=target_order_id and public.is_restaurant_member(restaurant_id)),
    false
  )
$$;

create or replace function public.user_can_read_restaurant_order(target_restaurant_order_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.is_admin()
    or exists(
      select 1 from public.restaurant_orders restaurant_order
      where restaurant_order.id=target_restaurant_order_id
        and (
          public.is_restaurant_member(restaurant_order.restaurant_id)
          or exists(select 1 from public.orders where id=restaurant_order.order_id and customer_user_id=auth.uid())
        )
    ),false
  )
$$;

drop policy if exists orders_customer_read on public.orders;
create policy orders_customer_read on public.orders for select to authenticated
using(public.user_can_read_order(id));

drop policy if exists restaurant_orders_vendor_read on public.restaurant_orders;
create policy restaurant_orders_vendor_read on public.restaurant_orders for select to authenticated
using(public.user_can_read_restaurant_order(id));

drop policy if exists order_items_visible on public.order_items;
create policy order_items_visible on public.order_items for select to authenticated
using(public.user_can_read_restaurant_order(restaurant_order_id));

grant execute on function public.user_can_read_order(uuid) to authenticated;
grant execute on function public.user_can_read_restaurant_order(uuid) to authenticated;
