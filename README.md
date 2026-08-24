# Come & Eat

Marketplace de restauration Next.js 16 reliée à Supabase et déployée sur Vercel.

## Fonctionnalités

- catalogue public multi-restaurants, panier persistant, checkout et suivi privé par jeton ;
- authentification client, vendeur, administrateur et super administrateur ;
- espace vendeur isolé par restaurant et rôles `owner`, `manager`, `staff` ;
- administration des restaurants, candidatures, produits, commandes, contenus et paramètres ;
- paiements Wave par lien marchand avec confirmation manuelle sécurisée ;
- commissions figées à la création de chaque sous-commande ;
- médias publics dans `restaurant-media` et documents vendeur privés dans `seller-documents`.

## Démarrage local

Prérequis : Node.js 24 et npm.

```bash
npm ci
npm run dev
```

Copier `.env.example` vers `.env.local` et renseigner les variables du projet. Ne jamais committer `.env.local`, `.vercel` ou une clé de service.

## Validation

```bash
npm run lint
npm run typecheck
npm run test:ci
npm run build
```

Les tests `*:live` utilisent le projet Supabase lié et créent uniquement des données QA temporaires auto-nettoyées. Ils ne sont pas exécutés automatiquement en CI.

## Données et sécurité

Les migrations versionnées se trouvent dans `supabase/migrations`. Les composants utilisent des repositories/services ; les données marketplace ne reposent pas sur `localStorage` (seul le panier client y persiste). RLS reste active sur les tables sensibles. `SUPABASE_SERVICE_ROLE_KEY` est réservée aux scripts et modules serveur explicitement marqués `server-only`.

## Déploiement

Chaque push sur `main` lance `.github/workflows/vercel-production.yml`, valide le projet, construit l’application puis déploie sur Vercel. Production : https://come-and-eat.vercel.app

## Services externes

- Wave : lien marchand configuré, confirmation du paiement manuelle par un administrateur ; aucune API ou webhook Wave n’est simulé.
- Email : l’interface `EmailProvider` existe, mais aucun fournisseur transactionnel n’est activé en production.

Consulter `docs/production-readiness-checklist.md` pour l’état technique et `docs/manual-qa-checklist.md` pour la recette humaine.
