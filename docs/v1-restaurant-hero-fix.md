# PR 1 — diagnostic restaurant et correctifs visuels

## Accès vendeur — lecture seule, 15 octobre 2026

`requireVendor()` redirige uniquement lorsque le restaurant sélectionné possède `validationStatus === 'suspended'`. La page candidature affiche ensuite le message signalé sous cette même condition. `operating_status = paused` ne déclenche pas cet écran. Une erreur de lecture profil/membres lève `VENDOR_CONTEXT_FAILED`, sans autorisation implicite ; l'absence de membre redirige vers la candidature.

Lecture Production sur le projet attendu `pazddhyqojhrdinaqryu`, uniquement restaurants et rôles des membres :

| Restaurant | Validation | Fonctionnement |
|---|---|---|
| DABA | suspended | open |
| KB cooking | suspended | paused |
| Come & Eat Zone 3 | suspended | paused |
| Cake & Co | suspended | paused |
| Come & Eat Cocody (officielle) | approved | paused |

Le restaurant précis du signalement n'est pas identifié par la pièce jointe (qui est le logo Bloop). Les quatre restaurants partenaires lus sont suspendus. L'origine et l'intention de ces décisions ne sont pas déterminées par cette lecture. Aucun statut modifié, aucune réactivation. L'administration doit vérifier la décision et, uniquement si la suspension est erronée, la lever explicitement. La pause reste une décision indépendante.

Tests exécutables de `getVendorContext`/`requireVendor` avec mocks : pause autorisée, suspension bloquée, non-membre redirigé et erreur technique refusée. Pas une recette Auth réelle. Aucun correctif spéculatif de cette logique.

## Hero et Bloop

Le CSS existant définit un fond sur `hero-food-frame:after`, mais ne crée pas ce pseudo-élément. Le correctif fournit `content`, position/inset et un gradient gauche transparent à droite uniquement à `min-width:1101px`. Couleurs du kicker/paragraphe précisées dans la même règle. Aucun cadrage, dimension, bouton ni règle mobile/tablette modifié.

Image Bloop fournie copiée intacte dans `public/brand/bloop-logo.jpg`. Image et texte partagent le lien existant configurable, avec `noopener noreferrer`. Aucun nouveau destinataire inventé.

Régressions : `node scripts/test-vendor-access-display.mjs`, puis TypeScript/lint/build. Le test Edge `scripts/test-v1-hero-footer.mjs` compare la même page, avec/sans la règle desktop : screenshots du hero identiques à 375/430/1024, géométrie desktop inchangée et gradient actif à 1440, logo chargé dans le lien. Résultats finaux à consigner après exécution effective, pas avant.

## Validation finale réelle

TypeScript, ESLint, build webpack (58 pages), tests vendeur avec mocks et tests V1 CSV/upload : réussis. Edge sur le build final : 4/4 largeurs, hero mobile/tablette identique pixel par pixel, desktop modifié sans déplacement, aucun débordement ni exception JavaScript, logo chargé dans le lien existant. Captures et JSON exclus de Git : `artifacts/v1-hero-footer/`. Captures desktop et footer mobile inspectées visuellement. Comparaison visuelle limitée au correctif CSS, sur la même page et les mêmes données ; pas une recette Auth vendeur réelle.

Playwright 1.64 utilisé depuis le cache npm via `PLAYWRIGHT_MODULE` (URL fichier vers `@playwright/test/index.mjs`), sans ajout aux dépendances publiées. Autre possibilité pour reproduire : installation locale temporaire `npm install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @playwright/test@1.64.0`, puis `node scripts/test-v1-hero-footer.mjs` avec le build servi sur 127.0.0.1:3211 et Edge installé.

Incident local résolu : fichier Zod manquant et bibliothèque native verrouillée par un serveur Next local. Serveur du projet arrêté, dépendances réinstallées exactement avec `npm ci --ignore-scripts --no-audit --no-fund` ; téléchargement très lent mais terminé. Aucun changement de package.json/lockfile. Nom de variable réservé détecté dans le nouveau test puis corrigé, lint relancé avec succès ; aucune règle désactivée.

**GO technique pour ces changements de PR.** L'accès du partenaire demeure soumis à la suspension enregistrée et à sa vérification administrative ; aucune levée automatique. Aucun autre comportement V1 ou V2 modifié.

Aucune migration, aucun changement de permission ou module V2 ; aucune fusion/déploiement. Un GO technique de la PR ne signifie pas que les suspensions métier ont été levées.
