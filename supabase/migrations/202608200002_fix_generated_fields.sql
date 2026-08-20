-- Corrige la fonction générique de la migration 001 sans réécrire l'historique
-- déjà appliqué. Chaque trigger ne référence désormais que les colonnes de sa table.

drop trigger if exists restaurants_generated on public.restaurants;
drop trigger if exists categories_generated on public.categories;
drop trigger if exists cuisine_types_generated on public.cuisine_types;
drop trigger if exists products_generated on public.products;

drop function if exists public.set_generated_fields();

create or replace function public.set_restaurant_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;

create or replace function public.set_category_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;

create or replace function public.set_cuisine_type_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;

create or replace function public.set_product_generated_fields()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  if new.sku is null or new.sku = '' then
    new.sku = 'CEA-' || upper(substr(public.slugify(new.name), 1, 3)) || '-' ||
      lpad(nextval('public.product_sku_sequence')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger restaurants_generated
before insert or update of name on public.restaurants
for each row execute function public.set_restaurant_slug();

create trigger categories_generated
before insert or update of name on public.categories
for each row execute function public.set_category_slug();

create trigger cuisine_types_generated
before insert or update of name on public.cuisine_types
for each row execute function public.set_cuisine_type_slug();

create trigger products_generated
before insert or update of name on public.products
for each row execute function public.set_product_generated_fields();
