# Premier lot — publication après accord

Branche : `release/come-and-eat-v1-improvements`, issue de `main` (`e11cb67`). Aucun module V2 ni migration repris.

Retenus : Manrope auto-hébergée, styles publics V2 et cartes restaurant compatibles avec le markup existant, catégories actives accessibles, barre panier mobile (quantités/options/sous-total et safe area, absente au checkout), refus explicite HEIC/HEIF pour les photos publiques, protection CSV contre les formules.

Exclus : nouveaux repositories/RPC, permissions, Contact V2, consentement WhatsApp, documents privés HEIC, exports utilisateurs V2, statistiques et tous les modules V2. Auth, checkout, paiements et schéma restent ceux de main. Le lot ne reproduit pas toute la composition V2 : seules les présentations autonomes sont reprises. Contrôle React ciblé : context panier réutilisé, aucune requête privée ajoutée, état accessible et reduced-motion conservés.

Validations requises : `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test:ci`, `node scripts/test-v1-improvements.mjs`, `npm.cmd run build -- --webpack`. Les suites CI sont principalement des contrats statiques ; aucun paiement, email ni écriture Supabase pendant ces tests.

## Publication exacte — uniquement après accord

1. Sur GitHub, ouvrir une PR `release/come-and-eat-v1-improvements` vers `main` et examiner le diff limité ; vérifier qu'aucune migration ni RPC nouvelle n'apparaît.
2. Si main a évolué, actualiser la branche et relancer les validations ci-dessus. Recette visuelle du lot local/preview : menu, restaurant, produit, panier et checkout à 375/430/1440 ; vérifier absence de superposition et catégories/quantités/options.
3. Après accord explicite, fusionner la PR. Le push résultant sur main déclenche le workflow de production existant ; ne pas lancer un second déploiement Vercel.
4. Vérifier GitHub Actions, Vercel Ready et SHA de la fusion sur comeandeat.org. Vérifier pages publiques et protections admin/vendor, panier et accès checkout sans paiement réel.
5. Si régression, restaurer le déploiement précédent autorisé puis revert de la fusion par PR, sans force-push.

**Aucune commande Supabase à exécuter.** La branche V2 et ses 20 migrations restent séparées. Aucun changement de production dans cette préparation.

## Résultats locaux — 15 octobre 2026

Build webpack réussi : 58 pages, compilation et TypeScript intégrés terminés. Tests ciblés CSV/upload exécutés sans accès réseau : réussis. Premier TypeScript interrompu par les types générés de l'ancienne branche V2 ; ancien `.next` déplacé dans `.audit-backup/next-cache-v1-20261015` sans suppression, puis types régénérés par le build.

Validation finale : `typecheck`, ESLint, `test:ci`, test ciblé V1 et `git diff --check` réussis. ESLint exclut uniquement les captures et sauvegardes locales, pas le code applicatif. Quinze fichiers sélectionnés explicitement ; aucun secret détecté par le contrôle ciblé des signatures et aucun fichier étranger indexé.

Le diff confirme que `supabase`, le proxy, les contrôles Auth, les repositories, les panels admin/vendor et le checkout sont identiques à main. Aucune nouvelle RPC, colonne ou permission. Manrope est la seule dépendance ajoutée ; versions Next/React de main conservées. Pas de nouvelle recette navigateur ou authentifiée dans ce lot : à vérifier sur la preview avant la fusion, sans paiement réel.
