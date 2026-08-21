-- Seller application identity verification and review workflow.
-- Additive migration: all previous marketplace migrations remain unchanged.

alter table public.seller_applications
  add column if not exists applicant_name text,
  add column if not exists applicant_address text,
  add column if not exists applicant_commune text,
  add column if not exists identity_type text,
  add column if not exists identity_number text,
  add column if not exists establishment_photo_paths text[] not null default '{}',
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;

alter table public.seller_applications
  drop constraint if exists seller_applications_identity_type_check;
alter table public.seller_applications
  add constraint seller_applications_identity_type_check check (
    identity_type is null or identity_type in ('cni','passport','identity_certificate','drivers_license','other')
  );

create table if not exists public.seller_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.seller_applications(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('identity_front','identity_back','business_registry','business_registration','other_business')),
  label text not null default '',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  created_at timestamptz not null default now()
);

create table if not exists public.seller_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.seller_applications(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  status public.seller_application_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists seller_application_documents_application_idx on public.seller_application_documents(application_id, created_at);
create index if not exists seller_application_events_application_idx on public.seller_application_events(application_id, created_at desc);

alter table public.seller_application_documents enable row level security;
alter table public.seller_application_events enable row level security;

create policy seller_documents_read on public.seller_application_documents for select to authenticated
using (owner_user_id = auth.uid() or public.is_admin());
create policy seller_documents_create on public.seller_application_documents for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.seller_applications application
    where application.id = application_id and application.user_id = auth.uid()
      and application.status in ('draft','changes_requested')
  )
);
create policy seller_documents_delete on public.seller_application_documents for delete to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1 from public.seller_applications application
    where application.id = application_id and application.user_id = auth.uid()
      and application.status in ('draft','changes_requested')
  )
);

create policy seller_events_read on public.seller_application_events for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.seller_applications application
    where application.id = application_id and application.user_id = auth.uid()
  )
);
create policy seller_events_submit on public.seller_application_events for insert to authenticated
with check (
  actor_user_id=auth.uid() and status='submitted' and exists (
    select 1 from public.seller_applications application
    where application.id=application_id and application.user_id=auth.uid()
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('seller-documents','seller-documents',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy seller_document_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='seller-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy seller_document_objects_read on storage.objects for select to authenticated
using (bucket_id='seller-documents' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy seller_document_objects_delete on storage.objects for delete to authenticated
using (bucket_id='seller-documents' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.review_seller_application(
  target_application_id uuid,
  decision public.seller_application_status,
  review_note text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  application public.seller_applications;
  target_restaurant_id uuid;
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  if decision not in ('approved','rejected','changes_requested','under_review') then
    raise exception 'Décision non autorisée.';
  end if;
  if decision in ('rejected','changes_requested') and nullif(trim(review_note),'') is null then
    raise exception 'Une explication est nécessaire.';
  end if;

  select * into application from public.seller_applications where id=target_application_id for update;
  if application.id is null then raise exception 'Demande introuvable.'; end if;
  if application.status not in ('submitted','under_review','changes_requested') then
    raise exception 'Cette demande ne peut pas être examinée dans son état actuel.';
  end if;

  target_restaurant_id := application.restaurant_id;
  if decision='approved' then
    if target_restaurant_id is null then
      insert into public.restaurants(
        name,description,phone,whatsapp,email,address,commune,latitude,longitude,maps_url,
        logo_path,cover_path,delivery_available,pickup_available,validation_status,operating_status
      ) values (
        application.restaurant_name,application.description,application.phone,application.whatsapp,application.email,
        application.address,application.commune,application.latitude,application.longitude,application.maps_url,
        application.logo_path,application.cover_path,application.delivery_available,application.pickup_available,'approved','closed'
      ) returning id into target_restaurant_id;
    else
      update public.restaurants set validation_status='approved',rejection_reason=null,updated_at=now()
      where id=target_restaurant_id;
    end if;

    insert into public.restaurant_members(restaurant_id,user_id,role)
    values(target_restaurant_id,application.user_id,'owner')
    on conflict(restaurant_id,user_id) do update set role='owner';
    update public.profiles set role='vendor',updated_at=now()
    where id=application.user_id and role='customer';
  end if;

  update public.seller_applications set
    status=decision,admin_notes=nullif(trim(review_note),''),reviewed_by=auth.uid(),reviewed_at=now(),
    restaurant_id=coalesce(target_restaurant_id,restaurant_id),updated_at=now()
  where id=target_application_id;
  insert into public.seller_application_events(application_id,actor_user_id,status,note)
  values(target_application_id,auth.uid(),decision,nullif(trim(review_note),''));
  return target_restaurant_id;
end;
$$;

create or replace function public.approve_seller_application(application_id uuid) returns uuid
language sql security definer set search_path=public
as $$ select public.review_seller_application(application_id,'approved',null) $$;

grant select,insert,delete on public.seller_application_documents to authenticated;
grant select,insert on public.seller_application_events to authenticated;
grant execute on function public.review_seller_application(uuid,public.seller_application_status,text) to authenticated;
