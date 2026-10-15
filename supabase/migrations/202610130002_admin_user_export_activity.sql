create or replace function public.admin_export_users(
  search_text text default null,
  result_limit integer default 100,
  result_offset integer default 0
)
returns table(
  display_name text,
  email text,
  phone text,
  role public.app_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  return query
  select p.display_name, u.email::text, p.phone, p.role, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where nullif(trim(search_text), '') is null
    or p.display_name ilike '%' || trim(search_text) || '%'
    or u.email ilike '%' || trim(search_text) || '%'
    or p.phone ilike '%' || trim(search_text) || '%'
  order by p.created_at desc, p.id
  limit least(greatest(result_limit, 1), 100)
  offset greatest(result_offset, 0);
end;
$$;

revoke all on function public.admin_export_users(text, integer, integer) from public, anon;
grant execute on function public.admin_export_users(text, integer, integer) to authenticated;
