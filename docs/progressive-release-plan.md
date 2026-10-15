# Publication progressive — sauvegarde V2

La branche `release/come-and-eat-v2` sauvegarde le développement complet ; **ne pas la fusionner ou la déployer telle quelle**. Les 20 migrations restent non appliquées, le verdict V2 demeure NO-GO. Aucun changement de production autorisé par ce document.

## Premier lot sans migration

Prélever seulement les changements indépendants depuis la release, dans une future branche issue du `main` de production, après accord :

- Mise à jour compatible Next/React/ESLint et lockfile ; reprendre les versions cohérentes, pas toutes les dépendances V2/exports par simple copie.
- Typographie Manrope et styles publics premium ; reprendre les classes/compositions nécessaires sans les nouveaux appels backend et liens V2. Les styles seuls ne garantissent pas l'intégralité de la nouvelle composition.
- Catégories actives, barre panier mobile : composants purement client, sous-total/quantités/options, intégration ciblée au layout et imports CSS ; conserver navigation/auth actuelles.
- Validations et erreurs HEIC/HEIF des uploads existants, sans changement de bucket/policies.
- Neutralisation des cellules CSV et correctifs de contraste/feedback purement visuels.

Ce sont des candidats publiables sans schéma nouveau, **pas un lot déjà extrait ou testé indépendamment**. Les fichiers mélangent parfois plusieurs chantiers : utiliser un diff ciblé, jamais cherry-pick aveugle du commit complet.

## À exclure de cette première publication

Planning, abonnements, avis, traiteur, messagerie et RBAC V2 ; périodes statistiques, export utilisateurs dépendant de la RPC d'activité, Contact dépendant de la migration anti-spam, consentement WhatsApp `whatsapp_public`, crédits prépayés et nouveau contrôle de commission SQL. Offres commerciales non publiées et workers désactivés.

**Point bloquant concret :** le repository marketplace courant appelle `platform_fulfillment_available`, introduite dans la migration 011. Déployer la release complète sans cette migration ferme le checkout en sécurité. Conserver le repository/checkout de production pour le premier lot. Les détails de commande/export référencent également `subscription_credit` (015) ; ne pas les reprendre avant schéma compatible. Ne pas importer `public-user`, navigation, proxy, pages compte ou layout admin V2 globalement.

## Tests indispensables sur le lot extrait

1. `npm.cmd ci`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:ci`, `npm.cmd run build -- --webpack`.
2. Vérifier que le diff n'ajoute aucun appel RPC/colonne absent de la production, aucune migration et aucun changement de privilège.
3. Sur serveur local : accueil/menu/restaurant/produit, catégories, panier avec options et quantités, mobile 375/430 et desktop 1440, absence de barre concurrente au checkout.
4. Vérifier Auth/admin/vendor, checkout livraison/retrait et Wave/espèces sans paiement réel ; toute création de commande test uniquement en QA isolée. Pas de suite destructive avec `.env.local` de production.
5. Validation du propriétaire, puis seulement commit/push du lot minimal et publication autorisée. Vérifier le SHA déployé et les routes critiques ; rollback vers le déploiement précédent si régression. Aucune migration nécessaire à ce lot.

Les tests du build V2 complet réussis précédemment ne prouvent pas ce sous-ensemble : relancer uniquement ces validations sur le lot extrait. Le workflow GitHub de production actuellement versionné ne se déclenche que pour `main` ; ce push release ne le déclenche pas. Une éventuelle preview Vercel automatique n'est pas une autorisation de promotion en production.
