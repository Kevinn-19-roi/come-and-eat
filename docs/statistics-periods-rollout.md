# Périodes statistiques — procédure de mise en production

Les migrations `202610130001_statistics_periods.sql` et `202610130002_admin_user_export_activity.sql` sont additives. Elles ne suppriment et ne réécrivent aucune commande, aucun paiement ni aucun utilisateur.

## Ordre de déploiement

1. Vérifier que la copie de travail est propre et que tous les tests sont verts.
2. Prévisualiser les migrations avec `npx supabase db push --dry-run`.
3. Appliquer la migration avec `npx supabase db push`.
4. Vérifier dans Supabase qu'une seule période possède `ended_at is null`.
5. Vérifier en SQL que `admin_statistics_summary(starts_at)` et `admin_export_users(...)` ne sont exécutables que par un administrateur authentifié.
6. Déployer ensuite le code applicatif qui utilise ces fonctions.
7. Ouvrir `/admin` et `/admin/settings`, puis confirmer que les compteurs et l'historique des périodes sont lisibles.

## Vérifications SQL non destructives

```sql
select id, starts_at, ended_at, started_by
from public.statistics_periods
order by starts_at desc;

select count(*) as active_periods
from public.statistics_periods
where ended_at is null;
```

`active_periods` doit toujours valoir `1`.

## Retour arrière

En cas de problème d'interface, revenir d'abord au déploiement applicatif précédent. La table peut rester en place sans modifier les commandes historiques.

Ne supprimer la fonction et la table qu'après confirmation qu'aucun déploiement ne les utilise plus :

```sql
drop function if exists public.admin_statistics_summary(timestamptz);
drop function if exists public.admin_start_statistics_period();
drop table if exists public.statistics_periods;
```

Cette dernière étape supprime uniquement les marqueurs de périodes statistiques, jamais les commandes ni les paiements. Elle doit être exécutée manuellement uniquement si un retrait complet de la fonctionnalité est décidé.
