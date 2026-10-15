-- Search before the limit; stable cursor pagination never widens access.
create function public.conversation_inbox(search_text text default '',status_filter text default '',restaurant uuid default null,before_time timestamptz default null,before_id uuid default null)
returns table(id uuid,subject text,status text,restaurant_id uuid,updated_at timestamptz,unread bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'FORBIDDEN';end if;
 if length(coalesce(search_text,''))>120 or coalesce(status_filter,'') not in ('','open','closed','unread') or (before_time is null)<>(before_id is null) then raise exception 'INVALID_FILTER';end if;
 return query with allowed as (
  select c.id,c.subject,c.status,c.restaurant_id,c.updated_at,
   (select count(*) from public.conversation_messages m where m.conversation_id=c.id and m.author_id<>auth.uid() and m.sequence>coalesce((select r.last_sequence from public.conversation_reads r where r.conversation_id=c.id and r.user_id=auth.uid()),0)) unread
  from public.conversations c where public.can_access_conversation(c.id)
   and (restaurant is null or c.restaurant_id=restaurant)
   and c.subject ilike '%'||coalesce(search_text,'')||'%'
   and (before_time is null or (c.updated_at,c.id)<(before_time,before_id))
 ) select a.id,a.subject,a.status,a.restaurant_id,a.updated_at,a.unread from allowed a
 where coalesce(status_filter,'')='' or a.status=status_filter or status_filter='unread' and a.unread>0
 order by a.updated_at desc,a.id desc limit 101;
end $$;
revoke all on function public.conversation_inbox(text,text,uuid,timestamptz,uuid) from public,anon;
grant execute on function public.conversation_inbox(text,text,uuid,timestamptz,uuid) to authenticated;
