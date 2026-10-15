# Continuation locale V2 — 14 octobre 2026

## Périmètre et préservation

Copie exclusive : F:\documents\come-and-eat, main, HEAD e11cb67. Aucun commit, push, déploiement, migration distante, nouvel essai d’authentification CLI ou changement de la boutique officielle. Modifications antérieures, frontend V2 et image étrangère conservés.

## Développements de cette passe

- Retraits programmés ordinaires : création d’une vraie commande, sous-commande et ligne avec options, prix recalculés, commission figée et tentative Wave uniquement si Wave choisi. Une commande par repas ; pas encore de confirmation globale d’un planning.
- Authentification et propriété contrôlées dans la RPC, verrouillage du planning puis du repas, idempotence par repas. Un changement de prix refuse la confirmation au lieu de facturer silencieusement davantage.
- Validation des horaires futurs, délai minimum, disponibilité et options. Paiement Wave non confirmé et préparation trop anticipée bloqués aussi par trigger sur les anciennes actions de commandes.
- Statuts du planning synchronisés depuis les sous-commandes ; un changement indépendant contradictoire est refusé. Remise au client ne signifie jamais encaissement.
- Interface client de confirmation des retraits, suivi privé et lien marchand existant. Traitement admin depuis la vraie commande, pas un deuxième cycle de statuts.
- Rappels serveur : file idempotente, accès service_role uniquement, fenêtre de deux heures, annulation des rappels devenus obsolètes. Le worker existant peut invoquer cette file si V2_SCHEDULING_WORKER_ENABLED=true ; valeur par défaut false. Aucun timer navigateur, paiement automatique ou email réel pendant les tests.
- Notifications vendeurs ordinaires écartées pour les commandes programmées ; celles-ci passent par les rappels au bon moment. Notifications client/admin réutilisées à la création.
- Options du planning : remplacées par une requête groupée sur les vrais liens produits/options, sans recours aux groupes de démonstration ni N+1.
- Souscriptions : durée, textes et produits éligibles figés à la souscription ; activation manuelle utilise la durée figée. Un changement de formule ne change pas les droits déjà acquis. Quotas réservés/consommés/restants distingués ; utilisation avant paiement ou hors validité non proposée. Horloge de la base utilisée pour la présentation de validité.

## Migrations nouvelles, non appliquées à distance

1. 202610140008_scheduled_order_materialization.sql
2. 202610140009_subscription_contract_snapshots.sql

Elles suivent les neuf migrations locales précédentes. La migration 008 est requise avant ce code de notifications, qui lit orders.scheduled_for. La migration 009 est requise pour les snapshots et l’horloge d’abonnement. Ne pas déployer ce code seul sur l’ancien schéma.

## Tests et limites

TypeScript et ESLint réussis après correction du rendu temporel. Suite CI locale, statistiques financières, garde-fou anti-écriture distante et templates de notifications réussis. Build en attente de confirmation finale dans le journal ci-dessous.

### Résultat final de cette passe

- Nouveau build `npm run build -- --webpack` réussi : compilation 68 secondes, TypeScript, génération des 74 pages et traces terminées, code retour 0.
- Dernière exécution PGlite : huit migrations V2, y compris snapshots et commission officielle à zéro, réussie.
- `npm audit --omit=dev` : zéro vulnérabilité signalée. Ceci ne remplace pas l’audit des dépendances de développement.
- `git diff --check` : code retour 0 ; avertissements LF/CRLF uniquement. Branche main et HEAD e11cb67 inchangés.
- Aucun nouveau test visuel authentifié réalisé après ces modifications. Les captures anonymes des passes précédentes ne prouvent pas les nouveaux formulaires connectés.

PGlite exécute réellement les migrations V2 sur un schéma minimal isolé. Assertions : avis frauduleux/doublons, permissions cumulées, invitations et devis, quotas, snapshots, retraits cash/Wave, prix modifié, idempotence, préparation anticipée, paiement non confirmé, synchronisation, encaissement distinct de la remise, rappel unique et annulé. Ces tests ne prouvent pas le schéma complet Supabase, ses JWT/Storage ou des accès authentifiés dans Edge. Aucun email envoyé.

## Éléments encore non terminés

- Planning : livraison future et ses horaires globaux, promotions futures, confirmation groupée multi-jours/multi-restaurants, gestion des incidents et calendrier complet. Les livraisons programmées restent des brouillons non facturés.
- Abonnements : matérialisation des repas prépayés, suppléments/frais, reconnaissance comptable distincte et documents mensuels. La RPC refuse explicitement de matérialiser un repas d’abonnement plutôt que de créer une commande financière incorrecte.
- RBAC : intégration des cinq rôles aux anciens modules et leurs RPC/RLS encore incomplète ; aucune extension globale de is_admin() effectuée.
- Six demandes complémentaires : non engagées comme nouveau lot, conformément à l’ordre imposé tant que les cinq modules ne sont pas achevés ; certains comportements préexistent mais ne sont pas déclarés intégralement validés.
- Recette authentifiée Edge, schéma complet isolé et audit global définitif non réalisés dans cette passe.

## Verdict

**NO-GO — développement local partiel, livraison non autorisée.** Les contrôles réussis ne suffisent pas à annoncer les cinq modules terminés. Les travaux techniques restants restent à la charge du développement, pas du propriétaire. L’accès Supabase est traité séparément par le propriétaire et n’a pas été retenté.
