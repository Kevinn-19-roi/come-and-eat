-- Les groupes alimentaires standards sont facultatifs et multi-sélectionnables
-- sauf lorsqu'une limite a été configurée explicitement après ce déploiement.
update public.product_option_groups
set is_required = false,
    min_choices = 0,
    max_choices = null,
    updated_at = now()
where type in ('accompaniment', 'drink', 'supplement');

alter table public.product_option_groups
  alter column is_required set default false,
  alter column min_choices set default 0,
  alter column max_choices drop default;
