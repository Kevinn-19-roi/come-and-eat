create or replace function public.admin_list_users(search_text text default null,result_limit integer default 50,result_offset integer default 0)
returns table(id uuid,display_name text,email text,phone text,role public.app_role,created_at timestamptz,restaurants jsonb)
language plpgsql stable security definer set search_path=public,auth as $$
begin
  if not public.is_admin() then raise exception 'Accès refusé.'; end if;
  return query select p.id,p.display_name,u.email::text,p.phone,p.role,p.created_at,
    coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'member_role',m.role)) filter(where r.id is not null),'[]'::jsonb)
  from public.profiles p join auth.users u on u.id=p.id
  left join public.restaurant_members m on m.user_id=p.id left join public.restaurants r on r.id=m.restaurant_id
  where nullif(trim(search_text),'') is null or p.display_name ilike '%'||trim(search_text)||'%' or u.email ilike '%'||trim(search_text)||'%' or p.phone ilike '%'||trim(search_text)||'%'
  group by p.id,p.display_name,u.email,p.phone,p.role,p.created_at order by p.created_at desc limit least(greatest(result_limit,1),100) offset greatest(result_offset,0);
end$$;
