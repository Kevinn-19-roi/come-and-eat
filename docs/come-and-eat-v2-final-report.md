# Come & Eat — Sprint final V2 : état de développement local

> État initial de la passe V2, complété depuis par les devis, invitations et notifications. Voir `docs/come-and-eat-final-delivery-report.md` pour le dernier état et le NO-GO. Les points non terminés de ce rapport ne doivent pas être confondus avec une promesse de livraison des cinq modules.

Date : 14 octobre 2026. Dossier : `F:\documents\come-and-eat`.

## 1. Résumé exécutif

**NON PRÊT pour la livraison des cinq modules complets.** Cette session ajoute des fondations fonctionnelles et testées, mais ne termine pas tous les parcours demandés. Ne pas appliquer les nouvelles migrations ni publier ce lot comme une V2 finalisée.

Avis vérifiés, signalements, modération, réponses vendeurs, demandes traiteur, devis en brouillon, permissions cumulables, planification estimative et quotas prépayés ont été développés. Il manque notamment l’orchestration serveur des repas futurs, leur règlement final, la publication/acceptation des devis, les invitations, les remboursements et l’intégration complète des permissions aux anciens modules.

Les offres Étudiant et Professionnel restent désactivées. Aucun tarif ou remboursement supplémentaire n’a été inventé.

## 2. État initial du projet

Branche `main`, dernier commit `e11cb67`. Nombreuses modifications précédentes non commitées, conservées. Stack vérifiée : Next.js 16.4.0, React 19.2.8, TypeScript 5, Supabase SSR/JS, Resend, ExcelJS, Playwright, Tailwind 4, Manrope.

Sauvegarde locale préalable : `.audit-backup/v2-sprint-start`, exclue de Git. Copie des sources, migrations, scripts, documentation et fichiers de configuration non secrets. Contrôle SHA256 effectué sur package.json et le CSS storefront. Le fichier étranger `Image Codex 18 août 2026, 01_33_29.png` n’a pas été ajouté ni supprimé.

## 3. Fonctionnalités préservées

Les paiements Wave/espèces existants, RPC de commande, panier, commissions, options, statistiques, exports, contact, médias et styles food-v2 n’ont pas été remplacés. Les ajouts utilisent les clients Supabase et les formulaires avec feedback existants. Les contrôles administrateur historiques restent en place.

Les tests de contrats historiques passent, mais cela ne constitue pas une recette navigateur complète de tous les parcours.

## 4. Commandes programmées

Page `/meal-planner`, création de planning, dates à Abidjan, choix de plat/options/quantité, livraison/retrait, zone globale, adresse, estimation serveur, contrôle des horaires à la date future, délai minimal configurable, limite de 90 jours, idempotence, consultation admin et vendeur.

Tables : meal_plans, scheduled_meals, scheduled_meal_events. Pas de stock réservé. La préparation ne peut commencer plus de deux heures avant le créneau via la RPC actuelle.

**Restant :** calendrier complet, modification/suppression client, confirmation finale, promotions, contrôles des horaires globaux de livraison futurs, création des orders/restaurant_orders au bon moment, règlement des repas ordinaires et suppléments, worker idempotent, rappels, gestion complète des incidents. Le planning est une estimation, pas une commande payée et livrable automatiquement.

## 5. Avis clients vérifiés

Publication `/account/reviews` uniquement après achat authentifié, sous-commande livrée/remise et payée. Unicité par ligne de commande. Note 1–5, commentaire facultatif limité. Consultation publique anonymisée au prénom, moyenne de tous les avis visibles, liste limitée à 100. Signalement authentifié, modération avec motif, restauration, réponse propriétaire/manager sans modification de note.

Photos d’avis non implémentées. Pagination exhaustive des avis/signalements à compléter. La modération des 100 derniers avis est explicitement indiquée dans le filtre.

## 6. Abonnements étudiants

Préconfiguration inactive : 20 repas, 1 450 FCFA par repas, 29 000 FCFA. Aucun avantage de livraison gratuite déclaré. Conditions, durée, éligibilité et prix configurables par utilisateur autorisé à configurer la finance. Enregistrement conservant la formule non publiée.

## 7. Abonnements professionnels

Préconfiguration inactive : prix unitaire 1 450 FCFA, volume non défini. Aucun total mensuel supposé. Pas de publication tant que les conditions commerciales et techniques ne sont pas finalisées.

## 8. Service traiteur

Page `/catering`, demande validée côté serveur, honeypot, limite distribuée réutilisant Contact, coordonnées, événement, date future, lieu, convives, budget facultatif, plats et message. Enregistrement privé. Administration `/admin/catering` avec recherche, statuts, attribution restaurant, notes internes, devis chiffrés serveur en brouillon. Les brouillons ne sont pas exposés aux clients/restaurants.

**Restant :** envoi/acceptation du devis, document téléchargeable, historique affiché, suivi client, interface partenaire et notifications réellement traitées. Aucun prix traiteur prérempli.

## 9. Architecture RBAC

Tables séparées platform_staff et platform_staff_roles. Les cinq rôles ne sont pas ajoutés à profiles.role et ne deviennent donc pas implicitement admin. Fonction has_platform_permission à union explicite. Super administrateur protégé. Les anciens administrateurs généraux ne peuvent pas être convertis silencieusement par le formulaire : conflit explicite à traiter.

## 10. Matrice des permissions

| Responsabilité | Permissions nouvelles |
|---|---|
| Commandes | orders.read, orders.operate, planning.manage |
| Livraisons | delivery.operate, planning.deliveries |
| Service client | reviews.moderate, support.manage, catering.manage, refund.request |
| Menus | catalog.manage, media.manage |
| Paiements et ventes | finance.read, payment.confirm, subscriptions.manage, refund.request |
| Super administrateur | Toutes les permissions prévues |

Cette matrice définit les permissions mais **tous les écrans correspondants ne sont pas encore intégrés**. Les anciens modules restent inaccessibles aux rôles spécialisés plutôt que leur accorder un accès global. Les rôles restaurants restent owner/manager/staff.

## 11. Administration et vendeurs

Nouvelles pages admin : reviews, catering, planning, subscriptions, team. Gestion des responsabilités sur utilisateurs existants, activation/suspension des accès spécialisés, journal SQL. Navigation filtrée et contrôle serveur/RPC. Vendeur : avis/réponses et consultation des repas programmés de son restaurant.

**Restant :** invitations, interface d’audit, remboursement demandé/approuvé/exécuté, affectations livraison, réclamations, intégration des permissions spécialisées aux anciennes pages/API/RPC/exports/Storage. Le rôle delivery_admin n’a pas encore sa page opérationnelle dédiée.

## 12. UX/UI

Direction food-v2 et Manrope conservées. Formulaires réutilisés avec pending et messages français. Statuts des repas centralisés. Aucun UUID demandé à l’utilisateur. Une revue mobile de ces nouveaux écrans reste nécessaire ; aucun résultat visuel authentifié n’est revendiqué.

## 13. Supabase et migrations

La configuration locale vise bien `pazddhyqojhrdinaqryu`. Le CLI `supabase migration list --linked` échoue HTTP403 sur les privilèges du compte. Historique distant non confirmé, connexion Chrome non utilisée pour contourner l’authentification.

Ordre local à vérifier avant tout dry-run autorisé :

1. 202610130001_statistics_periods.sql
2. 202610130002_admin_user_export_activity.sql
3. 202610140001_contact_rate_limit.sql
4. 202610140002_v2_permissions_reviews.sql
5. 202610140003_v2_catering.sql
6. 202610140004_v2_plans_subscriptions.sql

Les trois nouvelles migrations ont été exécutées dans PostgreSQL isolé PGlite avec un schéma fixture. Cela ne prouve ni leur compatibilité complète avec toutes les migrations anciennes, ni leur exécution sur Supabase. Aucune migration distante appliquée. Aucune migration historiquement appliquée modifiée.

## 14. Paiements et finance

Abonnement : snapshot du nom, nombre de repas, prix, total, activation seulement après confirmation autorisée. Réservation de quota sous verrou, consommation/libération tracées. Les encaissements d’abonnements ne sont pas ajoutés aux statistiques de commandes ordinaires : absence de double vente automatique, mais reporting séparé encore à construire.

**Restant :** lien marchand et tentative de paiement d’abonnement, rapprochement, extras/livraison des repas prépayés, annulations, document de facturation et règles comptables. Ne pas activer commercialement. Pas de remboursement automatique ni de prélèvement récurrent.

## 15. Emails et notifications

File v2_notification_jobs avec clé événement unique. Demande traiteur reçue mise en file, sans envoi direct. **Worker Resend, reprises après échec, invitations, rappels, expiration et confirmations d’abonnement non terminés.** Aucun nouveau fournisseur inventé. Les tests locaux ne doivent pas envoyer de vrais messages.

## 16. Sécurité

RLS activée sur les nouvelles tables. Aucune service role côté navigateur. RPC SECURITY DEFINER avec search_path explicite, droits d’exécution restreints, attribution de responsabilités réservée au super administrateur, absence d’élévation vers super_admin. Données publiques d’avis séparées des liens privés avec les commandes. Devis brouillons privés.

### Incident de tests distants

Des suites historiques `test:vendor-rls`, `test:seller-application`, `test:admin` et le début de `test:qa-regressions` ont été lancés avant de constater qu’elles écrivaient directement sur Supabase distant avec la configuration locale. **Cela ne respectait pas la limite de cette mission.** Les premières suites ont exécuté leurs blocs finally ; QA a été interrompu. Le contrôle a retrouvé le run QA `31110135` (1 restaurant temporaire, 2 comptes) et le nettoyage ciblé a réussi après vérification de l’absence de commandes associées. Aucun client réel n’a été sélectionné pour suppression.

Les scripts peuvent aussi mettre temporairement la boutique officielle en pause/reprise ; l’état initial en mémoire du processus interrompu n’est pas récupérable. Ne pas prétendre avoir prouvé sa restauration exacte. Le contrôle final en lecture seule retrouve la boutique officielle en `paused` : aucune reprise arbitraire effectuée. Le choix de conserver/reprendre cet état doit être confirmé par le propriétaire. Les restaurants des runs 31110135 et 1952166b, la candidature QA ciblée et les lignes media QA (qa.png, 8 octets, période de ce test) sont absents après nettoyage. Les suppressions des deux comptes QA ont retourné succès. Aucun nettoyage global des historiques ni des objets Storage non identifiés effectué.

Ajout de require-isolated-database.mjs : les huit suites d’écriture concernées refusent désormais toute URL non locale, avant initialisation des clients. Aucun secret affiché. Les résultats distants accidentels ne valent pas approbation du nouveau schéma V2.

## 17. Tests fonctionnels

`test:ci` réussi : marketplace, contrats paiements, Sprint6.1, horaires/WhatsApp/commission, emails, espèces/options, partage/multi-sélection. Principalement tests de contrats/statiques, pas E2E production.

`test:v2-postgres` réussi : exécution des trois migrations, achat vérifié, doublon/fraude refusés, modération, rôles cumulés sans paiement, souscription idempotente, paiement client refusé, quota, estimation, isolation, annulation/libération et demande traiteur protégée.

TypeScript et ESLint réussis. Build de production `npm run build -- --webpack` réussi : compilation, vérification TypeScript, génération des 70 pages et traces. Le build Turbopack initial a été interrompu en compilation sans diagnostic ; ne pas le présenter comme réussi. Une première tentative Webpack avec serveur dev concurrent avait échoué sur des types générés disparus ; validation relancée en série avec succès. Sauvegardes et artifacts exclus des scans TypeScript/ESLint, sources et tests conservés dans ces scans.

`test:statistics-finance` et `test:local-corrections` réussis. `test:v2-safety` réussi : destinations distantes et faux localhost refusés, localhost accepté, huit scripts protégés, aucune connexion Supabase dans ce test.

Ancien test vendeur échoué : payment_method='test' interdit par orders_payment_method_allowed. Fixture corrigée localement vers cash ; pas relancée à distance. Suites distantes interrompues ne doivent pas être déclarées toutes vertes.

## 18. Tests RLS

Tests SQL réellement exécutés dans PGlite : autre client ne lit pas les liens privés d’avis ni abonnements/plannings ; anonyme ne lit pas directement product_reviews ; RPC publique masque les avis modérés ; client ne modère pas et ne confirme pas les abonnements ; union de rôles sans privilèges financiers implicites.

Pas de preuve d’exécution des nouvelles RLS sur Supabase distant. Pas de test concurrent multi-connexion de quota, ni de validation exhaustive Storage pour ces modules.

## 19. Tests visuels

32/32 contrôles Edge anonymes réussis sur le build de production local : `/catering`, `/subscriptions`, redirection de `/meal-planner` et de `/admin/reviews`, à 320/375/390/430/768/1024/1280/1440 px. Aucun débordement horizontal ni exception JavaScript relevé. Aucun formulaire envoyé. Le script attend la vraie redirection avant d’évaluer le document. Capture mobile du traiteur inspectée visuellement.

Captures : `artifacts/v2-modules/`. Galerie locale : `artifacts/v2-modules-review.html`. Résultats : `artifacts/v2-modules/report.json`. Les captures food-v2 antérieures restent conservées. Les nouveaux parcours authentifiés n’ont pas leur recette Edge complète ; ces contrôles anonymes ne prouvent pas leurs permissions ou leur persistance.

## 20. Régressions détectées et corrigées

- Ambiguïté SQL `id` dans schedule_meal : alias option_id explicite, test réel PostgreSQL passé.
- Devis brouillons accessibles par politique trop large : restriction status <> draft pour non-modérateurs.
- Clé de retry réutilisée après succès d’ajout de repas : renouvellement après succès.
- Noms `module` refusés par ESLint Next : renommés destination.
- Scans ESLint des sauvegardes/captures : dossiers exclus, sans exclusion du code/tests.
- Tests distants implicites : garde-fou localhost strict.

## 21. État Git

`main`, HEAD e11cb67. Tous les travaux restent non commitées. Aucun push, aucun déploiement. Ne pas utiliser git add --all. Inclure les fichiers métier/tests/docs après revue ; exclure .env.local, .audit-backup, artifacts, image étrangère et script ponctuel verify-v2-qa-cleanup.mjs.

Liste de revue explicite : `docs/v2-files-to-review.txt` (travaux antérieurs et nouveaux, pas une autorisation automatique de publication).

## 22. Configuration nécessaire

Authentification CLI Supabase autorisée pour lecture d’historique ; base isolée complète ; comptes QA locaux spécialisés ; futur traitement serveur des jobs ; conditions commerciales d’abonnements. Infrastructure Resend existante à réutiliser sans nouveaux secrets client.

## 23. Décisions commerciales restant à confirmer

Frais de livraison/éligibilité/conditions Étudiant ; nombre de repas Professionnel ; annulation des repas futurs et remboursements ; reconnaissance comptable du prépayé ; éventuelles prestations traiteur à publier. Aucun tarif supposé imposé.

## 24. État du déploiement

Non publié. Pas de push/GitHub Actions/Vercel déclenché par cette session. La V2 locale ne doit pas encore être livrée.

## 25. Procédure de livraison

1. Terminer les parcours techniques explicitement restants.
2. Rejouer tout le schéma dans une base Supabase isolée, vérifier migrations et permissions réelles.
3. Tester les rôles et parcours navigateur sans emails/paiements réels.
4. Vérifier sauvegarde restaurable, compatibilité et retour arrière.
5. Après autorisation, `npx supabase migration list --linked`, puis `npx supabase db push --dry-run`.
6. Examiner le dry-run (il ne valide pas le SQL), demander feu vert explicite avant `npx supabase db push`.
7. Après recette et autorisation de publication seulement : sélectionner les fichiers, commit, push main, Actions et Vercel correspondant au SHA, recette de production.

Retour arrière : désactiver les offres, revenir au précédent code validé après autorisation ; conserver les tables/données et créer une migration corrective additive. Ne pas DROP des tables avec données ni réinitialiser la base.

## 26. Risques résiduels

Implémentation partielle des cinq modules ; ancienne surface admin non entièrement migrée ; worker et finances des plannings absents ; migrations historiques non rapprochées ; recette authentifiée/visuelle incomplète ; cinq alertes npm élevées de développement dans braces → micromatch → fast-glob → ESLint Next. `npm audit --omit=dev` : zéro alerte. Pas de downgrade Next/ESLint forcé.

## 27. Verdict final

**NON PRÊT pour Sprint final V2 complet.** Les bases locales sont conservées et plusieurs contrôles passent, mais la livraison ne peut pas être annoncée tant que les parcours restants, la recette isolée et la préparation de migration ne sont pas terminés. Les blocages de développement ne sont pas des tâches à déléguer au propriétaire ; seules décisions commerciales et autorisations réelles lui reviennent.
