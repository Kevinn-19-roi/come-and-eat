alter table public.restaurants add column accepts_messages boolean not null default false;
create table public.conversations(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.profiles(id) on delete restrict,
 restaurant_id uuid references public.restaurants(id) on delete restrict,subject text not null check(length(subject) between 3 and 120),
 status text not null default 'open' check(status in ('open','closed')),request_key uuid not null unique,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.conversation_messages(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 conversation_id uuid not null references public.conversations(id) on delete restrict,author_id uuid not null references public.profiles(id) on delete restrict,
 sender_kind text not null check(sender_kind in ('customer','support','restaurant')),
 body text not null check(length(trim(body)) between 1 and 4000),request_key uuid not null unique,created_at timestamptz not null default now()
);
create table public.conversation_reads(
 conversation_id uuid not null references public.conversations(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 last_sequence bigint not null default 0,primary key(conversation_id,user_id)
);
create index conversations_customer_idx on public.conversations(customer_id,updated_at desc);
create index conversations_restaurant_idx on public.conversations(restaurant_id,updated_at desc);
create index messages_conversation_idx on public.conversation_messages(conversation_id,sequence desc);
create index messages_rate_idx on public.conversation_messages(author_id,created_at desc);
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_reads enable row level security;
create function public.can_access_conversation(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from public.conversations c where c.id=target and
 (c.customer_id=auth.uid() or public.is_admin() or c.restaurant_id is null and public.has_platform_permission('support.manage')
 or c.restaurant_id is not null and public.can_manage_restaurant(c.restaurant_id)))
$$;
create policy conversations_read on public.conversations for select to authenticated using(public.can_access_conversation(id));
create policy messages_read on public.conversation_messages for select to authenticated using(public.can_access_conversation(conversation_id));
create policy read_markers_read on public.conversation_reads for select to authenticated using(user_id=auth.uid() and public.can_access_conversation(conversation_id));
revoke all on public.conversations,public.conversation_messages,public.conversation_reads from anon,authenticated;
grant select on public.conversations,public.conversation_messages,public.conversation_reads to authenticated;
revoke all on function public.can_access_conversation(uuid) from public,anon;
grant execute on function public.can_access_conversation(uuid) to authenticated;

create function public.send_conversation_message(target uuid,message text,request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare conversation public.conversations;result uuid;kind text;
begin
 if not public.can_access_conversation(target) then raise exception 'FORBIDDEN';end if;
 if request is null or message is null or length(trim(message)) not between 1 and 4000 then raise exception 'INVALID_MESSAGE';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,714));
 select id into result from public.conversation_messages where request_key=request and author_id=auth.uid() and conversation_id=target;
 if found then return result;end if;
 select * into conversation from public.conversations where id=target for update;
 if conversation.status<>'open' then raise exception 'CONVERSATION_CLOSED';end if;
 if (select count(*) from public.conversation_messages where author_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'RATE_LIMIT';end if;
 kind:=case when conversation.customer_id=auth.uid() then 'customer' when conversation.restaurant_id is null or public.is_admin() then 'support' else 'restaurant' end;
 insert into public.conversation_messages(conversation_id,author_id,sender_kind,body,request_key) values(target,auth.uid(),kind,trim(message),request) returning id into result;
 update public.conversations set updated_at=now() where id=target;return result;
end $$;
create function public.open_conversation(subject text,message text,request uuid,restaurant uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'LOGIN_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,714));
 select id into result from public.conversations where request_key=request and customer_id=auth.uid();if found then return result;end if;
 if request is null or subject is null or length(trim(subject)) not between 3 and 120 then raise exception 'INVALID_SUBJECT';end if;
 if restaurant is not null and not exists(select 1 from public.restaurants where id=restaurant and accepts_messages and validation_status='approved' and archived_at is null) then raise exception 'RESTAURANT_UNAVAILABLE';end if;
 if (select count(*) from public.conversations where customer_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'RATE_LIMIT';end if;
 insert into public.conversations(customer_id,restaurant_id,subject,request_key) values(auth.uid(),restaurant,trim(subject),request) returning id into result;
 perform public.send_conversation_message(result,message,request);return result;
end $$;
create function public.mark_conversation_read(target uuid,through_message uuid) returns void
language plpgsql security definer set search_path=public as $$
declare last_read bigint;
begin
 if not public.can_access_conversation(target) then raise exception 'FORBIDDEN';end if;
 select sequence into last_read from public.conversation_messages where id=through_message and conversation_id=target;
 if last_read is null then raise exception 'INVALID_MESSAGE';end if;
 insert into public.conversation_reads(conversation_id,user_id,last_sequence) values(target,auth.uid(),last_read)
 on conflict(conversation_id,user_id) do update set last_sequence=greatest(public.conversation_reads.last_sequence,excluded.last_sequence);
end $$;
create function public.close_conversation(target uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.can_access_conversation(target) then raise exception 'FORBIDDEN';end if;
 update public.conversations set status='closed',updated_at=now() where id=target and status='open';
end $$;
create function public.my_conversations() returns table(id uuid,subject text,status text,restaurant_id uuid,updated_at timestamptz,unread bigint)
language sql stable security definer set search_path=public as $$
 select c.id,c.subject,c.status,c.restaurant_id,c.updated_at,(select count(*) from public.conversation_messages m where m.conversation_id=c.id and m.author_id<>auth.uid() and m.sequence>coalesce((select last_sequence from public.conversation_reads r where r.conversation_id=c.id and r.user_id=auth.uid()),0))
 from public.conversations c where public.can_access_conversation(c.id) order by c.updated_at desc,c.id limit 100
$$;
revoke all on function public.send_conversation_message(uuid,text,uuid),public.open_conversation(text,text,uuid,uuid),public.mark_conversation_read(uuid,uuid),public.close_conversation(uuid),public.my_conversations() from public,anon;
grant execute on function public.send_conversation_message(uuid,text,uuid),public.open_conversation(text,text,uuid,uuid),public.mark_conversation_read(uuid,uuid),public.close_conversation(uuid),public.my_conversations() to authenticated;
