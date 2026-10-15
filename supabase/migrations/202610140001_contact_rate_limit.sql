-- Server-only distributed limiter; no clear IP or message body is retained.
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  email_hash text not null,
  message_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public,anon,authenticated;
grant all on public.contact_requests to service_role;
create index if not exists contact_requests_created_idx on public.contact_requests(created_at);
create or replace function public.claim_contact_message(ip_hash text,email_hash text,message_hash text)
returns text language plpgsql security definer set search_path=public as $$
begin
  if ip_hash is null or email_hash is null or message_hash is null or length(ip_hash)<>64 or length(email_hash)<>64 or length(message_hash)<>64 then raise exception 'INVALID_HASH'; end if;
  perform pg_advisory_xact_lock(610140001);
  delete from public.contact_requests where created_at<now()-interval '24 hours';
  if exists(select 1 from public.contact_requests r where r.message_hash=$3 and r.created_at>now()-interval '10 minutes') then return 'duplicate'; end if;
  if (select count(*) from public.contact_requests r where (r.ip_hash=$1 or r.email_hash=$2) and r.created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.contact_requests r where r.created_at>now()-interval '1 hour')>=100 then return 'limited'; end if;
  insert into public.contact_requests(ip_hash,email_hash,message_hash) values($1,$2,$3);
  return 'accepted';
end $$;
revoke all on function public.claim_contact_message(text,text,text) from public,anon,authenticated;
grant execute on function public.claim_contact_message(text,text,text) to service_role;
