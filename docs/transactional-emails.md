# E-mails transactionnels

Come & Eat dispose d’une couche d’envoi transactionnel indépendante du parcours de commande. Une panne du fournisseur d’e-mail ne bloque ni une inscription, ni une commande, ni une mise à jour de statut.

## Fournisseur

L’intégration prête pour la production utilise l’API HTTPS de Resend. Les variables suivantes restent exclusivement dans Vercel :

- `RESEND_API_KEY`
- `EMAIL_FROM` (adresse d’expédition vérifiée)
- `EMAIL_REPLY_TO`
- `EMAIL_ADMIN_RECIPIENT`
- `NEXT_PUBLIC_SITE_URL`

Sans `RESEND_API_KEY` ou `EMAIL_FROM`, l’application enregistre l’événement comme « non envoyé » et continue normalement. Aucun faux e-mail n’est déclaré comme envoyé.

## Domaine et DNS

Dans Resend, ajouter le domaine d’expédition puis recopier exactement les enregistrements fournis par l’interface :

1. SPF ;
2. DKIM ;
3. adresse de retour, si demandée ;
4. DMARC recommandé par la politique du domaine.

Ne pas inventer de valeur DNS. Attendre le statut « vérifié » avant d’utiliser le domaine en production.

## Supabase Auth

Pour les e-mails de confirmation et de récupération de mot de passe, configurer le SMTP Supabase avec les identifiants SMTP du fournisseur. Ajouter :

- `https://comeandeat.org/auth/callback` aux URL de redirection autorisées ;
- l’URL de production comme URL du site ;
- des modèles Supabase cohérents avec Come & Eat.

La callback échange le code de façon SSR. Le message de récupération ne révèle jamais si une adresse existe.

## Événements applicatifs

- bienvenue après confirmation effective ;
- changement de mot de passe ;
- commande reçue pour le client ;
- nouvelle commande à vérifier pour l’administration ;
- paiement confirmé pour le client ;
- nouvelle sous-commande pour chaque restaurant concerné ;
- progression ou annulation pour le client.

Chaque e-mail possède une clé d’idempotence durable en base. L’état n’est marqué « envoyé » qu’après confirmation du fournisseur. Les erreurs sont visibles et relançables depuis la commande admin.

## Vérification

Lancer `npm run test:emails`, puis les validations TypeScript, ESLint et build. Le test vivant d’idempotence nécessite l’environnement Supabase serveur et doit nettoyer l’événement temporaire après vérification.
