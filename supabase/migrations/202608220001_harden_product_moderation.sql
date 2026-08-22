-- A vendor may edit a moderated product to correct its content, but cannot
-- make a product hidden by the platform orderable again.
create or replace function public.protect_product_moderation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() and (
    new.moderation_status is distinct from old.moderation_status or
    new.moderation_note is distinct from old.moderation_note or
    new.hidden_by_admin is distinct from old.hidden_by_admin or
    new.is_featured is distinct from old.is_featured
  ) then
    raise exception 'La modération du produit est gérée par Come & Eat.';
  end if;

  if not public.is_admin() and old.hidden_by_admin and new.availability then
    raise exception 'Un produit masqué par Come & Eat ne peut pas être réactivé.';
  end if;

  return new;
end;
$$;

-- Keep the media ownership and restaurant isolation explicit for both the
-- existing row and its new values during an update.
drop policy if exists media_manager_write on public.media;
create policy media_manager_write on public.media
for update to authenticated
using (
  public.is_admin() or (
    owner_user_id=auth.uid() and
    (restaurant_id is null or public.can_manage_restaurant(restaurant_id))
  )
)
with check (
  public.is_admin() or (
    owner_user_id=auth.uid() and
    (restaurant_id is null or public.can_manage_restaurant(restaurant_id))
  )
);
