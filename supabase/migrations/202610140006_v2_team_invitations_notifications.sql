create table public.platform_invitations (
 id uuid primary key default gen_random_uuid(),email text not null,
 responsibilities text[] not null check(cardinality(responsibilities) between 1 and 5),
 invited_by uuid not null references public.profiles(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 expires_at timestamptz not null default now()+interval '7 days',accepted_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),decided_at timestamptz
);
create unique index platform_invitation_pending_email_idx on public.platform_invitations(email) where status='pending';
create function public.my_verified_email() returns text language sql stable security definer set search_path=public as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null
$$;
revoke all on function public.my_verified_email() from public,anon;
grant execute on function public.my_verified_email() to authenticated;
alter table public.platform_invitations enable row level security;
create policy invitation_read on public.platform_invitations for select to authenticated using(public.has_platform_permission('team.manage') or email=public.my_verified_email());
revoke all on public.platform_invitations from anon,authenticated;
grant select on public.platform_invitations to authenticated;

create function public.invite_platform_staff(recipient text,responsibilities text[]) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;normalized text:=lower(trim(recipient));
begin
 if not public.has_platform_permission('team.manage') then raise exception 'FORBIDDEN';end if;
 if normalized is null or length(normalized)>254 or normalized!~'^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' or responsibilities is null or cardinality(responsibilities) not between 1 and 5 or array_position(responsibilities,null) is not null or not responsibilities<@array['orders_admin','delivery_admin','support_admin','menu_admin','finance_admin'] then raise exception 'INVALID_INVITATION';end if;
 -- Expired invitations release their uniqueness slot without granting anything.
 update public.platform_invitations set status='revoked',decided_at=now() where email=normalized and status='pending' and expires_at<=now();
 insert into public.platform_invitations(email,responsibilities,invited_by) values(normalized,responsibilities,auth.uid()) returning id into result;
 insert into public.v2_notification_jobs(event_key,event_type,recipient,payload) values('invitation:'||result,'team_invitation',normalized,jsonb_build_object('invitationId',result));
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'team.invited',result,jsonb_build_object('roles',responsibilities));return result;
end $$;
create function public.revoke_platform_invitation(target uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.has_platform_permission('team.manage') then raise exception 'FORBIDDEN';end if;
 update public.platform_invitations set status='revoked',decided_at=now() where id=target and status='pending';
 if found then
  update public.v2_notification_jobs set status='cancelled',last_error='invitation_revoked' where event_key='invitation:'||target and status in ('pending','failed');
  insert into public.platform_audit_events(actor_id,action,target_id) values(auth.uid(),'team.invitation_revoked',target);
 end if;
end $$;
create function public.accept_platform_invitation(target uuid) returns void
language plpgsql security definer set search_path=public as $$
declare invitation public.platform_invitations;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into invitation from public.platform_invitations where id=target and email=public.my_verified_email() for update;
 if not found then raise exception 'FORBIDDEN';end if;
 if invitation.status='accepted' and invitation.accepted_by=auth.uid() then return;end if;
 if invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'INVITATION_EXPIRED';end if;
 if not exists(select 1 from public.profiles where id=invitation.invited_by and role='super_admin') or exists(select 1 from public.platform_staff where user_id=invitation.invited_by and not is_active) then raise exception 'INVITER_NO_LONGER_AUTHORIZED';end if;
 if exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin')) then raise exception 'LEGACY_ADMIN_CONFLICT';end if;
 if exists(select 1 from public.platform_staff where user_id=auth.uid() and not is_active) then raise exception 'ACCESS_SUSPENDED';end if;
 insert into public.platform_staff(user_id,is_active) values(auth.uid(),true) on conflict(user_id) do nothing;
 insert into public.platform_staff_roles(user_id,role) select auth.uid(),unnest(invitation.responsibilities) on conflict do nothing;
 update public.platform_invitations set status='accepted',accepted_by=auth.uid(),decided_at=now() where id=target;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'team.invitation_accepted',target,jsonb_build_object('roles',invitation.responsibilities));
end $$;
revoke all on function public.invite_platform_staff(text,text[]),public.revoke_platform_invitation(uuid),public.accept_platform_invitation(uuid) from public,anon;
grant execute on function public.invite_platform_staff(text,text[]),public.revoke_platform_invitation(uuid),public.accept_platform_invitation(uuid) to authenticated;

alter table public.v2_notification_jobs add column lock_token uuid;
alter table public.v2_notification_jobs add column provider_id text;
create function public.claim_v2_notifications(batch_size integer default 3)
returns setof public.v2_notification_jobs language plpgsql security definer set search_path=public as $$
begin
 if batch_size is null or batch_size not between 1 and 3 then raise exception 'INVALID_BATCH';end if;
 return query with candidates as (
  select id from public.v2_notification_jobs j where attempts<5 and available_at<=now()
  and created_at>now()-interval '23 hours'
  and (status in ('pending','failed') or status='processing' and locked_at<now()-interval '5 minutes')
  and (event_type<>'team_invitation' or exists(select 1 from public.platform_invitations i where i.id::text=j.payload->>'invitationId' and i.status='pending' and i.expires_at>now()))
  and (event_type<>'catering_quote_published' or exists(select 1 from public.catering_quotes q join public.catering_requests r on r.id=q.request_id where q.id::text=j.payload->>'quoteId' and q.status='sent' and q.valid_until>=current_date and r.status='quoted'))
  order by available_at for update skip locked limit batch_size
 ) update public.v2_notification_jobs j set status='processing',attempts=j.attempts+1,locked_at=now(),lock_token=gen_random_uuid()
 from candidates c where j.id=c.id returning j.*;
end $$;
create function public.finish_v2_notification(target uuid,lease uuid,success boolean,result_code text default null,provider_message text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if success is null or length(coalesce(result_code,''))>100 or length(coalesce(provider_message,''))>200 then raise exception 'INVALID_RESULT';end if;
 update public.v2_notification_jobs set status=case when success then 'sent' else 'failed' end,
 last_error=case when success then null else result_code end,provider_id=case when success then provider_message else provider_id end,
 available_at=case when success then available_at else now()+make_interval(mins=>attempts*2) end,lock_token=null,locked_at=null
 where id=target and status='processing' and lock_token=lease;
 if not found then raise exception 'LEASE_NOT_CURRENT';end if;
end $$;
revoke all on function public.claim_v2_notifications(integer),public.finish_v2_notification(uuid,uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.claim_v2_notifications(integer),public.finish_v2_notification(uuid,uuid,boolean,text,text) to service_role;

-- Guest requests can be recovered only by the verified owner of their contact email.
create function public.claim_my_catering_requests() returns integer language plpgsql security definer set search_path=public as $$
declare address text;result integer;
begin
 address:=public.my_verified_email();if address is null then return 0;end if;
 update public.catering_requests set user_id=auth.uid() where user_id is null and lower(email)=address;
 get diagnostics result=row_count;return result;
end $$;
revoke all on function public.claim_my_catering_requests() from public,anon;
grant execute on function public.claim_my_catering_requests() to authenticated;
