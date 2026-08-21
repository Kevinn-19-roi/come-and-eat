alter table public.restaurants add column if not exists archived_at timestamptz;
alter table public.cuisine_types add column if not exists archived_at timestamptz;
alter table public.promotions add column if not exists archived_at timestamptz;
alter table public.delivery_zones add column if not exists sort_order integer not null default 0;
alter table public.delivery_zones add column if not exists estimated_minutes integer check(estimated_minutes is null or estimated_minutes between 0 and 360);

create table if not exists public.order_status_events(
  id uuid primary key default gen_random_uuid(),
  restaurant_order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  from_status public.restaurant_order_status,
  to_status public.restaurant_order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_status_events_order_idx on public.order_status_events(restaurant_order_id,created_at desc);
alter table public.order_status_events enable row level security;
create policy order_status_events_read on public.order_status_events for select to authenticated using(public.user_can_read_restaurant_order(restaurant_order_id));
create policy order_status_events_write on public.order_status_events for insert to authenticated with check(
  public.is_admin() or exists(
    select 1 from public.restaurant_orders ro
    where ro.id=restaurant_order_id and public.is_restaurant_member(ro.restaurant_id)
  )
);
grant select,insert on public.order_status_events to authenticated;

create or replace function public.track_restaurant_order_status() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_events(restaurant_order_id,from_status,to_status,changed_by)
    values(new.id,old.status,new.status,auth.uid());
  end if;
  return new;
end$$;
drop trigger if exists restaurant_orders_track_status on public.restaurant_orders;
create trigger restaurant_orders_track_status after update of status on public.restaurant_orders for each row execute function public.track_restaurant_order_status();

create or replace function public.admin_list_users(search_text text default null,result_limit integer default 50,result_offset integer default 0)
returns table(id uuid,display_name text,email text,phone text,role public.app_role,created_at timestamptz,restaurants jsonb)
language plpgsql stable security definer set search_path=public,auth as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  return query select p.id,p.display_name,u.email,p.phone,p.role,p.created_at,
    coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'member_role',m.role)) filter(where r.id is not null),'[]'::jsonb)
  from public.profiles p join auth.users u on u.id=p.id
  left join public.restaurant_members m on m.user_id=p.id left join public.restaurants r on r.id=m.restaurant_id
  where nullif(trim(search_text),'') is null or p.display_name ilike '%'||trim(search_text)||'%' or u.email ilike '%'||trim(search_text)||'%' or p.phone ilike '%'||trim(search_text)||'%'
  group by p.id,p.display_name,u.email,p.phone,p.role,p.created_at order by p.created_at desc limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
end$$;
grant execute on function public.admin_list_users(text,integer,integer) to authenticated;

create or replace function public.admin_set_user_role(target_user uuid,new_role public.app_role) returns void language plpgsql security definer set search_path=public as $$
declare target_role public.app_role; super_admin_count integer;
begin
  if not public.is_super_admin() then raise exception 'Seul un super administrateur peut modifier les rôles administratifs.'; end if;
  select role into target_role from public.profiles where id=target_user for update;
  if target_role is null then raise exception 'Utilisateur introuvable.'; end if;
  if target_role='super_admin' and new_role<>'super_admin' then
    select count(*) into super_admin_count from public.profiles where role='super_admin';
    if super_admin_count<=1 then raise exception 'Le dernier super administrateur ne peut pas être rétrogradé.'; end if;
  end if;
  update public.profiles set role=new_role,updated_at=now() where id=target_user;
end$$;

create or replace function public.admin_dashboard_counts() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'Accès refusé.'; end if;
 select jsonb_build_object(
  'activeRestaurants',(select count(*) from public.restaurants where validation_status='approved' and archived_at is null),
  'suspendedRestaurants',(select count(*) from public.restaurants where validation_status='suspended'),
  'activeProducts',(select count(*) from public.products where not is_archived and not hidden_by_admin and availability),
  'hiddenProducts',(select count(*) from public.products where hidden_by_admin or moderation_status='hidden'),
  'users',(select count(*) from public.profiles),
  'activePromotions',(select count(*) from public.promotions where is_active and archived_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()))
 ) into result; return result;
end$$;
grant execute on function public.admin_dashboard_counts() to authenticated;
