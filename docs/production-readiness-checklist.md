# Checklist de préparation à la production

Dernière revue : 24 août 2026.

## Application

- [x] TypeScript, ESLint, tests métier et build Next.js passent.
- [x] Les routes publiques critiques répondent sans erreur console.
- [x] Les pages privées et transactionnelles sont exclues de l’indexation.
- [x] Les en-têtes anti-sniffing, anti-frame, referrer et permissions sont configurés.
- [x] Les dépendances de production ne présentent aucune vulnérabilité npm connue de niveau élevé.

## Authentification et permissions

- [x] `/admin` et `/vendor` redirigent les visiteurs non connectés.
- [x] Les rôles plateforme ne sont pas modifiables depuis l’inscription publique.
- [x] Les rôles restaurant passent par les RPC sécurisées.
- [x] Le dernier super administrateur est protégé par la base.

## Supabase

- [x] Les migrations locales et distantes sont synchronisées.
- [x] RLS est couverte par les tests marketplace et vendeur.
- [x] Les documents vendeur utilisent un bucket privé et des URL signées temporaires.
- [x] La service role n’est pas importée par le bundle navigateur.
- [x] Le suivi invité exige la référence et un jeton UUID non prédictible.

## Commandes et paiement

- [x] Les prix, promotions, frais et commissions sont recalculés côté serveur.
- [x] Un restaurant fermé, en pause, suspendu ou non approuvé est refusé côté serveur.
- [x] Une commande multi-restaurants reste isolée par sous-commande côté vendeur.
- [x] La confirmation Wave est manuelle, idempotente et réservée à l’administration.
- [x] Le taux de commission est figé dans chaque sous-commande.

## Exploitation

- [x] Le workflow GitHub Actions utilise Node.js 24 et une version Vercel CLI épinglée.
- [x] La CI exécute lint, TypeScript et les contrats métier non destructifs avant le build distant Vercel.
- [x] Les tests Supabase live auto-nettoyants sont exécutés séparément depuis un environnement lié.
- [ ] Connecter un fournisseur d’email transactionnel avant d’attendre des emails réels.
- [ ] Remplacer le paiement manuel uniquement lorsque Wave fournit une API/webhook officiel au client.

## Avertissements non bloquants

- Le lint SQL Supabase signale deux variables PL/pgSQL inutilisées dans les fonctions de devis/commande. Elles n’altèrent ni les résultats ni la sécurité ; leur nettoyage pourra accompagner une future révision de ces fonctions.
