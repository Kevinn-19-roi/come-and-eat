# V2 — matrice de clôture

État initial du sprint de clôture. Aucun statut « terminé » ne vaut validation en production.

| Chantier | Statut initial | Blocage identifié | Test nécessaire | Condition de validation |
|---|---|---|---|---|
| Planning | Partiel | Confirmation groupée et regroupement financier | Prix, dates, frais, retries, rollback SQL | Commandes explicites atomiques sans doublon |
| Avis | Partiel | Recette Auth réelle manquante | Achat vérifié, fraude, modération | Permissions SQL et parcours authentifié validés |
| Abonnements | Partiel | Conversion prépayée, réconciliation, expiration/annulation | Quotas concurrents, paiement, non-double CA | Prépayé et encaissements additionnels séparés |
| Traiteur | Partiel | Recette Auth réelle manquante | Demande, devis, attribution, téléchargement | Isolation et décisions persistantes |
| RBAC | Partiel | Anciens modules encore liés à admin général | Pages/API/RPC par responsabilité | Permission minimale sur toutes les frontières |
| WhatsApp | Partiel | Recette vendeur Auth manquante | Opt-in, numéro, URL, isolation | Aucun numéro privé publié implicitement |
| Catégories | Terminé localement | Aucun blocage reproduit | Edge filtres/état actif | État actif correspond au filtre |
| Panier mobile | Terminé localement | Aucun blocage reproduit | Quantités/options, huit largeurs | Sous-total exact, pas de superposition |
| Communes | Partiel | Intégration planning groupé/prépayé | Relecture prix, retrait, multi-jours | Frais recalculés serveur et snapshot |
| CSV utilisateurs | Partiel | Recette Auth réelle manquante | Filtres, 5 000 lignes, formules, accès | CSV/XLSX sécurisés et complets |
| Messagerie | Partiel | Pagination historique et recette Auth réelle | Envoi/réponse/non-lus/isolation | Historique navigable sans fuite |

## Garde-fous

Production exclue des tests d’écriture. Migrations distantes, commit, push et déploiement interdits pendant ce sprint. Boutique officielle réelle en pause, ne pas modifier.

## Résultat du sprint de clôture — 14 octobre 2026

Les preuves SQL ci-dessous sont des exécutions PostgreSQL PGlite avec `SET ROLE` et fonctions Auth de fixture. Elles ne remplacent pas des sessions Supabase Auth/JWT/REST/Storage. Aucun test de concurrence multi-connexion natif n'est annoncé comme réussi.

| Chantier | Statut de clôture | Preuve d'implémentation | Test effectué | Risque / condition restante |
|---|---|---|---|---|
| Planning | Partiel, confirmation groupée implémentée | migrations 015/016, `planning-confirmation.tsx`, actions meal-planner | SQL : 3 repas/2 dates/2 restaurants, 16 400 FCFA, frais 3 400, rollback tardif, retries même/nouvelle clé | Une commande réelle par repas, pas fusion quotidienne ; paiement Wave distinct par solde. Recette Auth et concurrence native manquantes ; sélection encore repas par repas |
| Avis vérifiés | Implémenté localement, recette partielle | migration 002, `product-reviews.tsx`, modules reviews | SQL V2 : achat vérifié, refus fraude, doublons/RLS ; contrat de code | Recette client/vendeur/modérateur Auth réelle manquante, photo optionnelle non implémentée |
| Abonnements | Finance locale intégrée, module partiel | migration 015, réconciliation/receipts/crédit, pages subscriptions | SQL : paiement manuel idempotent, crédit 1 450, livraison seule 1 700 à payer, quotas réservés/consommés/libérés, expiration et reliquat conservé | Concurrence native, facture mensuelle et reporting comptable complet non validés ; offres incomplètes désactivées |
| Traiteur | Implémenté localement, recette partielle | migrations 003/005/006, pages catering, téléchargement protégé | PostgreSQL V2 et génération du document, échappement/expiration | Recette Auth/Storage réelle et fournisseur notifications non exécutés |
| RBAC | **Bloquant, partiel** | permissions cumulables, routes V2 protégées, migration 018 protège commission | SQL : refus commission admin ordinaire, super autorisé et journalisé ; tests rôles/RLS nouveaux modules | Anciens écrans/actions/RPC restent liés à admin général. Orders/menu/finance spécialisés ne disposent pas encore de tous leurs anciens modules. Aucun élargissement de `is_admin()` |
| WhatsApp restaurant | Implémenté localement | migration 012, opt-in vendeur, helper WhatsApp partagé | SQL isolation contact A/B ; lien et texte réellement exécutés, accents et crédit prépayé | Recette du formulaire vendeur Auth réelle manquante ; aucun message envoyé |
| Catégories actives | Terminé localement | menu-catalog, restaurant-category-nav | Edge état `aria-pressed` et filtre aux huit largeurs | Aucun parcours authentifié requis ; voir captures locales, non production |
| Barre panier mobile | Terminé localement | mobile-cart-bar, layout public | Edge panier fixture 3 articles/13 500 FCFA, huit largeurs, absence au checkout | Panier fixture clairement identifié, pas commande créée en navigateur |
| Frais par commune | Intégration locale testée | zones existantes, migrations 011/015/016 | SQL relecture tarif, livraison/retrait, frais groupés par restaurant/créneau/adresse | Frais d'abonnement non présumés inclus ; conditions commerciales à valider. Frais confirmés immuables, pas remboursement automatique |
| CSV utilisateurs | Terminé localement, recette permissions partielle | route users/export, service user-export commun CSV/XLSX | CSV généré : vide, accents, formules, 5 000 lignes simulées, pagination/filtres | Route contrôlée statiquement ; aucun export de vrais utilisateurs ni session Auth QA |
| Messagerie | Historique terminé localement, recette Auth partielle | migration 017, inbox et thread paginés | SQL envoi/réponse/non-lus/rate-limit/isolation + 105 conversations + fil >200 messages | Polling 30 s conservé ; Realtime non activé. Politique de rétention à formaliser ; pas de test JWT réel |

### Conditions impératives avant GO

1. Achever les accès spécialisés aux anciens modules avec projections et permissions SQL minimales, sans élargir les droits globaux.
2. Recette Auth/REST/Storage et concurrence réelle sur environnement QA distinct. Docker/psql absents ; WSL échoue `REGDB_E_CLASSNOTREG`. Aucune installation système hors projet tentée.
3. Stabiliser documents/reporting d'abonnement et conditions des offres ; aucune publication commerciale fictive.
4. Vérifier sauvegarde restaurable, compatibilité distante et dry-run final après clôture technique ; puis autorisation explicite de Kevin. Aucun `db push` dans ce sprint.

**Verdict : NO-GO.** La finance prépayée, la confirmation groupée et la pagination sont désormais testées localement ; cela ne ferme pas artificiellement les blocages RBAC/Auth restants.
