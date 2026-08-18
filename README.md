# Come & Eat

Fondation locale du site de commande et de l’espace administrateur Come & Eat.

## Démarrage

```bash
npm run dev
```

Le projet utilise actuellement des données de démonstration dans `src/data/mock-data.ts`. Les composants passent par les interfaces de `src/services/repositories.ts`, prêtes à recevoir des adaptateurs Supabase.

## Environnement

Copier `.env.example` vers `.env.local` uniquement quand les services définitifs existent. Ne jamais committer `.env.local` ni une clé de service.

## Données locales

- panier : `localStorage` ;
- modifications admin : `localStorage` ;
- images ajoutées : Data URL locale (limite 2,5 Mo), via une interface remplaçable par Supabase Storage ;
- migration proposée : `supabase/migrations/0001_initial_schema.sql`.

## Limites de cette phase

Pas d’authentification admin, de paiement réel, de synchronisation serveur ou d’envoi de message tant que les services client ne sont pas connectés.
