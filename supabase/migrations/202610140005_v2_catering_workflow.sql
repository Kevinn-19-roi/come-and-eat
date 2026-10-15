-- Additive quote lifecycle. Publishing is not an email delivery or a payment.
alter table public.catering_quotes add column published_at timestamptz;
alter table public.catering_quotes add column decided_at timestamptz;
create unique index catering_one_current_quote_idx on public.catering_quotes(request_id) where status in ('sent','accepted');
create index catering_quotes_request_idx on public.catering_quotes(request_id,created_at desc);
create index catering_events_request_idx on public.catering_events(request_id,created_at desc);

create function public.publish_catering_quote(target_quote uuid)
returns void language plpgsql security definer set search_path=public as $$
declare q public.catering_quotes; r public.catering_requests; request_id uuid;
begin
 if not public.has_platform_permission('catering.manage') then raise exception 'FORBIDDEN';end if;
 select c.request_id into request_id from public.catering_quotes c where c.id=target_quote;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into r from public.catering_requests where id=request_id for update;
 select * into q from public.catering_quotes where id=target_quote for update;
 if q.status='sent' then return;end if;
 if q.status<>'draft' or q.valid_until<current_date or r.status not in ('new','reviewing','quoted') then raise exception 'QUOTE_NOT_PUBLISHABLE';end if;
 update public.catering_quotes set status='expired' where catering_quotes.request_id=r.id and status='sent' and valid_until<current_date;
 if exists(select 1 from public.catering_quotes where catering_quotes.request_id=r.id and status in ('sent','accepted')) then raise exception 'CURRENT_QUOTE_EXISTS';end if;
 update public.catering_quotes set status='sent',published_at=now() where id=q.id;
 update public.catering_requests set status='quoted',updated_at=now() where id=r.id;
 insert into public.catering_events(request_id,actor_id,note,status) values(r.id,auth.uid(),'Devis mis à disposition du client.','quoted');
 insert into public.v2_notification_jobs(event_key,event_type,recipient,payload)
 values('catering:'||q.id||':published','catering_quote_published',r.email,jsonb_build_object('requestId',r.id,'quoteId',q.id,'name',r.name)) on conflict(event_key) do nothing;
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'catering.quote_published',q.id,jsonb_build_object('total',q.total));
end $$;

create function public.respond_catering_quote(target_quote uuid,accept boolean)
returns void language plpgsql security definer set search_path=public as $$
declare q public.catering_quotes;r public.catering_requests;request_id uuid;decision text;
begin
 if auth.uid() is null or accept is null then raise exception 'LOGIN_REQUIRED';end if;
 select c.request_id into request_id from public.catering_quotes c where c.id=target_quote;
 select * into r from public.catering_requests where id=request_id and user_id=auth.uid() for update;
 if not found then raise exception 'FORBIDDEN';end if;
 select * into q from public.catering_quotes where id=target_quote for update;
 decision:=case when accept then 'accepted' else 'rejected' end;
 if q.status=decision then return;end if;
 if q.status<>'sent' or q.valid_until<current_date or r.status<>'quoted' then raise exception 'QUOTE_NOT_AVAILABLE';end if;
 update public.catering_quotes set status=decision,decided_at=now() where id=q.id;
 update public.catering_requests set status=decision,updated_at=now() where id=r.id;
 insert into public.catering_events(request_id,actor_id,note,status) values(r.id,auth.uid(),case when accept then 'Devis accepté par le client. Aucun encaissement automatique.' else 'Devis refusé par le client.' end,decision);
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'catering.quote_response',q.id,jsonb_build_object('accepted',accept));
end $$;

create or replace function public.manage_catering_request(target uuid,new_status text,note text,restaurant uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare old_status text;
begin
 if not public.has_platform_permission('catering.manage') then raise exception 'FORBIDDEN';end if;
 if new_status is null or new_status not in ('new','reviewing','quoted','accepted','rejected','cancelled','completed') or length(coalesce(note,''))>4000 then raise exception 'INVALID_INPUT';end if;
 select status into old_status from public.catering_requests where id=target for update;if not found then raise exception 'NOT_FOUND';end if;
 if new_status in ('quoted','accepted') and new_status<>old_status then raise exception 'USE_QUOTE_WORKFLOW';end if;
 if new_status='completed' and old_status not in ('accepted','completed') then raise exception 'INVALID_TRANSITION';end if;
 if old_status in ('cancelled','completed','rejected') and new_status<>old_status then raise exception 'REQUEST_CLOSED';end if;
 if new_status='new' and old_status<>'new' or old_status='accepted' and new_status in ('new','reviewing','quoted') then raise exception 'INVALID_TRANSITION';end if;
 if new_status in ('rejected','cancelled') and length(trim(coalesce(note,'')))<5 then raise exception 'REASON_REQUIRED';end if;
 if restaurant is not null and not exists(select 1 from public.restaurants where id=restaurant and validation_status='approved') then raise exception 'INVALID_RESTAURANT';end if;
 update public.catering_requests set status=new_status,assigned_restaurant_id=restaurant,updated_at=now() where id=target;
 insert into public.catering_events(request_id,actor_id,note,status) values(target,auth.uid(),coalesce(note,''),new_status);
 insert into public.platform_audit_events(actor_id,action,target_id,details) values(auth.uid(),'catering.updated',target,jsonb_build_object('from',old_status,'to',new_status,'restaurant',restaurant));
end $$;
revoke all on function public.publish_catering_quote(uuid),public.respond_catering_quote(uuid,boolean) from public,anon;
grant execute on function public.publish_catering_quote(uuid),public.respond_catering_quote(uuid,boolean) to authenticated;
