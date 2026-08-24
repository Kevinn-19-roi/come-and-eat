-- Centralise l'autorisation de commander selon le statut et les horaires locaux.
create or replace function public.get_restaurant_ordering_status(
  target uuid,
  at_time timestamptz default now()
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  r public.restaurants;
  local_moment timestamp;
  local_day smallint;
  local_clock time;
  schedule public.restaurant_hours;
  previous_schedule public.restaurant_hours;
  open_now boolean := false;
  reason text := 'closed_hours';
begin
  select * into r from public.restaurants where id=target;
  if r.id is null then return jsonb_build_object('can_order',false,'is_open',false,'reason','not_found'); end if;
  if r.archived_at is not null then reason:='archived';
  elsif r.validation_status='suspended' then reason:='suspended';
  elsif r.validation_status<>'approved' then reason:='not_approved';
  elsif r.operating_status='paused' then reason:='paused';
  elsif r.operating_status<>'open' then reason:='closed';
  else
    local_moment:=at_time at time zone coalesce(nullif(r.timezone,''),'Africa/Abidjan');
    local_day:=extract(dow from local_moment)::smallint;
    local_clock:=local_moment::time;
    select * into schedule from public.restaurant_hours where restaurant_id=target and day_of_week=local_day;
    select * into previous_schedule from public.restaurant_hours where restaurant_id=target and day_of_week=((local_day+6)%7)::smallint;
    open_now:=coalesce(not schedule.is_closed and schedule.opens_at is not null and schedule.closes_at is not null and schedule.opens_at<>schedule.closes_at and (
      (schedule.opens_at<schedule.closes_at and local_clock>=schedule.opens_at and local_clock<schedule.closes_at)
      or (schedule.opens_at>schedule.closes_at and local_clock>=schedule.opens_at)
    ),false) or coalesce(not previous_schedule.is_closed and previous_schedule.opens_at>previous_schedule.closes_at and local_clock<previous_schedule.closes_at,false);
    reason:=case when open_now then 'open' else 'closed_hours' end;
  end if;
  return jsonb_build_object('can_order',open_now,'is_open',open_now,'reason',reason,'restaurant_id',r.id,'restaurant_name',r.name,'timezone',r.timezone);
end$$;

create or replace function public.restaurant_is_open(target uuid, at_time timestamptz default now())
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((public.get_restaurant_ordering_status(target,at_time)->>'can_order')::boolean,false)
$$;

create or replace function public.get_restaurant_ordering_statuses(targets uuid[])
returns table(restaurant_id uuid, restaurant_name text, can_order boolean, reason text)
language sql stable security definer set search_path=public as $$
  select r.id,r.name,coalesce((s.value->>'can_order')::boolean,false),coalesce(s.value->>'reason','not_found')
  from public.restaurants r
  cross join lateral (select public.get_restaurant_ordering_status(r.id,now()) value) s
  where r.id=any(targets)
$$;

create or replace function public.enforce_restaurant_ordering_on_new_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare status jsonb;
begin
  status:=public.get_restaurant_ordering_status(new.restaurant_id,now());
  if not coalesce((status->>'can_order')::boolean,false) then
    raise exception '% est actuellement fermé et ne peut pas accepter cette commande.',coalesce(status->>'restaurant_name','Ce restaurant') using errcode='P0001';
  end if;
  return new;
end$$;

drop trigger if exists enforce_restaurant_ordering_before_insert on public.restaurant_orders;
create trigger enforce_restaurant_ordering_before_insert before insert on public.restaurant_orders
for each row execute function public.enforce_restaurant_ordering_on_new_order();

revoke all on function public.get_restaurant_ordering_status(uuid,timestamptz) from public;
revoke all on function public.get_restaurant_ordering_statuses(uuid[]) from public;
grant execute on function public.get_restaurant_ordering_status(uuid,timestamptz) to anon,authenticated;
grant execute on function public.get_restaurant_ordering_statuses(uuid[]) to anon,authenticated;
