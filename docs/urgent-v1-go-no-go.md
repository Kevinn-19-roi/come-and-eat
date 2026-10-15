# Publication urgente — point de contrôle avant autorisation

## Lot 1 : GO technique V1, aucune migration

PR 1 ouverte, sans conflit (`MERGEABLE`), tête `c3242bac0c5037eeca57c08a603efed018281860`, base `main`. Aucun check distant attaché à la PR au moment du contrôle : les résultats locaux ne sont pas présentés comme une CI GitHub exécutée.

Publie uniquement Manrope/styles, catégories actives, panier mobile, messages HEIC, protection CSV, hero desktop et lien/logo Bloop. V1 déjà validée par TypeScript, ESLint, build, tests CI/contrats et tests Edge ciblés. Les améliorations restent identiques dans la branche administrative testée.

**Aucune des 20 migrations V2 à appliquer, aucune fonction V2 activée.** Ne pas fusionner la branche V2. Le correctif administratif ci-dessous n'est pas dans PR 1.

## Lot 2 : suspensions, branche indépendante

Branche `release/come-and-eat-suspension-management`, fondée sur la tête V1. Le commit additionnel peut être examiné séparément ; aucune fusion autorisée pour le moment.

- Les rôles plateforme existants `admin` et `super_admin` sont explicitement autorisés par `requireAdmin()` et les policies `is_admin()` existantes. Aucun rôle spécialisé V2 n'hérite de ces droits.
- Suspension seulement depuis approuvé ; levée depuis suspendu ; approbation depuis attente de validation. Confirmation et feedback pending, contrôle serveur, liste blanche des actions, refus d'une transition incohérente et mise à jour conditionnelle sur le statut relu. Retry identique sans deuxième mutation.
- Pause et statut administratif présentés séparément. Lever une suspension ne modifie ni `operating_status`, ni horaires, candidature, commandes ou snapshots financiers. Les quatre partenaires existants ne sont jamais réactivés automatiquement.
- Retrait du sélecteur de validation générique : les changements sensibles passent par les actions confirmées, même si un formulaire falsifié transmet `validation_status`.
- Motif facultatif (1 000 caractères), historique acteur/date/ancien/nouveau statut/motif. Les anciennes suspensions ne sont pas artificiellement attribuées ou antidatées.
- Refus serveur d'une mutation administrative si la table d'audit n'est pas disponible ; message explicite côté fiche. Ne pas déployer cette branche sans sa migration.

## Migration unique : accord distinct requis

`202610150001_restaurant_validation_audit.sql` : colonne nullable `restaurants.suspension_reason`, table `restaurant_validation_events`, index, RLS, trigger atomique de journalisation et protection du motif. Pas de backfill ni UPDATE de restaurant existant, aucune dépendance V2, aucun changement de privilège global. Suppression d'un profil/restaurant éventuelle conserve le journal avec snapshots (FK SET NULL).

Historique distant relu officiellement en lecture seule : projet lié confirmé, 18 migrations appliquées jusqu'à `202609070002`. Sur cette branche, **une seule migration en attente**, `202610150001` ; aucune migration V2 locale sur cette branche. Aucun dry-run/application distante dans cette mission, aucun restaurant Production modifié.

Test exécuté sur PostgreSQL PGlite isolé avec les enums de rôle/statut : données préexistantes inchangées après migration, restaurant B toujours suspendu, pause A conservée pendant suspension/levée, acteur et motif conservés, retry sans doublon, journal non modifiable et inaccessible au vendeur, motif protégé même pour un vendeur autorisé à modifier sa fiche. Auth est une fixture, pas Supabase Auth/JWT réel.

Avant application après accord : sauvegarde récupérable, confirmation du projet `pazddhyqojhrdinaqryu`, lecture de l'historique, revue du SQL et dry-run depuis **cette branche seulement**. Ne pas lancer `db push` depuis V2. L'ALTER TABLE prend un verrou bref : choisir un créneau adapté. Une future réconciliation avec les migrations V2 plus anciennes devra intégrer cette migration dans leur historique et revoir l'ordre/dry-run (`--include-all` peut être nécessaire) ; ne pas renommer une migration déjà appliquée.

Retour arrière applicatif : revenir au commit V1 connu, conserver la colonne et le journal pour ne perdre aucun historique. Ne pas supprimer la table d'audit. Si la migration échoue, arrêter toute publication du lot 2 et examiner la transaction avant toute réparation.

## Tests et limites

Tests Server Actions réellement exécutés avec mocks : admin/super, refus customer/vendor/rôle spécialisé, confirmation, transitions, retry, pause, concurrence optimiste, panne et audit manquant, formulaire falsifié. Tests vendeur existants : pause autorisée/suspension bloquée/panne refusée. SQL réellement exécuté en base isolée comme ci-dessus. TypeScript, ESLint, CI locale et build webpack réussis (58 pages). `git diff --check` à contrôler avant commit.

Pas de recette Auth réelle ni changement de statut Production pour tester cette branche. La vérification authentifiée complète devra suivre l'activation autorisée du schéma dans un environnement QA. La journalisation locale testée ne constitue pas une preuve d'application distante.

## Autorisations attendues et chaîne de livraison

1. Kevin confirme **GO V1 / fusion PR 1**. Sans cet accord : aucune fusion, aucun déploiement.
2. Après accord, fusionner uniquement PR 1, surveiller le workflow existant de main puis Vercel, vérifier le SHA effectivement servi sur comeandeat.org. Ne pas déclencher un second déploiement parallèle.
3. Vérifier accueil/menu/restaurant/panier/checkout et protections admin/vendor, sans créer de paiement ou modifier de données. En cas d'échec critique, arrêter et appliquer le retour arrière autorisé.
4. Pour le lot suspensions : accord explicite séparé pour la migration, recette QA/permissions, vérification SQL, puis revue/fusion du commit administratif autorisé. Une réactivation réelle d'un restaurant nécessite son identification et une décision métier explicite ; aucune réactivation des quatre par défaut.

## Après V1 : ordre de clôture V2, sans développement maintenant

D'après `release/come-and-eat-v2:docs/v2-closure-matrix.md` et le rapport associé : RBAC des anciens modules en priorité, puis documents/reporting et conditions d'abonnement ; recette Auth/JWT/REST/Storage sur Supabase QA distinct ; concurrence native multi-connexion, régression paiements/plannings/quotas ; enfin sauvegarde/restauration et inventaire/dry-run global. Les offres commerciales incomplètes restent désactivées. Aucune V2 mélangée à cette urgence.

**Verdict : GO technique du lot V1 sous accord de fusion. Lot suspensions préparé et testé localement, NO-GO Production tant que sa migration et la recette associée ne sont pas autorisées/validées.**
