create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_type text not null,
  recipient text not null,
  order_id uuid references public.orders(id) on delete cascade,
  restaurant_order_id uuid references public.restaurant_orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_events_order_idx on public.email_events(order_id,created_at desc);
create index if not exists email_events_restaurant_order_idx on public.email_events(restaurant_order_id,created_at desc);
create index if not exists email_events_status_idx on public.email_events(status,created_at desc);

alter table public.email_events enable row level security;

drop policy if exists email_events_admin_read on public.email_events;
create policy email_events_admin_read on public.email_events
for select to authenticated using (public.is_admin());

create or replace function public.claim_email_event(
  event_key text,
  event_name text,
  target_recipient text,
  target_order uuid default null,
  target_restaurant_order uuid default null,
  target_user uuid default null
) returns table(event_id uuid, should_send boolean)
language plpgsql security definer set search_path=public as $$
declare current_event public.email_events%rowtype;
begin
  insert into public.email_events(idempotency_key,event_type,recipient,order_id,restaurant_order_id,user_id)
  values(event_key,event_name,lower(target_recipient),target_order,target_restaurant_order,target_user)
  on conflict(idempotency_key) do nothing;

  select * into current_event from public.email_events where idempotency_key=event_key for update;
  if current_event.status='sent' or (current_event.status='processing' and current_event.updated_at > now()-interval '10 minutes') then
    return query select current_event.id,false;
    return;
  end if;

  update public.email_events set status='processing',attempts=attempts+1,failed_at=null,last_error_code=null,updated_at=now()
  where id=current_event.id;
  return query select current_event.id,true;
end$$;

revoke all on function public.claim_email_event(text,text,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_email_event(text,text,text,uuid,uuid,uuid) to service_role;

revoke all on public.email_events from anon,authenticated;
grant select on public.email_events to authenticated;
