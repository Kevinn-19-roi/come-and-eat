-- Separate, cumulative platform responsibilities; never widen legacy is_admin().
create table public.platform_staff (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 is_active boolean not null default true,
 updated_at timestamptz not null default now()
);
create table public.platform_staff_roles (
 user_id uuid references public.platform_staff(user_id) on delete cascade,
 role text not null check(role in ('orders_admin','delivery_admin','support_admin','menu_admin','finance_admin')),
 primary key(user_id,role)
);
create table public.platform_audit_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 action text not null, target_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.platform_staff enable row level security;
alter table public.platform_staff_roles enable row level security;
alter table public.platform_audit_events enable row level security;
create policy staff_read on public.platform_staff for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
create policy staff_roles_read on public.platform_staff_roles for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
create policy audit_read on public.platform_audit_events for select to authenticated using(public.is_super_admin());
revoke all on public.platform_staff,public.platform_staff_roles,public.platform_audit_events from anon,authenticated;
grant select on public.platform_staff,public.platform_staff_roles,public.platform_audit_events to authenticated;

create function public.has_platform_permission(permission text) returns boolean
language sql stable security definer set search_path=public as $$
 select case
 when permission is null or permission<>all(array['orders.read','orders.operate','planning.manage','planning.deliveries','delivery.operate','reviews.moderate','support.manage','catering.manage','refund.request','catalog.manage','media.manage','finance.read','payment.confirm','subscriptions.manage','team.manage','refund.approve','finance.configure']) then false
 when exists(select 1 from public.platform_staff s where s.user_id=auth.uid() and not s.is_active) then false
 when public.is_super_admin() then true
 when public.current_role()='admin' then permission not in ('team.manage','refund.approve','finance.configure')
 else exists(select 1 from public.platform_staff s join public.platform_staff_roles r using(user_id)
  where s.user_id=auth.uid() and s.is_active and permission=any(case r.role
   when 'orders_admin' then array['orders.read','orders.operate','planning.manage']
   when 'delivery_admin' then array['delivery.operate','planning.deliveries']
   when 'support_admin' then array['reviews.moderate','support.manage','catering.manage','refund.request']
   when 'menu_admin' then array['catalog.manage','media.manage']
   when 'finance_admin' then array['finance.read','payment.confirm','subscriptions.manage','refund.request']
   else array[]::text[] end)) end
$$;
revoke all on function public.has_platform_permission(text) from public,anon;
grant execute on function public.has_platform_permission(text) to anon,authenticated;

create function public.set_platform_staff(target uuid, responsibilities text[], active boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_platform_permission('team.manage') then raise exception 'FORBIDDEN'; end if;
 if responsibilities is null or not responsibilities <@ array['orders_admin','delivery_admin','support_admin','menu_admin','finance_admin'] then raise exception 'INVALID_ROLE'; end if;
 if exists(select 1 from public.profiles where id=target and role='super_admin') then raise exception 'SUPER_ADMIN_PROTECTED'; end if;
 if exists(select 1 from public.profiles where id=target and role='admin') then raise exception 'LEGACY_ADMIN_CONFLICT'; end if;
 insert into public.platform_staff(user_id,is_active) values(target,active)
 on conflict(user_id) do update set is_active=excluded.is_active,updated_at=now();
 delete from public.platform_staff_roles where user_id=target;
 insert into public.platform_staff_roles(user_id,role) select target,unnest(responsibilities) on conflict do nothing;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'team.updated',target,jsonb_build_object('roles',responsibilities,'active',active));
end $$;
revoke all on function public.set_platform_staff(uuid,text[],boolean) from public,anon;
grant execute on function public.set_platform_staff(uuid,text[],boolean) to authenticated;

create table public.product_reviews (
 id uuid primary key default gen_random_uuid(),
 order_item_id uuid not null unique references public.order_items(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 restaurant_id uuid not null references public.restaurants(id) on delete restrict,
 rating smallint not null check(rating between 1 and 5),
 comment text not null default '' check(length(comment)<=2000),
 is_visible boolean not null default true, moderation_reason text,
 vendor_reply text check(length(vendor_reply)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index product_reviews_product_idx on public.product_reviews(product_id,created_at desc);
create table public.review_reports (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references public.product_reviews(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(length(reason) between 5 and 1000),
 created_at timestamptz not null default now(),unique(review_id,user_id)
);
alter table public.product_reviews enable row level security;
alter table public.review_reports enable row level security;
revoke all on public.product_reviews,public.review_reports from anon,authenticated;
grant select on public.product_reviews,public.review_reports to authenticated;
create policy reviews_private_read on public.product_reviews for select to authenticated using(user_id=auth.uid() or public.is_restaurant_member(restaurant_id) or public.has_platform_permission('reviews.moderate'));
create policy reports_read on public.review_reports for select to authenticated using(user_id=auth.uid() or public.has_platform_permission('reviews.moderate'));

create function public.submit_verified_review(target_item uuid,stars integer,review_text text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare item record; result uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
 if stars not between 1 and 5 or stars is null or length(coalesce(review_text,''))>2000 then raise exception 'INVALID_REVIEW'; end if;
 select i.id,i.product_id,ro.restaurant_id into item from public.order_items i
 join public.restaurant_orders ro on ro.id=i.restaurant_order_id join public.orders o on o.id=ro.order_id
 where i.id=target_item and o.customer_user_id=auth.uid() and ro.status in ('delivered','collected') and ro.payment_status='paid' and i.product_id is not null;
 if not found then raise exception 'VERIFIED_PURCHASE_REQUIRED'; end if;
 insert into public.product_reviews(order_item_id,user_id,product_id,restaurant_id,rating,comment)
 values(item.id,auth.uid(),item.product_id,item.restaurant_id,stars,trim(coalesce(review_text,''))) returning id into result;
 return result;
end $$;
create function public.list_public_product_reviews(target_product uuid)
returns table(id uuid,rating smallint,comment text,display_name text,vendor_reply text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select r.id,r.rating,r.comment,coalesce(nullif(split_part(p.display_name,' ',1),''),'Client'),r.vendor_reply,r.created_at
 from public.product_reviews r join public.profiles p on p.id=r.user_id join public.products product on product.id=r.product_id
 join public.restaurants restaurant on restaurant.id=product.restaurant_id
 where r.product_id=target_product and r.is_visible and not product.hidden_by_admin and not product.is_archived
 and product.moderation_status='approved' and restaurant.validation_status='approved'
 order by r.created_at desc limit 100
$$;
create function public.moderate_product_review(target_review uuid,visible boolean,reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_platform_permission('reviews.moderate') then raise exception 'FORBIDDEN'; end if;
 if visible is null or length(coalesce(reason,''))>1000 then raise exception 'INVALID_MODERATION';end if;
 if not visible and length(trim(coalesce(reason,'')))<5 then raise exception 'REASON_REQUIRED'; end if;
 update public.product_reviews set is_visible=visible,moderation_reason=reason,updated_at=now() where id=target_review;
 if not found then raise exception 'NOT_FOUND';end if;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'review.moderated',target_review,jsonb_build_object('visible',visible,'reason',reason));
end $$;
create function public.report_product_review(target_review uuid,reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or length(trim(reason)) not between 5 and 1000 then raise exception 'INVALID_REPORT'; end if;
 if not exists(select 1 from public.product_reviews where id=target_review and is_visible) then raise exception 'NOT_FOUND'; end if;
 insert into public.review_reports(review_id,user_id,reason) values(target_review,auth.uid(),trim(reason)) on conflict(review_id,user_id) do nothing;
end $$;
create function public.reply_product_review(target_review uuid,reply text)
returns void language plpgsql security definer set search_path=public as $$
declare restaurant uuid;
begin
 select restaurant_id into restaurant from public.product_reviews where id=target_review;
 if not public.can_manage_restaurant(restaurant) then raise exception 'FORBIDDEN'; end if;
 if length(trim(coalesce(reply,'')))>2000 then raise exception 'INVALID_REPLY'; end if;
 update public.product_reviews set vendor_reply=trim(reply),updated_at=now() where id=target_review;
end $$;
revoke all on function public.submit_verified_review(uuid,integer,text),public.list_public_product_reviews(uuid),public.moderate_product_review(uuid,boolean,text),public.report_product_review(uuid,text),public.reply_product_review(uuid,text) from public;
grant execute on function public.list_public_product_reviews(uuid) to anon,authenticated;
grant execute on function public.submit_verified_review(uuid,integer,text),public.moderate_product_review(uuid,boolean,text),public.report_product_review(uuid,text),public.reply_product_review(uuid,text) to authenticated;

create function public.review_eligible_items()
returns table(id uuid,product_name text,reference text)
language sql stable security definer set search_path=public as $$
 select i.id,i.product_name,o.reference from public.order_items i
 join public.restaurant_orders ro on ro.id=i.restaurant_order_id join public.orders o on o.id=ro.order_id
 where o.customer_user_id=auth.uid() and ro.status in ('delivered','collected') and ro.payment_status='paid'
 and i.product_id is not null and not exists(select 1 from public.product_reviews r where r.order_item_id=i.id)
 order by o.created_at desc limit 100
$$;
revoke all on function public.review_eligible_items() from public,anon;
grant execute on function public.review_eligible_items() to authenticated;

create function public.public_product_review_summary(target_product uuid)
returns table(average_rating numeric,review_count bigint)
language sql stable security definer set search_path=public as $$
 select round(avg(r.rating),1),count(*) from public.product_reviews r
 join public.products p on p.id=r.product_id join public.restaurants s on s.id=p.restaurant_id
 where r.product_id=target_product and r.is_visible and not p.hidden_by_admin and not p.is_archived
 and p.moderation_status='approved' and s.validation_status='approved'
$$;
revoke all on function public.public_product_review_summary(uuid) from public;
grant execute on function public.public_product_review_summary(uuid) to anon,authenticated;

create function public.my_platform_permissions() returns text[] language sql stable security definer set search_path=public as $$
 select coalesce(array_agg(permission),'{}') from unnest(array['orders.read','orders.operate','planning.manage','planning.deliveries','delivery.operate','reviews.moderate','support.manage','catering.manage','refund.request','catalog.manage','media.manage','finance.read','payment.confirm','subscriptions.manage','team.manage','refund.approve','finance.configure']) permission
 where public.has_platform_permission(permission)
$$;
revoke all on function public.my_platform_permissions() from public,anon;
grant execute on function public.my_platform_permissions() to authenticated;
