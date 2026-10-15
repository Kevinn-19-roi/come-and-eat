create table if not exists public.statistics_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint statistics_periods_dates_check check (ended_at is null or ended_at >= starts_at)
);

create unique index if not exists statistics_periods_single_active_idx
  on public.statistics_periods ((ended_at is null)) where ended_at is null;

alter table public.statistics_periods enable row level security;

drop policy if exists statistics_periods_admin_read on public.statistics_periods;
create policy statistics_periods_admin_read on public.statistics_periods
  for select to authenticated using (public.is_admin());

drop policy if exists statistics_periods_admin_write on public.statistics_periods;
create policy statistics_periods_admin_write on public.statistics_periods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.statistics_periods to authenticated;

insert into public.statistics_periods(starts_at)
select coalesce((select min(created_at) from public.orders), now())
where not exists (select 1 from public.statistics_periods);

create or replace function public.admin_statistics_summary(period_start timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  with allocated as (
    select
      o.id as order_id,
      ro.id as restaurant_order_id,
      ro.status,
      ro.payment_status,
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
    'revenue', coalesce(sum(gross_amount + delivery_fee - discount_share), 0),
    'platform_commission', coalesce(sum(platform_commission), 0),
    'seller_net_amount', coalesce(sum(seller_net_amount), 0)
  )
  into result
  from recognized;

  return result;
end;
$$;

create or replace function public.admin_start_statistics_period()
returns public.statistics_periods
language plpgsql
security definer
set search_path = public
as $$
declare new_period public.statistics_periods;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  -- Serialize concurrent starts so the single-active-period index cannot race.
  lock table public.statistics_periods in exclusive mode;
  update public.statistics_periods set ended_at = now() where ended_at is null;
  insert into public.statistics_periods(starts_at, started_by) values(now(), auth.uid()) returning * into new_period;
  return new_period;
end;
$$;

revoke all on function public.admin_start_statistics_period() from public, anon;
grant execute on function public.admin_start_statistics_period() to authenticated;
revoke all on function public.admin_statistics_summary(timestamptz) from public, anon;
grant execute on function public.admin_statistics_summary(timestamptz) to authenticated;
