# Diagnostic Supabase — Come & Eat

> Mise à jour : accès CLI officiel rétabli et vérifié pendant la mission finale. COME AND EAT / pazddhyqojhrdinaqryu est visible ; migration list --linked réussit, dernière migration distante 202609070002. Onze migrations étaient en attente au début de cette passe ; douze après ajout de 202610140010_secure_conversations.sql. Le 403 décrit ci-dessous est historique, aucune reconnexion n’est désormais demandée. Aucun schéma distant modifié.

Projet local : `F:\documents\come-and-eat`. Projet attendu et lié : `pazddhyqojhrdinaqryu`.

## Résultats vérifiés

- Aucun outil node_repl/Browser Use/Computer Use exposé ne permet de piloter la session Chrome existante. Playwright utilisé précédemment lance une session séparée : il ne reprend pas la connexion de Chrome. Aucun cookie/token/profil Chrome lu ou copié.
- `npx supabase projects list` réussit avec les identifiants CLI enregistrés et ne retourne que deux autres projets, sans Come & Eat.
- `SUPABASE_ACCESS_TOKEN` n’est pas défini dans l’environnement du processus ; aucun remplacement de cette variable effectué. Les valeurs des identifiants enregistrés n’ont pas été lues.
- `npx supabase migration list --linked` échoue HTTP403 pendant l’initialisation du rôle de connexion, avant lecture de l’historique et exécution de migration.
- Le CLI est authentifié auprès de Management API mais son contexte d’accès ne donne pas les droits nécessaires au projet visé. Compte différent, appartenance manquante ou portée du token insuffisante restent les explications possibles ; l’identité Chrome n’est pas observable pour les distinguer.
- Lecture publique autorisée de restaurants avec la clé publique : boutique officielle approuvée, en pause. Aucun changement effectué.

Ce refus ne vient pas de RLS des tables métier ni du rôle super_admin de l’application. Clé publique/service role Supabase, session Auth Come & Eat et autorisation Management API sont des mécanismes distincts. Une service role ne doit pas servir de remplacement au login CLI.

## Méthode officielle minimale

Depuis un terminal local :

```powershell
Set-Location -LiteralPath 'F:\documents\come-and-eat'
npx.cmd supabase login
npx.cmd supabase projects list
```

Terminer le flux navigateur officiel avec le compte ayant accès à Come & Eat. Aucun secret ne doit être envoyé dans la conversation ni passé en clair dans une commande `--token` conservée dans l’historique.

Si le projet reste absent, vérifier les membres de l’organisation/projet avec son propriétaire et la portée d’un éventuel token restreint. Le compte doit disposer d’un rôle autorisant la gestion des données de la base, pas seulement une lecture du projet. Ne pas accorder Owner par défaut si un rôle inférieur suffit.

Une fois Come & Eat visible :

```powershell
npx.cmd supabase migration list --linked
```

La copie est déjà liée au bon projet. Ne pas relier arbitrairement un autre projet. Ne pas exécuter db push ni migration repair à ce stade. La reconnexion CLI ne constitue pas une autorisation d’appliquer des migrations.

## GO/NO-GO

## Validation locale complémentaire

TypeScript, ESLint, suite CI, tests statistiques financières et garde-fou des suites distantes réussis pendant cette reprise. Six migrations V2 exécutées sur PostgreSQL PGlite isolé, avec refus de préparation sans commande matérialisée et restitution idempotente du quota d’un repas retiré. Ces preuves ne remplacent ni une recette authentifiée ni un test du schéma complet sur Supabase.

Le build de cette reprise a été lancé ; son résultat doit être confirmé séparément. Le build réussi mentionné dans le rapport précédent ne constitue pas la preuve de ce nouveau build.

**NO-GO.** Historique/schéma distant, restauration isolée et permissions réelles non vérifiés. Planning/paiements/abonnements et intégration RBAC historique encore incomplets ; six ajouts non engagés. Un accès CLI rétabli ne suffira donc pas, à lui seul, à autoriser la livraison.

## Sources officielles consultées

- https://supabase.com/docs/reference/cli/supabase-login
- https://supabase.com/docs/guides/platform/personal-access-tokens
- https://supabase.com/docs/guides/platform/access-control
