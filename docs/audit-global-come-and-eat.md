# Audit global Come & Eat — 14 octobre 2026

> Dernière passe complémentaire : consulter `docs/final-delivery.md` pour le formulaire Contact désormais raccordé, les limites réelles des tests, la troisième migration anti-spam, la comparaison HTML et les commandes de livraison. Le blocage Contact initial ci-dessous est levé côté code ; réception réelle et exécution SQL restent à vérifier après autorisation.

> Retour visuel client traité : la première passe était trop limitée en composition et sa typographie était partiellement écrasée par l'ancien CSS. La correction `food-v2`, documentée dans `docs/visual-correction-v2.md`, remplace le hero circulaire par une composition photographique plein cadre, embarque Manrope, modernise les cartes et sections publiques, et corrige le prix recouvert par la barre sticky produit. Nouvelle comparaison : `artifacts/come-and-eat-visual-comparison.html`. Les captures sont locales et les modifications restent non commitées.

## A. Synthèse exécutive

Le dépôt local `F:\documents\come-and-eat` est fonctionnel et le socle métier est cohérent : marketplace multi-restaurants, authentification, commande Wave/espèces, commissions, suivi, espaces vendeur/admin et contenu administrable. La ligne de base puis la version modernisée passent ESLint, TypeScript, les tests métier/financiers et le build Next.js.

Verdict local : **PRÊT SOUS CONDITIONS**. Les deux migrations additives doivent être appliquées puis vérifiées sur Supabase, et une recette authentifiée doit confirmer les RLS avec de vrais rôles. Aucun changement distant n’a été effectué pendant cet audit.

## B. Inventaire audité

- Public : accueil, restaurants, restaurant, menu, produit, recherche, favoris, panier, checkout, suivi, compte, contact, histoire, connexion/inscription/récupération.
- Vendeur : tableau de bord, restaurant, produits/options, commandes, horaires, promotions, médias, paramètres et candidature.
- Administration : dashboard, utilisateurs/export, restaurants, boutique officielle, produits, catégories, cuisines, commandes/export, promotions, livraison, médias, candidatures, contenu et paramètres.
- Métier : devis serveur, idempotence de commande, Wave manuel, espèces par sous-commande, commissions figées, horaires, zones, promotions, notifications et exports.
- Données : repositories Supabase avec fallback local, Storage public/privé, fonctions SQL et RLS versionnées.

## C. Problèmes détectés

### P0 — critique

Aucun défaut P0 reproduit localement.

### P1 — important

1. Les migrations `202610130001` et `202610130002` ne sont pas encore appliquées à distance : statistiques par période et export utilisateurs dépendent de cette étape.
2. Les tests RLS disponibles sont principalement contractuels/statiques ; sans comptes QA et base isolée, l’isolation réelle PostgreSQL n’est pas prouvée pendant cette passe.
3. Le formulaire public `/contact` présente un bouton sans persistance ni fournisseur de message identifié. Il ne faut pas le présenter comme un envoi opérationnel avant branchement métier.

### P2 — amélioration

1. Le frontend utilisait Arial/Georgia avec des styles historiques superposés et une hiérarchie plus classique que les attentes 2026.
2. L’image de la section concept pouvait afficher un fallback illustré peu gourmand malgré la présence d’une vraie photo produit.
3. Le sitemap utilisait encore le domaine Vercel au lieu du domaine canonique `comeandeat.org`.
4. `npm audit` signalait `uuid` via ExcelJS et la chaîne ESLint `braces/micromatch/fast-glob`.

### P3 — cosmétique

- Une seule donnée restaurant/produit laisse volontairement de l’espace sur desktop. Aucun faux contenu n’a été inventé pour remplir les grilles.
- La photographie éditoriale dédiée aux fondateurs reste à fournir depuis l’administration.

## D. Problèmes corrigés

### Chiffre d’affaires et périodes statistiques

- Cause : un calcul global par commande ne représentait pas un encaissement espèces partiel multi-restaurants.
- Correction : agrégation par `restaurant_orders`, uniquement `payment_status = paid`, exclusion des sous-commandes annulées, allocation déterministe des remises, commission et net comptés une seule fois.
- Fichiers : `supabase/migrations/202610130001_statistics_periods.sql`, `scripts/test-statistics-finance.mjs`.
- Test : Wave payé, espèces partiellement encaissées, annulé/impayé, remise avec reliquat et commission sans double comptage.

### Sécurité des dépendances

- Cause : ExcelJS embarquait un ancien `uuid` vulnérable pour des usages de buffers non employés par l’export.
- Correction : résolution locale `uuid@11.1.1`, test Excel et suite complète à relancer après installation.
- Résiduel : cinq alertes hautes dans la chaîne ESLint autour de `braces`. Aucun correctif non cassant n’est publié par l’arbre courant ; `npm audit fix --force` proposerait une rétrogradation majeure incompatible et n’a pas été utilisé. Cette chaîne est de développement et ne rejoint pas le bundle applicatif.

### SEO canonique

- Cause : sitemap resté sur `come-and-eat.vercel.app`.
- Correction : URLs générées sous `https://comeandeat.org`.
- Fichier : `src/app/sitemap.ts`.

### QA visuelle

- Cause : Playwright attendait `networkidle`, incompatible avec les connexions persistantes, et ne couvrait pas 320/390/1280 px.
- Correction : attente `domcontentloaded`, huit largeurs, échec fiable et captures locales.
- Fichier : `scripts/visual-qa.mjs`.

## E. Modernisation frontend

### Direction retenue

Marketplace food éditoriale, chaleureuse et contemporaine : photo en premier, grands titres sans-serif expressifs, surfaces crème/menthe, vert profond, orange réservé aux actions. Les principes retenus des références demandées sont la hiérarchie courte, les visuels culinaires généreux, les rails tactiles et les interactions sobres ; aucun code ni média tiers n’a été copié.

### Changements

- Nouveau jeu de tokens dans `src/app/premium-2026.css`.
- Header plus net, navigation en capsule, actions tactiles de 42–44 px.
- Hero plus dense : titre contemporain, recherche capsule, CTA arrondis, photographie plus dominante et contraste renforcé.
- Catégories plus tactiles avec rail sans scrollbar intrusive.
- Cartes restaurants/produits agrandies, ombres légères, images dominantes et hover par transform uniquement.
- Section concept alimentée par la vraie photo du produit vedette quand aucune image CMS n’est configurée.
- Pages restaurant/produit harmonisées sans changer les données ni les règles de commande.
- `prefers-reduced-motion` respecté.

### Captures

- Avant : `artifacts/visual-qa-before-20261014-complete/`
- Après : `artifacts/visual-qa/`
- Les artefacts restent locaux et ne doivent pas être inclus dans le commit.

## F. Performances

- Données indépendantes de l’accueil déjà chargées avec `Promise.all`.
- Images principales via `next/image`, tailles responsives et priorité limitée au hero.
- Animations limitées à `transform`/`opacity`, sans bibliothèque JS supplémentaire.
- Aucun overflow détecté sur les 42 contrôles Playwright.
- Limite : Lighthouse/Core Web Vitals terrain non exécutés ; les chiffres de production ne doivent pas être déduits du build local sur disque USB.

## G. Sécurité

- Service role uniquement dans le client serveur `src/lib/supabase/admin.ts` et les scripts de tests live ; aucune référence dans le client navigateur.
- Variables publiques Supabase lues statiquement, compatibles avec l’inlining Next.js.
- Aucun `dangerouslySetInnerHTML`, `eval` ou secret suivi trouvé.
- Proxy admin vérifie l’utilisateur avec `getUser()` puis le rôle en base ; layouts admin/vendor sont `noindex`.
- Documents vendeurs privés séparés de la médiathèque publique selon les migrations existantes.
- En-têtes présents : `nosniff`, `DENY`, referrer policy, permissions policy.
- Risque résiduel : RLS distante non retestée pendant cette mission, conformément à l’interdiction d’écrire sur Supabase Production.

## H. Paiements et commandes

- Tests contractuels verts pour devis serveur, idempotence, suivi privé, Wave manuel, espèces, commissions, horaires et multi-sélection.
- Le chiffre d’affaires reconnaît les encaissements au niveau sous-commande, ce qui couvre le multi-restaurants partiel.
- Les annulations/impayés n’augmentent pas le CA.
- Les prix restent recalculés côté serveur ; aucun état `isOpen` client n’est accepté comme autorité.
- Aucun paiement réel n’a été déclenché.

## I. Administration et vendeurs

- Les écrans et actions existent et compilent ; les nouveaux contacts, statistiques et exports sont présents dans les routes réelles.
- Les interfaces protégées ont été vérifiées visuellement jusqu’aux écrans d’authentification uniquement.
- L’export `.xlsx` est serveur et repose sur une RPC admin paginée ; aucun mot de passe/document privé n’est exporté.
- Les panels conservent leurs comportements ; aucune refonte décorative lourde n’a été appliquée.

## J. SEO et emails

- Metadata globale, Open Graph, icônes, robots et sitemap présents.
- Admin, vendeur, compte, panier, checkout, suivi et auth sont exclus de l’indexation.
- Logo email PNG absolu et templates texte/HTML couverts par `test:emails`.
- SPF/DKIM/DMARC nécessitent une vérification DNS/provider distincte ; aucun DNS n’a été modifié.

## K. Tests

### Réussis réellement en local

- ESLint.
- TypeScript.
- `test:statistics-finance`.
- `test:local-corrections`.
- `test:ci` : marketplace, paiements, Sprint 6.1, horaires, emails, espèces/options, partage.
- Build Next.js 16.4.0 : 59 pages générées.
- Playwright Edge : 42 contrôles, 320/375/390/430/768/1024/1280/1440 px, sans overflow ni erreur console retenue.
- `git diff --check`.

### Non prouvés pendant cette passe

- RLS PostgreSQL réelle avec plusieurs comptes authentifiés.
- Upload/suppression Storage réelle.
- Email réellement reçu.
- Paiement Wave réel.
- Persistance des formulaires admin/vendor avec credentials QA.

## L. Migrations

### `202610130001_statistics_periods.sql`

Additive, RLS active, politiques rejouables, fonction `SECURITY DEFINER` protégée par `is_admin`, search path fixé, droits retirés à `public/anon`. Elle conserve l’historique et démarre une nouvelle période sans supprimer les commandes.

### `202610130002_admin_user_export_activity.sql`

RPC additive, admin obligatoire, pagination bornée à 100, recherche paramétrée, search path explicite `public, auth`, aucun secret ni document privé exporté.

Les migrations n’ont pas été appliquées à distance. Le `dry-run` puis l’application contrôlée restent obligatoires.

## M. Git

- Branche : `main`.
- Référence : `e11cb67`.
- Aucun commit, push ou déploiement réalisé.
- Sauvegarde : `.audit-backup/20261014-pre-audit.bundle` et patch de travail, exclus localement via `.git/info/exclude`.
- Ne jamais ajouter `Image Codex 18 août 2026, 01_33_29.png` ni `artifacts/` au commit.

Fichiers nouveaux à publier après validation : documentation, scripts de tests, route d’export, styles locaux/premium et migrations `202610130001/002`. Les fichiers déjà modifiés listés par `git status` appartiennent au même lot local et doivent être revus avant staging.

## N. Recommandations futures

- Brancher le formulaire Contact sur un canal validé et anti-spam.
- Ajouter une base Supabase de staging et des comptes QA dédiés afin de tester réellement RLS/Storage.
- Obtenir des photos authentiques supplémentaires pour réduire l’espace vide lorsque le catalogue est encore court.
- Mesurer les Web Vitals de production après déploiement, sans instrumenter de données personnelles.

## O. Déploiement — checklist Kevin

1. Autoriser/valider la connexion Supabase et vérifier la cible projet.
2. `npx supabase migration list`, puis `npx supabase db push --dry-run`.
3. Appliquer `npx supabase db push` et vérifier les deux migrations/RPC.
4. Tester avec admin, vendeur A, vendeur B et client : statistiques, export, isolation, uploads.
5. Exclure l’image étrangère et `artifacts/`, puis créer un commit cohérent.
6. Pousser `main` après revue du diff.
7. Vérifier GitHub Actions.
8. Vérifier le déploiement Vercel READY.
9. Recette production : public, checkout sans paiement réel, admin, vendeur, sitemap et responsive.
10. En cas d’échec applicatif, revenir au déploiement Vercel précédent ; en base, ne pas supprimer les commandes et préparer une migration additive corrective.

## P. Verdict

**PRÊT SOUS CONDITIONS** : le code local est vert et la modernisation est visible sans suppression fonctionnelle. La livraison exige encore l’application contrôlée des deux migrations et une recette authentifiée RLS/Storage sur l’environnement cible.
