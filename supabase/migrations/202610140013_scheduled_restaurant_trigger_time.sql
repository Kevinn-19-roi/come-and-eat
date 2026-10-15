-- Immediate orders use the current opening hours. Materialized scheduled orders
-- use their server-validated scheduled time, not the time of checkout.
create or replace function public.enforce_restaurant_ordering_on_new_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare status jsonb; ordering_at timestamptz;
begin
  select coalesce(scheduled_for,now()) into ordering_at from public.orders where id=new.order_id;
  if ordering_at is null then raise exception 'ORDER_NOT_FOUND';end if;
  status:=public.get_restaurant_ordering_status(new.restaurant_id,ordering_at);
  if not coalesce((status->>'can_order')::boolean,false) then
    raise exception '% est fermé au créneau de cette commande.',coalesce(status->>'restaurant_name','Ce restaurant') using errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function public.enforce_restaurant_ordering_on_new_order() from public,anon,authenticated;
