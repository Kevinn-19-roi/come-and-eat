# Délivrabilité des e-mails Come & Eat

## Architecture vérifiée

- Les e-mails transactionnels passent par Resend côté serveur.
- L’expéditeur provient de `EMAIL_FROM`; aucune clé n’est envoyée au navigateur.
- Chaque message contient une version HTML, une version texte, un texte d’aperçu, un logo PNG absolu sur `https://comeandeat.org` et uniquement des liens officiels.
- La table `email_events` et les clés d’idempotence limitent les doublons applicatifs.

## Vérification DNS dans Resend

Les valeurs DKIM sont propres au compte Resend et ne doivent jamais être devinées. Dans Resend, ouvrir **Domains → comeandeat.org**, puis recopier exactement les enregistrements affichés chez le fournisseur DNS.

Vérifier que le domaine est indiqué **Verified**, puis contrôler :

1. SPF : l’enregistrement fourni par Resend est présent une seule fois. Si un SPF existe déjà, fusionner les mécanismes dans un unique enregistrement.
2. DKIM : chaque nom, type et valeur correspond exactement aux valeurs affichées par Resend.
3. DMARC : commencer par une politique d’observation et une adresse de rapport appartenant à Come & Eat, puis renforcer après analyse des rapports.
4. `EMAIL_FROM` utilise une adresse du domaine réellement vérifié dans Resend.
5. L’adresse de réponse définie dans Administration → Paramètres pointe vers une boîte surveillée.

## Recette sans envoi à un client

- Générer et vérifier les templates avec `npm run test:emails`.
- Pour un essai réel, utiliser uniquement une adresse interne contrôlée.
- Contrôler dans Resend les statuts delivered, bounced et complained avant d’augmenter le volume.
