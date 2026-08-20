-- Sprint 3.1: public auth context and the unique platform-owned restaurant.
alter table public.restaurants
  add column if not exists is_official boolean not null default false;

create unique index if not exists restaurants_one_official_idx
  on public.restaurants (is_official)
  where is_official;

do $$
declare official_id uuid;
begin
  select id into official_id
  from public.restaurants
  where is_official
  limit 1;

  if official_id is null then
    select id into official_id
    from public.restaurants
    where slug = 'come-eat-cocody'
    limit 1;
  end if;

  if official_id is null then
    insert into public.restaurants (
      name, slug, description, average_prep_minutes,
      delivery_available, pickup_available, operating_status, validation_status,
      is_official
    ) values (
      'Come & Eat', 'come-and-eat',
      'La boutique officielle Come & Eat.', 25,
      true, true, 'open', 'approved', true
    ) returning id into official_id;
  else
    update public.restaurants
    set is_official = (id = official_id), updated_at = now()
    where is_official or id = official_id;
  end if;
end $$;

create or replace function public.can_manage_restaurant(target uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_admin() or exists(
    select 1
    from public.restaurant_members rm
    join public.restaurants r on r.id=rm.restaurant_id
    where rm.restaurant_id=target
      and rm.user_id=auth.uid()
      and rm.role in ('owner','manager')
      and not r.is_official
  );
$$;

-- A regular member can never mutate the platform store. Admin access remains
-- governed by is_admin(), including for products, options, hours and media.
drop policy if exists restaurants_manager_write on public.restaurants;
create policy restaurants_manager_write on public.restaurants for update
  using ((not is_official and public.can_manage_restaurant(id)) or public.is_admin())
  with check ((not is_official and public.can_manage_restaurant(id)) or public.is_admin());

drop policy if exists products_manager_write on public.products;
create policy products_manager_write on public.products for all
  using (
    public.is_admin() or (
      public.can_manage_restaurant(restaurant_id)
      and not exists(select 1 from public.restaurants r where r.id=restaurant_id and r.is_official)
    )
  )
  with check (
    public.is_admin() or (
      public.can_manage_restaurant(restaurant_id)
      and not exists(select 1 from public.restaurants r where r.id=restaurant_id and r.is_official)
    )
  );

create or replace function public.is_official_restaurant(target uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.restaurants where id=target and is_official);
$$;

grant execute on function public.is_official_restaurant(uuid) to authenticated;
