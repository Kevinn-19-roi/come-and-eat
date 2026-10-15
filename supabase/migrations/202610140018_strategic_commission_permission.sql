-- Legacy admin must not bypass finance.configure via direct REST or a generic
-- site-settings form. Other settings and immutable order snapshots are retained.
-- Explicit table privileges: RLS settings_admin_write still restricts DML to
-- legacy administrators; this does not grant specialized staff global access.
grant insert,update,delete on public.site_settings to authenticated;
create function public.protect_strategic_commission() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if (tg_op<>'INSERT' and old.key='marketplace_commission') or (tg_op<>'DELETE' and new.key='marketplace_commission') then
  if current_user not in ('postgres','supabase_admin','service_role') and auth.role()<>'service_role'
    and not public.has_platform_permission('finance.configure') then raise exception 'FINANCE_CONFIGURATION_FORBIDDEN';end if;
  if tg_op<>'DELETE' and new.key='marketplace_commission' then
   if jsonb_typeof(new.value->'rate_bps')<>'number' or new.value->>'rate_bps' is null
      or (new.value->>'rate_bps')::numeric not between 0 and 10000
      or trunc((new.value->>'rate_bps')::numeric)<>(new.value->>'rate_bps')::numeric then raise exception 'INVALID_COMMISSION';end if;
   new.is_public:=false;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger strategic_commission_permission before insert or update or delete on public.site_settings
for each row execute function public.protect_strategic_commission();
revoke all on function public.protect_strategic_commission() from public,anon,authenticated;

create function public.audit_strategic_commission() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.key='marketplace_commission' and auth.uid() is not null then
  insert into public.platform_audit_events(actor_id,action,details)
   values(auth.uid(),'commission.configured',jsonb_build_object('rate_bps',new.value->'rate_bps'));
 end if;return new;
end $$;
create trigger commission_configuration_audit after insert or update on public.site_settings
for each row execute function public.audit_strategic_commission();
revoke all on function public.audit_strategic_commission() from public,anon,authenticated;
