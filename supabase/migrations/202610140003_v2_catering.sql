create table public.catering_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
 name text not null check(length(name) between 2 and 100),
 phone text not null check(phone~'^\+?[0-9 ()-]{8,30}$' and length(regexp_replace(phone,'[^0-9]','','g')) between 8 and 15),
 whatsapp text check(whatsapp is null or (whatsapp~'^\+?[0-9 ()-]{8,30}$' and length(regexp_replace(whatsapp,'[^0-9]','','g')) between 8 and 15)),
 email text not null check(length(email)<=254 and email~'^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$'),
 event_type text not null check(length(event_type) between 2 and 100),event_at timestamptz not null,location text not null check(length(location) between 3 and 500),
 guests integer not null check(guests between 1 and 10000),dishes text not null default '' check(length(dishes)<=2000),
 budget integer check(budget>=0),message text not null default '' check(length(message)<=4000),
 status text not null default 'new' check(status in ('new','reviewing','quoted','accepted','rejected','cancelled','completed')),
 assigned_restaurant_id uuid references public.restaurants(id) on delete restrict,
 assigned_user_id uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index catering_event_idx on public.catering_requests(event_at,status);
create index catering_owner_idx on public.catering_requests(user_id,created_at desc);
create index catering_assigned_idx on public.catering_requests(assigned_restaurant_id,event_at);
create table public.catering_events (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.catering_requests(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,note text not null check(length(note)<=4000),
 status text not null,created_at timestamptz not null default now()
);
create table public.catering_quotes (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.catering_requests(id) on delete restrict,
 lines jsonb not null check(jsonb_typeof(lines)='array'),extra_fee integer not null default 0 check(extra_fee>=0),
 total integer not null check(total>=0),valid_until date not null,conditions text not null default '',
 status text not null default 'draft' check(status in ('draft','sent','accepted','rejected','expired')),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.v2_notification_jobs (
 id uuid primary key default gen_random_uuid(),event_key text not null unique,event_type text not null,
 recipient text not null,payload jsonb not null,
 available_at timestamptz not null default now(),status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0,last_error text,locked_at timestamptz,created_at timestamptz not null default now()
);
alter table public.catering_requests enable row level security;
alter table public.catering_events enable row level security;
alter table public.catering_quotes enable row level security;
alter table public.v2_notification_jobs enable row level security;
create index v2_notifications_pending_idx on public.v2_notification_jobs(available_at) where status in ('pending','failed');
create policy catering_read on public.catering_requests for select to authenticated using(user_id=auth.uid() or assigned_user_id=auth.uid() or public.is_restaurant_member(assigned_restaurant_id) or public.has_platform_permission('catering.manage'));
create policy catering_events_read on public.catering_events for select to authenticated using(public.has_platform_permission('catering.manage'));
create policy catering_quotes_read on public.catering_quotes for select to authenticated using(public.has_platform_permission('catering.manage') or (status<>'draft' and exists(select 1 from public.catering_requests r where r.id=request_id and (r.user_id=auth.uid() or public.is_restaurant_member(r.assigned_restaurant_id)))));
create policy notification_audit_read on public.v2_notification_jobs for select to authenticated using(public.is_super_admin());
revoke all on public.catering_requests,public.catering_events,public.catering_quotes,public.v2_notification_jobs from anon,authenticated;
grant select on public.catering_requests,public.catering_events,public.catering_quotes,public.v2_notification_jobs to authenticated;
grant all on public.catering_requests,public.v2_notification_jobs to service_role;

create function public.manage_catering_request(target uuid,new_status text,note text,restaurant uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare old_status text;
begin
 if not public.has_platform_permission('catering.manage') then raise exception 'FORBIDDEN'; end if;
 if new_status not in ('new','reviewing','quoted','accepted','rejected','cancelled','completed') or length(coalesce(note,''))>4000 then raise exception 'INVALID_INPUT'; end if;
 select status into old_status from public.catering_requests where id=target for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if new_status in ('rejected','cancelled') and length(trim(coalesce(note,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
 if restaurant is not null and not exists(select 1 from public.restaurants where id=restaurant and validation_status='approved') then raise exception 'INVALID_RESTAURANT'; end if;
 update public.catering_requests set status=new_status,assigned_restaurant_id=restaurant,updated_at=now() where id=target;
 insert into public.catering_events(request_id,actor_id,note,status) values(target,auth.uid(),coalesce(note,''),new_status);
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'catering.updated',target,jsonb_build_object('from',old_status,'to',new_status));
end $$;
create function public.save_catering_quote(target uuid,quote_lines jsonb,fees integer,validity date,terms text)
returns uuid language plpgsql security definer set search_path=public as $$
declare line jsonb; amount bigint:=0; result uuid;
begin
 if not public.has_platform_permission('catering.manage') then raise exception 'FORBIDDEN'; end if;
 if quote_lines is null or jsonb_typeof(quote_lines)<>'array' or jsonb_array_length(quote_lines) not between 1 and 100 or validity is null or validity<current_date or fees is null or fees<0 or length(coalesce(terms,''))>4000 then raise exception 'INVALID_QUOTE'; end if;
 for line in select value from jsonb_array_elements(quote_lines) loop
  if line->>'name' is null or line->>'quantity' is null or line->>'price' is null or length(trim(line->>'name')) not between 1 and 200 or (line->>'quantity')::integer not between 1 and 10000 or (line->>'price')::integer not between 0 and 100000000 then raise exception 'INVALID_LINE'; end if;
  amount:=amount+(line->>'quantity')::integer::bigint*(line->>'price')::integer;
 end loop;
 if amount+fees>2147483647 then raise exception 'AMOUNT_TOO_LARGE'; end if;
 insert into public.catering_quotes(request_id,lines,extra_fee,total,valid_until,conditions,created_by)
 values(target,quote_lines,fees,amount+fees,validity,coalesce(terms,''),auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.manage_catering_request(uuid,text,text,uuid),public.save_catering_quote(uuid,jsonb,integer,date,text) from public,anon;
grant execute on function public.manage_catering_request(uuid,text,text,uuid),public.save_catering_quote(uuid,jsonb,integer,date,text) to authenticated;
