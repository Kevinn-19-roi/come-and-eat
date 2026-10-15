# Dernière passe locale — 14 octobre 2026

## Contact

Le formulaire public utilise maintenant une Server Action et le fournisseur Resend existant. Nom, email, téléphone facultatif et message sont validés côté serveur. Les champs sont bornés, le HTML est échappé et le visiteur est placé dans Reply-To, jamais dans From.

La page Contact utilise désormais `getPublicSiteContent`, comme le header, pour ses coordonnées administrables. Les captures Contact initiales de cette passe précèdent ce dernier raccordement des données ; la structure du formulaire reste identique.

Protection : honeypot, limite partagée de 5 tentatives par heure par email/IP et plafond global de 100, verrou transactionnel, détection du même message pendant 10 minutes, idempotence fournisseur. Les IP et clés de messages sont HMAC-hachées côté serveur ; aucun message n'est conservé dans la table anti-spam. Les anciennes entrées sont purgées après 24 heures lors des requêtes suivantes. Le journal email existant conserve seulement les métadonnées d'envoi.

Le destinataire provient, dans cet ordre, de `EMAIL_CONTACT_RECIPIENT`, `site_settings.email.contact_recipient`, de l'adresse admin déjà administrable `site_settings.email.admin_recipient`, ou de `EMAIL_ADMIN_RECIPIENT`. Aucune adresse n'est inventée. Resend exige `RESEND_API_KEY` et `EMAIL_FROM` existants. Si configuration ou RPC manquent, l'interface affiche une indisponibilité et garde les coordonnées directes.

Vérification locale sans valeurs sensibles : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_CONTACT_RECIPIENT` et `EMAIL_ADMIN_RECIPIENT` absents de l'environnement local. Cela ne permet aucune conclusion sur leur présence en production. Le destinataire configuré dans Supabase n'a pas été vérifié avec un accès administrateur réel pendant cette passe.

Les tests de validation et de Server Action utilisent exclusivement des mocks : aucun email, aucune écriture Supabase distante. La limitation SQL doit encore être exécutée sur une base isolée ou lors de la recette autorisée. Les doublons et erreurs fournisseur ne sont jamais annoncés comme envoyés.

## Comparaison visuelle

Ouvrir `artifacts/comparaison-design.html` dans Edge. Les images sont locales, cliquables et comparées sur 375 et 1440 px. Les vrais avant disponibles sont conservés. Les avant produit/panier/checkout non photographiés sont signalés comme absents, sans reconstruction présentée comme preuve.

Les nouvelles captures de panier/checkout utilisent explicitement une fixture localStorage. Aucun clic de commande ni envoi n'est effectué. Les captures de restaurant/produit utilisent la lecture publique actuelle. Ce contrôle visuel ne prouve pas la persistance authentifiée ou la validité d'un paiement.

Les fonctions conservées restent dans les composants/services existants : recherche, filtres, favoris, partage, navigation par rôle, panier multi-restaurants, options multiples facultatives, Wave/espèces, commissions, suivi, admin/vendor. Les styles premium sont une couche visuelle ; aucune suppression de route ni de service métier n'est effectuée pendant cette passe.

## Migrations à appliquer dans l'ordre

1. `202610130001_statistics_periods.sql` : agrégation par sous-commande encaissée, exclusion annulée, remise répartie, protection des montants zéro ; démarrage de période sérialisé par verrou de table contre les appels concurrents.
2. `202610130002_admin_user_export_activity.sql` : export réservé admin avec pagination bornée et tri stable date + identifiant pour éviter doublons/omissions lors de dates identiques.
3. `202610140001_contact_rate_limit.sql` : nouvelle table privée RLS, RPC accessible uniquement au rôle serveur ; aucun accès navigateur aux hashes.

Aucune migration appliquée n'a été modifiée. Aucune migration distante n'a été exécutée. Le dry-run CLI vérifie le plan, pas l'exécution PostgreSQL/RLS.

## Procédure de livraison après autorisation

```powershell
Set-Location 'F:\documents\come-and-eat'
node scripts/test-contact.mjs
node scripts/test-contact-action.mjs
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:ci
npm.cmd run test:statistics-finance
npm.cmd run test:local-corrections
npm.cmd run build
git diff --check
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
```

Vérifier la cible Supabase et les trois migrations affichées avant d'autoriser :

```powershell
npx.cmd supabase db push
npx.cmd supabase migration list
```

Vérifications SQL à exécuter avec la session admin appropriée :

```sql
select version from supabase_migrations.schema_migrations
where version in ('202610130001','202610130002','202610140001');
select relname,relrowsecurity from pg_class
where oid in ('public.statistics_periods'::regclass,'public.contact_requests'::regclass);
select has_function_privilege('anon','public.claim_contact_message(text,text,text)','EXECUTE') as anon_must_be_false,
       has_function_privilege('authenticated','public.claim_contact_message(text,text,text)','EXECUTE') as authenticated_must_be_false,
       has_function_privilege('service_role','public.claim_contact_message(text,text,text)','EXECUTE') as server_must_be_true;
```

Confirmer le destinataire réel puis effectuer un unique envoi QA seulement après autorisation explicite. Contrôler réception et journal, échec provider, doublon et rate limit. Recette authentifiée : statistiques, export Excel, vendeur A/B et Storage privé. Ces étapes ne sont pas validées par les mocks locaux.

Publier uniquement les fichiers du manifeste `docs/publish-files.txt`, après lecture du diff. Exclure l'image étrangère, `artifacts/`, `.audit-backup/`, `.env.local`, `.vercel`, `.next` et `node_modules`.

Après revue, staging ciblé du manifeste :

```powershell
Get-Content docs/publish-files.txt | ForEach-Object { git add -- $_ }
git diff --cached --check
git diff --cached --stat
git commit -m "feat: finalize local quality and secure contact delivery"
git push origin main
gh run list --branch main --limit 5
```

Vérifier le workflow puis Vercel READY pour le SHA publié ; tester comeandeat.org, contact, sitemap, auth, admin/vendor et checkout sans paiement réel. En cas d'erreur, revenir au déploiement applicatif précédent et corriger la base par migration additive. Ne pas supprimer la table des périodes ou les historiques.

## Limites restantes

Validation finale exécutée : TypeScript, ESLint (avertissement de test corrigé puis lint ciblé sans avertissement), build Next.js 59 routes, suite CI, tests financiers et correctifs locaux, tests Contact validation/action avec mocks, `git diff --check`. Edge : 10 captures complémentaires restaurant/produit/panier/checkout/contact sur 375 et 1440 px, HTTP 200 et aucun débordement horizontal. Aucun fichier suivi supprimé, branche main, index Git vide.

- Aucun SMTP/Resend réel testé : autorisation d'envoi requise.
- Aucune migration exécutée sur PostgreSQL, aucun test RLS/Storage authentifié réel.
- Comparaison complète avant/après impossible pour les pages dont l'ancien état n'avait pas de capture.
- Cinq alertes npm de la chaîne ESLint restent documentées dans l'audit global.
- Aucun commit, push ou déploiement réalisé.
