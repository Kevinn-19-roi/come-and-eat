-- Independent of all V2 migrations. No backfill or restaurant status change.
alter table public.restaurants add column suspension_reason text check(length(suspension_reason)<=1000);
create table public.restaurant_validation_events (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid references public.restaurants(id) on delete set null,
 restaurant_name text not null,
 actor_id uuid references public.profiles(id) on delete set null,
 actor_role text,
 previous_status public.validation_status not null,
 new_status public.validation_status not null,
 operating_status public.restaurant_status not null,
 reason text,
 created_at timestamptz not null default now()
);
create index restaurant_validation_events_history on public.restaurant_validation_events(restaurant_id,created_at desc);
alter table public.restaurant_validation_events enable row level security;
revoke all on public.restaurant_validation_events from public,anon,authenticated;
grant select on public.restaurant_validation_events to authenticated;
create policy restaurant_validation_events_admin_read on public.restaurant_validation_events
 for select to authenticated using(public.is_admin());

create function public.audit_restaurant_validation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.restaurant_validation_events(restaurant_id,restaurant_name,actor_id,actor_role,previous_status,new_status,operating_status,reason)
 values(new.id,new.name,auth.uid(),coalesce(public.current_role()::text,auth.role()),old.validation_status,new.validation_status,new.operating_status,
 case when old.validation_status='suspended' and new.validation_status<>'suspended' then old.suspension_reason else new.suspension_reason end);
 return new;
end $$;
revoke all on function public.audit_restaurant_validation() from public,anon,authenticated;
create trigger restaurant_validation_audit after update of validation_status,suspension_reason on public.restaurants
 for each row when (old.validation_status is distinct from new.validation_status or old.suspension_reason is distinct from new.suspension_reason)
 execute function public.audit_restaurant_validation();

create function public.protect_suspension_reason() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.suspension_reason is distinct from old.suspension_reason and auth.uid() is not null
 and not public.is_admin() and auth.role() is distinct from 'service_role' then raise exception 'ADMIN_REQUIRED';end if;
 return new;
end $$;
revoke all on function public.protect_suspension_reason() from public,anon,authenticated;
create trigger suspension_reason_admin_only before update of suspension_reason on public.restaurants
 for each row execute function public.protect_suspension_reason();
