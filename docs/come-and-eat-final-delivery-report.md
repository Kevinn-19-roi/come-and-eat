# Come & Eat — préparation de livraison conditionnelle

## Sprint de fermeture — état courant du 14 octobre 2026

**Verdict : NO-GO.** Le détail des onze chantiers, preuves, tests et conditions est dans [v2-closure-matrix.md](v2-closure-matrix.md). Les sections suivantes sont conservées comme historique ; leurs nombres et blocages ne décrivent pas tous l'état courant.

### Blocages fermés localement

- **Finance prépayée :** réception Wave d'abonnement journalisée une seule fois ; crédit immuable sur commandes/sous-commandes, solde réel `amount_due`, prix contractuel, extras/livraison seuls à payer. Quotas réservés à la planification, consommés à la remise, libérés sur annulation non servie. Annulation payée réservée au Super Administrateur sans remboursement fictif. Expiration serveur idempotente libérant les brouillons non matérialisés. Réconciliation des encaissements, consommations et reliquats. Anciennes commandes conservées, aucune nouvelle vente comptée une seconde fois pour le crédit prépayé.
- **Confirmation groupée :** devis serveur, consentement au total, transaction SQL unique, rollback complet en cas d'échec tardif, reçu de confirmation idempotent. Trois repas/deux dates/deux restaurants testés réellement dans PostgreSQL isolé ; frais partagés par restaurant/créneau exact/adresse/zone. Le modèle conserve une commande et un paiement distincts par repas : pas de fausse promesse d'une unique transaction Wave globale. Aucun repas estimé ne déclenche de préparation.
- **Messagerie :** recherche/filtres avant limite, pagination stable des conversations et des messages, accès aux historiques au-delà de 100/200, non-lus fondés sur la progression réellement affichée. Réponse uniquement depuis la page récente. Isolation et rate limit conservés, polling raisonnable, pas de Realtime fictif.
- **Commission stratégique :** contournement constaté dans l'ancien formulaire générique/accès aux paramètres. Nouvelle protection SQL `finance.configure`, validation 0..10 000 points de base, confidentialité et journal d'audit. Contrôle ajouté aux deux actions serveur, champ désactivé pour l'admin ordinaire. Droits de table explicités, RLS conservée. Aucun taux réel modifié.
- **Communications et exports :** suivi client, détails admin/vendeur, emails, WhatsApp et CSV distinguent valeur du repas, crédit déjà payé et solde. CSV protège aussi les cellules interprétables comme formules. Aucun email ou message réel envoyé.

### Tests de ce sprint

- TypeScript, ESLint, `test:ci`, statistiques financières, export utilisateurs (CSV réel, 5 000 lignes simulées), garde-fous V2, templates/WhatsApp réellement exécutés par transpilation : réussis.
- **38 migrations originales rejouées** dans PostgreSQL PGlite isolé avec extensions pgcrypto/pg_trgm, RLS et `SET ROLE`. Scénarios prépayé, quotas, expiration, frais groupés, échecs/retries, messagerie longue et droits de commission réussis. Un premier scénario a révélé un privilège DML `site_settings` absent du replay ; les grants explicites sous RLS ont été ajoutés, puis toute la suite a été relancée avec succès.
- Suite PostgreSQL V2 historique, document traiteur, corrections locales, action Contact avec mocks : réussis. Auth/Storage y sont des fixtures, non une recette Supabase Auth réelle.
- Boutique officielle **réellement relue en accès public** : unique, approuvée, **paused**. Aucune réactivation.
- `npm audit --omit=dev` : **0 alerte**. Audit complet : **5 alertes élevées de développement**, chaîne braces/micromatch/fast-glob/ESLint Next. Pas de correction forcée ni rétrogradation majeure imposée. Ce résidu reste documenté, pas masqué.
- Build final `npm.cmd run build -- --webpack` réussi, 79 pages, identifiant `Weq2ii4EoNxAq0IEzbu7V`. **Edge final : 8/8 largeurs** 320, 375, 390, 430, 768, 1024, 1280, 1440 ; panier fixture 3 articles/13 500 FCFA, catégorie active, checkout sans superposition/débordement et routes protégées anonymes, aucune exception JavaScript. Captures/JSON régénérés dans `artifacts/final-client-qa/`, build ID dans chaque résultat ; capture checkout 375 inspectée visuellement. Contrastes promo 12,39:1 et note financière 8,95:1. Premier passage interrompu à 768 px : mesure avant hydratation du panier (élément absent). Attente explicite ajoutée au test, assertions conservées, nouvelle exécution complète réussie. Test de reprise réseau non exécuté : checkout désactivé en sécurité puisque les RPC locales en attente n'existent pas encore sur la base configurée. Aucune commande, aucun email, aucune écriture Supabase depuis Edge.

### Migrations en attente — inventaire réel

Lecture officielle `npx.cmd --no-install supabase migration list --linked` réussie, projet local lié **pazddhyqojhrdinaqryu**, dernière distante **202609070002**. **20 en attente**, aucune appliquée pendant le sprint :

1. `202610130001_statistics_periods.sql`
2. `202610130002_admin_user_export_activity.sql`
3. `202610140001_contact_rate_limit.sql`
4. `202610140002_v2_permissions_reviews.sql`
5. `202610140003_v2_catering.sql`
6. `202610140004_v2_plans_subscriptions.sql`
7. `202610140005_v2_catering_workflow.sql`
8. `202610140006_v2_team_invitations_notifications.sql`
9. `202610140007_v2_planning_safety.sql`
10. `202610140008_scheduled_order_materialization.sql`
11. `202610140009_subscription_contract_snapshots.sql`
12. `202610140010_secure_conversations.sql`
13. `202610140011_scheduled_delivery_and_hours.sql`
14. `202610140012_restaurant_public_whatsapp.sql`
15. `202610140013_scheduled_restaurant_trigger_time.sql`
16. `202610140014_delivery_planning_projection.sql`
17. `202610140015_subscription_settlement.sql`
18. `202610140016_atomic_planning_confirmation.sql`
19. `202610140017_conversation_history.sql`
20. `202610140018_strategic_commission_permission.sql`

Le replay vierge prouve l'ordre et l'exécution SQL, pas la compatibilité exhaustive avec toutes les données historiques distantes, les volumes/verrous, ni un retour arrière en production. Aucune migration déjà appliquée n'a été modifiée.

### Ce qui empêche encore le GO

1. **RBAC historique incomplet :** `requireAdmin()` et les anciennes RPC gardent leurs contrôles admin général. Les rôles spécialisés ne gagnent pas de privilèges globaux, mais n'ont pas encore tous les accès métier attendus aux anciens modules. Exemple concret : planning admin accessible par `planning.manage`, puis lien `/admin/orders/[id]` encore refusé au rôle commandes. Il faut des projections et contrôles minimaux cohérents, pas élargir `is_admin()`.
2. **Recette authentifiée et concurrence native non exécutées :** Docker et psql absents ; WSL échoue `Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG`. PostgreSQL embarqué exécute vraiment le SQL mais ne fournit pas les services Auth/JWT/REST/Storage et sérialise les connexions. Aucun test de course natif ni upload/auth réel isolé ne peut être déclaré validé.
3. **Module abonnement encore partiel :** parcours financier local désormais intégré, mais document professionnel mensuel et reporting comptable complet non finalisés. Les offres Étudiant/Professionnel restent non publiées ; livraison et éligibilité commerciales ne sont pas inventées.
4. **Mise en production non préparée au niveau récupérabilité :** sauvegarde restaurable et compatibilité sur clone représentatif à vérifier, dry-run final non exécuté car clôture technique incomplète. Aucun contournement SQL Editor.

### Configuration / étapes restantes

- Fournir ou configurer un environnement Supabase QA distinct avec Auth/REST/Storage ; utiliser uniquement ses comptes fictifs pour les tests d'écriture. Le problème d'accès CLI de production n'est plus un blocage.
- Achever le RBAC historique et les documents/reporting, puis relancer toute la recette QA et les tests de concurrence. Ces travaux de développement ne sont pas reportés sur Kevin.
- Préparer sauvegarde/restauration et analyse de compatibilité, puis seulement un dry-run de migration ; nouveau rapport GO/NO-GO et **validation explicite de Kevin** avant toute application réelle/commit/push.
- Workers : `V2_SCHEDULING_WORKER_ENABLED=false` et `V2_NOTIFICATION_WORKER_ENABLED=false` par défaut. Planifier après validation un appel serveur authentifié à `/api/internal/v2-scheduling` (expiration/rappels) et `/api/internal/v2-notifications` (envoi). Configurer `CRON_SECRET` côté serveur ; jamais une clé publique. Aucun ordonnanceur de production configuré pendant ce sprint.
- Resend/expéditeur/destinataires restent serveur ; aucun envoi QA à des tiers. Conditions commerciales et politique comptable de reconnaissance doivent être validées avant publication des offres.

### Git et fichiers

Copie unique `F:\documents\come-and-eat`, branche `main`, HEAD `e11cb67`. Tous les changements antérieurs conservés. Aucun commit, indexation, push, déploiement ou migration distante. Image étrangère et sauvegardes intactes. Manifest de revue : `docs/v2-files-to-review.txt` ; il s'agit d'une liste à examiner, pas d'une autorisation de `git add --all`. Captures, secrets et sauvegardes à exclure.

Les changements de ce sprint portent sur les migrations 015–018, le planning/confirmation, les abonnements/réconciliation, le worker de programmation, les historiques de messages, les crédits dans les suivis/emails/WhatsApp/CSV, la commission et leurs tests. Modernisation V2 conservée, aucune nouvelle refonte.

---

## Historique de la reprise précédente — conservé, non état courant

> **État courant — reprise disque externe, 14 octobre 2026 : NON PRÊT / NO-GO.** Les notes ci-dessous sont un historique conservé et ne doivent pas être additionnées comme des validations actuelles. L’accès CLI est rétabli, le projet lié est `pazddhyqojhrdinaqryu`, le dernier historique distant lu est `202609070002`. **16 migrations locales sont en attente**, jusqu’à `202610140014`. Les **34 migrations originales** ont été exécutées sur PostgreSQL PGlite isolé avec scénarios métier/RLS ; Auth et Storage restent des fixtures. Aucune migration distante, aucun commit, push, déploiement ou email de test réel dans cette reprise.

## Dernière reprise — résultats et limites prioritaires

### Correctifs locaux supplémentaires

- Confirmation des repas ordinaires programmés : retrait **et livraison** reliés à `confirm_scheduled_meal`. Montant attendu incluant les frais, commune active relue et prix revérifié côté base ; aucune validation Wave implicite. Les repas d’abonnement ne sont pas artificiellement transformés en commandes payées.
- Horaires globaux explicites : écran `/admin/delivery-hours`, permission `delivery.operate` vérifiée par la page, l’action et la RPC. Sept jours en heure d’Abidjan, horaires traversant minuit, aucun horaire commercial inventé. Une livraison future sans configuration explicite est refusée. Le checkout ordinaire conserve sa compatibilité tant qu’aucune plage n’est configurée, puis respecte les plages enregistrées.
- Checkout : suppression du `deliveryEnabled/pickupEnabled` toujours vrai dans le repository ; disponibilité calculée par RPC, repli fermé en cas d’échec de lecture sur un environnement configuré. Le retrait n’est plus présenté comme disponible lorsqu’il est fermé. Boutons rétablis et erreur compréhensible après interruption réseau, clé d’idempotence conservée.
- WhatsApp public : consentement `whatsapp_public` désactivé par défaut, case vendeur explicite ; aucun fallback automatique vers le téléphone pour le bouton public. Le numéro opérationnel reste disponible pour les utilisateurs autorisés traitant les commandes. La case ne constitue pas une anonymisation du champ professionnel déjà public dans le modèle existant.
- Bug transversal trouvé : le trigger historique des sous-commandes vérifiait toujours `now()`. Il pouvait donc refuser une commande future valide si le restaurant était fermé au moment du checkout. La nouvelle migration additive `013` utilise `orders.scheduled_for` pour les commandes programmées, sinon l’heure actuelle ; aucune migration déjà appliquée modifiée.
- Planning quotidien : plats et restaurants réellement associés, créneaux et adresses, regroupement chronologique par journée, sous-total journalier excluant les annulations. Confirmation individuelle et suivi conservés ; aucun faux calendrier de disponibilité.
- Livraison spécialisée : `/admin/planning/deliveries` accessible via `planning.deliveries`, filtre par période et limite explicite de 100 résultats. RPC projetant uniquement les coordonnées et éléments opérationnels des commandes matérialisées. Suppression de l’accès direct du seul rôle livraison aux tables financières de planning, sans retirer les accès clients, membres restaurant et gestionnaires autorisés. Tests SQL de refus client, absence de finances dans la projection et isolement du planning A réussis.

### Tests réellement exécutés dans cette reprise

- TypeScript et ESLint réussis sur la version finale. Une erreur ESLint `Date.now()` pendant le rendu de la nouvelle page logistique a été détectée, puis corrigée en réutilisant l’horloge PostgreSQL existante ; la validation a été relancée, sans désactivation de règle.
- `test:ci`, `test:statistics-finance`, `test:user-export`, `test:v2-safety` réussis. Ces suites mêlent tests de contrats statiques et exécutions déterministes ; elles ne prouvent pas des parcours authentifiés Supabase.
- `test:sql-isolated` réussi après ajout de `014` : 34 migrations originales, tables publiques sous RLS, documents privés, isolation A/B, messagerie, encaissements partiels, Wave idempotent, remise/annulation et commissions, horaires Abidjan/minuit, relecture du prix de zone, refus serveur d’une livraison fermée, restaurant fermé maintenant mais ouvert au créneau futur, consentement WhatsApp modifiable uniquement par son restaurant autorisé et projection livraison restreinte.
- Audit npm : zéro alerte de production ; cinq alertes élevées de développement sur la chaîne braces/micromatch/fast-glob/ESLint Next. Pas de `audit fix --force` ni rétrogradation de Next.
- Build final `npm.cmd run build -- --webpack` réussi après les derniers changements : 78 pages, compilation, TypeScript, génération et traces terminées, code de sortie 0.
- Edge sur ce build : **8/8 largeurs** 320, 375, 390, 430, 768, 1024, 1280, 1440. Panier fixture de 3 articles/13 500 FCFA, catégorie active, absence de débordement menu/checkout, absence de double barre au checkout, redirections anonymes messages et deux nouveaux écrans admin, aucune exception JavaScript. Captures et JSON : `artifacts/final-client-qa/`. Pas de validation des formulaires authentifiés. Le scénario navigateur d’interruption réseau n’a pas été exécuté : la disponibilité serveur est volontairement fermée tant que la RPC locale en attente n’existe pas sur la base configurée ; bouton désactivé confirmé. Ne pas présenter ce scénario comme réussi.
- Contact : tests de validation et d’action serveur exécutés ; destinataire absent, anti-spam, doublon et échec fournisseur vérifiés avec mocks. Aucun email réel envoyé.
- Boutique officielle : test public en lecture seule réussi, unique et approuvée ; `operating_status=paused`. Aucune réactivation.
- Garde-fou des tests distants et analyse de 38 modules client réussis : aucun import admin ou usage direct de clé serveur détecté. Contrôle statique, pas une preuve exhaustive contre toute fuite.
- Le contrôle de diff avec normalisation CRLF désactivée a signalé trois fins de ligne mixtes dans les anciens scripts de tests. Normalisation mécanique limitée à ces trois fichiers, puis contrôle réussi ; aucune logique de test ni aucun garde-fou supprimé.
- Inspection effective des captures menu desktop et checkout mobile : modernisation V2 conservée. Libellé du code promo sur fond blanc et note du récapitulatif sur fond vert trop peu contrastés ; correctif CSS ciblé et test de contraste calculé ≥ 4,5 ajoutés. Le bouton indisponible possède maintenant un état visuel distinct. La validation du nouveau build/captures de ce correctif doit être lue dans la dernière ligne de validation ci-dessous.

**Dernière validation de cette reprise :** build final reconstruit et serveur redémarré, identifiant `AjzXHlKBatG7O-cxJ-dnS`. Edge 8/8 après correction : contraste du libellé promo **12,39:1**, note financière **8,95:1**, captures régénérées et mobile inspecté visuellement. Aucune exception JavaScript ; ce contrôle ne constitue pas un audit de contraste exhaustif. `git diff --check` également réussi après normalisation des fins de ligne. Nouveau replay SQL 34/34 réussi avec **snapshots réels de commission 10 % puis 15 %**, ancienne commande inchangée, boutique officielle **isolée** à 0 %, et refus croisés Wave/encaissement espèces. Le changement de la boutique officielle dans ce scénario est uniquement une fixture PGlite détruite à la fermeture ; la boutique réelle est restée en pause. Tous les utilisateurs et commandes QA SQL existent uniquement dans cette base en mémoire, jamais dans Supabase distant.

### Précision financière importante

Le dashboard actuel sélectionne les **commandes créées depuis le début de période**, puis reconnaît leurs sous-commandes payées et non annulées. Il ne s’agit pas d’un journal comptable filtré selon la date exacte d’encaissement : une commande créée avant le début de période et encaissée ensuite reste dans sa cohorte historique. Cette règle existante n’a pas été changée arbitrairement. Les encaissements d’abonnements et repas prépayés ne doivent pas être additionnés aux ventes ordinaires ; leur intégration/reporting demeure bloquante. Les commissions affichées sont des snapshots distincts du chiffre de ventes, pas un montant ajouté une seconde fois au CA.

### Ce qui empêche encore le GO

1. Matérialisation financière des repas d’abonnement, règlement des frais/suppléments, documents et reporting prépayé non finalisés ; offres Étudiant/Professionnel maintenues désactivées.
2. RBAC des anciens écrans/RPC non entièrement intégré ; les rôles spécialisés n’héritent pas de `is_admin()`. Affectations logistiques et circuit de remboursement incomplets.
3. Sélection de plusieurs journées, navigation calendaire et confirmation groupée multi-jours non finalisées ; les repas ordinaires sont affichés par journée et confirmés individuellement, avec un suivi et un paiement distincts.
4. Recette authentifiée complète Auth/JWT/Storage sur Supabase isolé non exécutée ; les tests PostgreSQL ne la remplacent pas.
5. Sauvegarde/restauration de production non vérifiée et dry-run final non réalisé. L’accès CLI n’est plus un blocage ; aucune nouvelle authentification n’est demandée.

Les développements techniques restants restent à la charge de l’agent, pas du propriétaire. Kevin doit seulement confirmer les conditions commerciales manquantes et donner ultérieurement l’autorisation finale de publication lorsque les critères techniques seront remplis.

### État fonctionnel courant (sans assimilation à une validation production)

| Lot | État local | Limite actuelle |
| --- | --- | --- |
| Repas programmés | Retrait/livraison ordinaires matérialisés, affichage quotidien, paiement et orchestration protégés | Confirmation groupée, sélection multi-jours et intégration prépayée incomplètes |
| Avis vérifiés | Achat réel, doublons, modération, signalement et réponse implémentés ; tests SQL isolés | Recette Auth/Storage réelle non faite ; photo d’avis non ajoutée |
| Abonnements | Formules, souscription, paiement manuel, snapshots et réservations atomiques testés isolément | Conversion prépayée, suppléments/frais et documents/reporting incomplets ; offres désactivées |
| Traiteur | Demandes, devis protégés, publication, décision, affectation et notifications implémentés localement | Worker désactivé, recette authentifiée/fournisseur réelle non faite |
| RBAC | Socle cumulable, invitations vérifiées, nouveaux modules et projection livraison protégés | Anciens écrans/RPC, logistique complète et remboursements encore partiels |
| WhatsApp | Opt-in vendeur explicite et bouton réutilisé ; isolation SQL A/B testée | Nouveau champ non appliqué en production, recette vendeur authentifiée non faite |
| Catégories/panier mobile | Actif synchronisé, quantité/options/sous-total et safe area ; Edge huit largeurs | Fixtures panier, pas commande réelle |
| Livraison par commune | Zones globales existantes, frais serveur, relecture à confirmation future et horaires testés SQL | Conditions des abonnements non définies |
| CSV/XLSX | Service paginé partagé, formules neutralisées ; fichiers réels sur 5 000 lignes simulées | Pas d’export de vrais utilisateurs ni de recette Auth de la route |
| Messagerie | Bidirectionnelle, non-lus explicites, idempotence/rate limit, polling, isolation SQL | 100 conversations récentes et 200 derniers messages seulement dans l’UI ; pagination historique et politique de rétention détaillée restent à finaliser |

Docker et psql ne sont pas disponibles dans le PATH contrôlé. Aucun environnement Supabase Auth/REST/Storage isolé complet n’a été lancé ; PostgreSQL PGlite est réellement exécuté, mais ses structures Auth/Storage sont des fixtures. Aucun contournement par une service role de production n’a été utilisé pour combler cette limite.

### Inventaire courant des migrations non appliquées

Dans l’ordre : `202610130001_statistics_periods.sql`, `202610130002_admin_user_export_activity.sql`, puis `202610140001_contact_rate_limit.sql`, `202610140002_v2_permissions_reviews.sql`, `202610140003_v2_catering.sql`, `202610140004_v2_plans_subscriptions.sql`, `202610140005_v2_catering_workflow.sql`, `202610140006_v2_team_invitations_notifications.sql`, `202610140007_v2_planning_safety.sql`, `202610140008_scheduled_order_materialization.sql`, `202610140009_subscription_contract_snapshots.sql`, `202610140010_secure_conversations.sql`, `202610140011_scheduled_delivery_and_hours.sql`, `202610140012_restaurant_public_whatsapp.sql`, `202610140013_scheduled_restaurant_trigger_time.sql`, `202610140014_delivery_planning_projection.sql`.

### Publication : non autorisée et non exécutée

Après achèvement technique, recette isolée représentative et sauvegarde restaurable : lecture `npx.cmd supabase migration list --linked`, puis `npx.cmd supabase db push --linked --dry-run`, contrôle des impacts et rapport GO/NO-GO. **Attendre alors la validation explicite de Kevin** avant tout `db push` réel, commit, push ou déploiement. Ne pas exécuter une suite d’écriture avec `.env.local` pointant la production. Ne pas réactiver la boutique officielle.

## Archive des passes précédentes — remplacée par l’état courant ci-dessus

Les constats suivants sont conservés pour traçabilité. Leurs nombres de migrations, anciens refus 403 et éléments alors non commencés ne décrivent plus l’état courant.

> **Dernier état vérifié : mission finale, 14 octobre 2026 — NON PRÊT.** Accès Supabase rétabli ; 12 migrations locales en attente. Export CSV, barre panier mobile, catégories synchronisées et messagerie sécurisée ajoutés. Trente migrations rejouées sur PostgreSQL isolé et tests métier/RLS exécutés sur ce schéma. Les cinq modules V2 ne sont cependant pas tous terminés : voir le journal de mission ci-dessous. Aucune autorisation de publication sollicitée à ce stade.

> Dernière continuation locale : `docs/v2-local-continuation.md`. Ajout des commandes de retrait programmées cash/Wave, orchestration des rappels et snapshots d’abonnement (migrations 008/009 non appliquées). Les limitations et anciens résultats ci-dessous restent à lire avec ce journal plus récent ; verdict toujours NO-GO.

14 octobre 2026 — `F:\documents\come-and-eat` — branche `main`.

## 1. Résumé exécutif

### Journal de mission finale — accès rétabli et compléments

**Verdict de cette passe : NON PRÊT.** Ce journal remplace les anciens constats d’accès refusé. Les descriptions historiques plus bas ne constituent pas une déclaration de fin de développement.

#### Supabase et migrations

- CLI officiel vérifié via npx.cmd : seul projet retourné COME AND EAT, référence pazddhyqojhrdinaqryu, lié et ACTIVE_HEALTHY. Historique distant accessible jusqu’à 202609070002.
- Onze migrations en attente vérifiées au démarrage. Ajout local de 202610140010_secure_conversations.sql : douze en attente au total, dans l’ordre 202610130001, 202610130002, puis 202610140001 à 202610140010.
- Aucun db push, migration repair, SQL Editor, commit, push ou déploiement. Boutique officielle non modifiée. Aucun nouveau cycle d’authentification.
- Trente migrations du dépôt exécutées sans réécriture sur PostgreSQL PGlite avec les extensions réelles pgcrypto et pg_trgm. Auth.users, auth.uid/auth.role et Storage sont des structures de fixture ; ce test ne prouve pas les services Supabase Auth/Storage ni les JWT réels.
- Tests supplémentaires sur ce schéma : isolation produits et sous-commandes A/B, encaissement refusé au client et au concurrent, préparation anticipée refusée, transitions de retrait et encaissement idempotent, statistiques d’encaissement partiel avec remise, annulations, confirmation Wave idempotente et CA sans double comptabilisation.
- Sauvegarde/restauration de la base distante non vérifiée. Dry-run non exécuté : les modules et migrations ne sont pas encore stabilisés pour publication.

#### Cinq modules V2

- Planning : retrait ordinaire matérialisé et testé SQL ; livraison programmée, calendrier complet, confirmation groupée multi-jours et intégration financière des abonnements encore incomplets.
- Avis : achat vérifié, doublons, modération, signalements et réponses existants conservés ; tests isolés V2 disponibles. Recette authentifiée UI complète non réalisée dans cette passe.
- Abonnements : snapshots et quotas sécurisés existants conservés ; matérialisation des repas prépayés, frais/suppléments et documents mensuels non finalisés. Offres commerciales désactivées.
- Traiteur : demandes, devis protégés, publication, acceptation/refus et invitations conservés ; tests isolés disponibles. Pas de paiement ni prestation fictive.
- RBAC : cinq responsabilités cumulables existantes, invitations et permissions des nouveaux modules conservées. Intégration des anciens modules, gestion logistique et circuit de remboursement encore incomplets. Aucun élargissement de is_admin() aux rôles spécialisés.

#### Six compléments

- WhatsApp : coordonnées professionnelles et bouton existants conservés ; gestion explicite de visibilité publique pas encore finalisée. Aucun numéro personnel récupéré depuis un propriétaire.
- Catégories : états actifs des filtres réellement appliqués, aria-pressed, catégorie sélectionnée visible horizontalement ; navigation restaurant synchronisée aux sections visibles. Key du catalogue synchronisée à la catégorie d’URL.
- Panier mobile : quantité totale et sous-total avec options, safe area, espace réservé au contenu. Désactivé sur checkout, panier et fiche produit disposant déjà de leurs propres CTA.
- Livraison par commune : système existant conservé, pas de tarif inventé. Matrice complète abonnements/plannings/livraison future non terminée.
- CSV utilisateurs : XLSX conservé, service paginé partagé, recherche conservée, BOM UTF-8, séparateur point-virgule et neutralisation des formules. Limite de sécurité 100 000 résultats : erreur plutôt que troncature silencieuse. Export réservé aux admins historiques autorisés ; aucun accès ajouté aux rôles spécialisés sans permission explicite.
- Messagerie : client/service client et restaurant volontairement activé, historique, réponses, compteurs non lus, lecture explicite, clôture, envois idempotents, 4 000 caractères, 10 messages/minute et 5 ouvertures/jour, RLS et isolation. Staff restaurant exclu par défaut. Actualisation 30 secondes, suspendue en arrière-plan et pendant la saisie ; pas de faux Realtime ni d’email à chaque message. Recherche/statuts admin parmi les 100 conversations récentes. Derniers 200 messages affichés ; historique conservé sans purge automatique. Politique de rétention détaillée et archivage des conversations volumineuses restent à définir.

#### Tests et UX

- TypeScript, ESLint, CI locale, correctifs locaux, garde-fou des huit suites distantes et génération CSV réussis.
- CSV : fichier réellement généré sur zéro, une et 5 000 lignes simulées ; accents, guillemets, sauts de ligne, filtres, pagination et formules testés. Autorisation de route contrôlée statiquement, pas d’export de vrais utilisateurs.
- Messagerie sur PostgreSQL complet : refus d’accès concurrent, réponse support, non-lu/lecture, clé idempotente, clôture et rate-limit testés. Pas de recette UI authentifiée simulée.
- Edge : huit largeurs 320/375/390/430/768/1024/1280/1440. Panier exclusivement fictif dans le navigateur de test : 3 articles, sous-total 13 500 FCFA ; catégorie active et absence de barre au checkout vérifiées. Route messages anonyme redirigée vers login ; aucune erreur JavaScript observée. Captures dans artifacts/final-client-qa, à exclure du commit.
- Build intermédiaire réussi : 76 pages générées. Build final après filtres de messagerie lancé, résultat à compléter ci-dessous.
- Audit npm : zéro vulnérabilité production ; cinq alertes élevées de développement dans braces/micromatch/fast-glob/ESLint Next. Aucun correctif non cassant proposé par npm ; downgrade forcé vers eslint-config-next 14.2.35 non appliqué.
- Checklist React appliquée : composants de navigation légers, nettoyage des observers/timers, respect du mouvement réduit, formulaires accessibles et requêtes authentifiées côté serveur. Vérification navigateur limitée explicitement aux frontières réellement accessibles.

#### Git et préparation de livraison

Main, HEAD e11cb67, modifications antérieures préservées. Sauvegarde du précédent export vérifiée par SHA256 dans .audit-backup/final-20261014-exports (exclue de Git). Image étrangère et captures non publiées. Liste de revue mise à jour dans docs/v2-files-to-review.txt ; elle n’est pas une autorisation de git add global.

Après achèvement : rejouer tous les tests, vérifier l’historique distant, sauvegarde récupérable et restauration isolée, puis `npx.cmd supabase db push --dry-run`. Présenter un nouveau GO/NO-GO. Après validation explicite seulement : db push contrôlé, vérifications SQL/RLS, recette autorisée, revue/staging explicite des fichiers, commits, push sans force, suivi GitHub Actions et SHA Vercel, recette production. Si une migration échoue, arrêter ; ne pas masquer l’historique avec migration repair. Retour arrière : conserver les données, rétablir le précédent code compatible et privilégier une migration corrective additive plutôt qu’une suppression de tables.

Les développements et tests restants sont des tâches techniques, non des actions à déléguer à Kevin. Décisions humaines restantes : conditions de livraison/éligibilité des offres, volume professionnel et autorisation de publication après un vrai GO. La présente passe n’atteint pas ce GO.

**LIVRAISON BLOQUÉE — NO-GO.** Le développement local a avancé, mais les cinq modules ne sont pas tous intégrés de bout en bout. Les six demandes complémentaires ne sont pas engagées, conformément à la priorité imposée. Aucun commit, push, déploiement ou changement de schéma distant effectué pendant cette passe.

Cette situation n’est pas seulement un blocage de configuration : des développements techniques restent nécessaires. Ils ne sont pas présentés comme des actions à effectuer par Kevin.

## 2. Fonctionnalités existantes préservées

Marketplace, Auth, administration/vendeur, boutique officielle, options, panier, checkout, Wave manuel, espèces, commissions, statistiques, export XLSX, Contact, médias, contenu, partage et modernisation food-v2 conservés. Sauvegarde supplémentaire `.audit-backup/final-additions-start`, exclue de Git ; SHA256 du CSS storefront identique à celui de sa sauvegarde. L’image étrangère reste non suivie et non sélectionnée pour publication.

## 3. Cinq nouveaux modules

| Module | État local honnête |
|---|---|
| Avis vérifiés | Publication après achat payé/remis, unicité, affichage public, signalement, modération et réponses développés ; permissions testées en PostgreSQL fixture |
| Traiteur | Demandes, attribution restaurant, brouillons, publication de devis, acceptation/refus propriétaire, historique privé, document HTML téléchargeable et suivi client développés |
| RBAC | Rôles cumulés séparés de profiles.role, accès protégés, invitations avec email vérifié, suspension de responsabilités et audit développés ; anciens modules spécialisés pas tous intégrés |
| Planning | Planning estimatif, options, horaires futurs, livraison/retrait et quotas développés ; paiement final, matérialisation des commandes et déclenchement serveur manquants |
| Abonnements | Formules inactives, configuration, snapshots et quotas atomiques développés ; activation commerciale, facturation, rapprochement complet et intégration finale au planning manquants |

Le devis téléchargé est un document HTML imprimable, pas un PDF ni une facture fiscale. Sa publication ne constitue ni un encaissement ni la preuve d’un email délivré.

## 4. Six modifications complémentaires

Non commencées : visibilité/désactivation WhatsApp vendeur, catégories actives, barre panier mobile, audit frais par commune, CSV utilisateurs et messagerie interactive. Les fonctionnalités de contact, zones de livraison et XLSX déjà existantes restent en place. Elles ne sont pas déclarées nouvellement validées pour ce périmètre.

## 5. Modernisation UX/UI

Manrope et identité food-v2 conservées. Nouveaux formulaires utilisant le feedback/pending existant, confirmations pour publication/retrait d’invitation/réponse au devis, libellés français. Aucun redesign global entrepris. Accès ajoutés au compte client pour demandes traiteur et invitations ; navigation vendeur pour les demandes effectivement attribuées.

## 6. Performances

Historique/devis chargés depuis une fiche administrative dédiée, pas par deux requêtes supplémentaires pour chaque ligne des 100 demandes. Listes bornées et index par demande/date ajoutés. Notifications par lots de trois, timeout réseau Resend de quinze secondes, verrou récupérable après cinq minutes. Aucune mesure Core Web Vitals comparative réalisée pendant cette passe.

## 7. Sécurité

RLS conservée. RPC SECURITY DEFINER à search_path explicite, droits EXECUTE minimaux. Téléchargement de devis par session et RLS, sans service role de secours, contenu HTML échappé, CSP restrictive, no-store et noindex. Numéros composés uniquement de tirets refusés par contrainte SQL. Aucun secret ajouté au dépôt.

Les anciens scripts d’écriture restent bloqués sur toute URL Supabase non locale. Aucun test distant d’écriture relancé. L’incident de la passe précédente reste documenté dans le rapport V2 ; il n’est pas effacé de l’historique.

## 8. Rôles et permissions

Invitations créées uniquement par Super Administrateur, rôles sur liste autorisée, aucun super_admin proposé. Acceptation uniquement avec l’email vérifié correspondant dans auth.users. Révocation/expiration/suspension contrôlées, droits cumulés sans modification implicite de profiles.role. Une ancienne attribution admin générale n’est pas silencieusement convertie.

**Bloquant :** ordres/livraisons/menus/finance des anciens écrans et RPC ne sont pas intégralement ouverts aux rôles spécialisés. is_admin() n’a pas été élargi pour contourner ce travail. Les remboursements et affectations de livraison restent à développer. La protection du dernier super administrateur existante n’a pas été remplacée.

## 9. Paiements et statistiques

Paiements ordinaires et statistiques existants non réécrits. Tests de contrats Wave/espèces/commissions passés. Les abonnements ne sont pas additionnés comme des ventes ordinaires ; leur reporting séparé et le règlement des repas futurs restent incomplets. Aucun paiement réel ni remboursement effectué. Les conditions financières non validées ne sont pas inventées.

## 10. Messagerie

Module interactif non commencé : il appartient aux six ajouts, à engager après les cinq modules. Contact/Resend existants conservés. Aucun chatbot ni conversation fictive ajouté.

## 11. Exports

Export XLSX existant conservé. CSV utilisateurs non commencé. Aucun export de données clients réalisé pour cette passe. Le téléchargement du devis est une route séparée protégée, pas un export des utilisateurs.

## 12. Livraison par commune

Zones globales existantes conservées. Le planning estimatif réutilise leur tarif actif serveur et ne facture pas le retrait. Le contrôle des horaires globaux futurs, la revalidation finale et les conditions des abonnements ne sont pas complets : aucun GO financier sur les plannings.

## 13. Tests fonctionnels

Réussis pendant cette passe : TypeScript, ESLint, test:ci (contrats historiques), test:catering-document, test:v2-notifications, test:v2-safety et tests PostgreSQL V2. Les templates V2 sont réellement exécutés après transpilation isolée, sans appel à Resend. Les sorties de scripts statiques ne sont pas présentées comme une recette utilisateur réelle.

Validation build et captures de la version finale de cette passe : voir le journal de validation ci-dessous. Aucun parcours authentifié complet des nouveaux modules sur Supabase réel n’est revendiqué.

## 14. Tests RLS réellement effectués

PostgreSQL PGlite isolé avec schéma fixture : avis frauduleux/doublon, modération, isolation client, abonnement non payé refusé, quota/libération, devis brouillon invisible, tiers ne pouvant accepter, acceptation idempotente, invitation d’un tiers refusée, email non vérifié refusé, cumul sans paiement implicite, RPC de worker refusée au rôle authenticated et exécutée au rôle service_role, bail/accusé protégés.

Cinq migrations V2 exécutées dans cet environnement : 002 à 006. Refus du devis, récupération de demandes invitées uniquement après email vérifié, invitation révoquée et isolation de deux restaurants traiteur également testés. Le restaurant attribué ne lit pas les notes internes et ne modifie pas le devis ; le restaurant concurrent ne voit pas la demande. **Ce n’est pas un replay complet du schéma Supabase ni un test des JWT/Realtime/Storage du fournisseur.** Une vraie base Supabase isolée reste nécessaire.

## 15. Migrations appliquées

Aucune migration distante appliquée. Projet lié localement confirmé : `pazddhyqojhrdinaqryu`. `supabase migration list --linked` échoue à nouveau HTTP403 ; historique réel non confirmé et dry-run non exécuté. La session Chrome n’est pas accessible via le runtime Computer Use disponible : aucune récupération de cookies/tokens tentée.

Ordre local des migrations à rapprocher avec l’historique :

1. 202610130001_statistics_periods.sql
2. 202610130002_admin_user_export_activity.sql
3. 202610140001_contact_rate_limit.sql
4. 202610140002_v2_permissions_reviews.sql
5. 202610140003_v2_catering.sql
6. 202610140004_v2_plans_subscriptions.sql
7. 202610140005_v2_catering_workflow.sql — nouvelle passe
8. 202610140006_v2_team_invitations_notifications.sql — nouvelle passe

Les migrations précédemment appliquées ne sont pas modifiées. Les ajustements de 002/003/004 concernent les nouvelles migrations locales non appliquées de la V2. Sauvegarde/restauration de base complète non prouvée ; la sauvegarde de sources ne la remplace pas.

## 16. Fonctionnalités actives

Production : aucun nouveau module activé par cette passe. Local : écrans et RPC décrits ci-dessus, avec états d’activation absente lorsque les tables n’existent pas sur la base configurée. Les contrats métiers sont testés en fixture, pas injectés dans la production.

## 17. Fonctionnalités désactivées

Offres Étudiant/Professionnel non publiées. `V2_NOTIFICATION_WORKER_ENABLED=false` par défaut ; aucun cron Vercel ajouté. Le worker ne traite que les événements traiteur/invitation implémentés, pas les rappels de repas ou expirations d’abonnements. Aucun prélèvement automatique, webhook Wave fictif ou suivi GPS inventé.

## 18. Décisions commerciales encore nécessaires

Livraison/éligibilité/conditions Étudiant ; volume Professionnel ; annulations/remboursements futurs ; reconnaissance comptable du prépayé ; prestations traiteur réellement proposées. La boutique officielle était en pause au contrôle de la passe précédente ; son état commercial souhaité ne doit pas être déduit d’un test interrompu.

## 19. Commits

Aucun. Branche main, HEAD e11cb67. Travaux antérieurs et nouveaux conservés non commitées. Revue explicite requise, sans git add --all. Exclure secrets, sauvegardes, artifacts, image étrangère et script ponctuel de récupération QA.

## 20. GitHub Actions

Non déclenché : critères GO non réunis. Les suites distantes historiques ne doivent pas être ajoutées à une CI avec des clés de production.

## 21. Vercel

Aucun déploiement. Le build local ne prouve pas un déploiement Ready. Configuration future nécessaire pour notifications : CRON_SECRET serveur, V2_NOTIFICATION_WORKER_ENABLED après autorisation, Resend/expéditeur existants valides, invocation sécurisée de /api/internal/v2-notifications. Aucun envoi réel pendant les tests.

## 22. Vérifications en production

Pas de recette authentifiée de production ni d’écriture de test pendant cette passe. Le CLI a seulement tenté la lecture d’historique. Aucun résultat de fixture n’est présenté comme un résultat de production.

## 23. Risques résiduels et procédure GO

Modules et six ajouts incomplets ; RBAC historique non intégralement migré ; intégration financière des plannings manquante ; historique/migrations et restauration distante non confirmés ; recette authentifiée et audit global définitif non réalisés. Audit npm relancé : cinq alertes élevées de développement dans braces → micromatch → fast-glob → ESLint Next ; aucune alerte avec --omit=dev. Le correctif forcé proposé rétrograderait eslint-config-next vers 14.2.35, incompatible avec le choix Next 16 : non appliqué. Ce constat n’est pas une garantie permanente.

Pour reprendre la livraison : terminer les cinq modules, puis les six ajouts ; rejouer le schéma complet sur environnement isolé ; recette et audit final ; vérification de sauvegarde restaurable ; accès CLI légitime et historique ; dry-run ; autorisation compatible avec tous les contrôles ; application/vérification des migrations ; seulement ensuite commit/push et suivi du SHA déployé. En cas d’anomalie, conserver la production et corriger additivement.

## 24. Actions manuelles éventuelles

Uniquement : rétablir un accès CLI autorisé au projet (sans communiquer de secret dans le chat), confirmer les conditions commerciales et l’état souhaité de la boutique officielle, et autoriser ultérieurement les opérations sensibles après passage de tous les contrôles. Les développements et tests techniques restants ne sont pas transférés au propriétaire.

## Journal de validation finale de cette passe

### Reprise — diagnostic Supabase et sécurisation du planning

- Diagnostic détaillé : `docs/supabase-access-diagnostic.md`. Le CLI liste deux autres projets, pas Come & Eat ; la lecture d’historique lié reçoit HTTP403. Compte sans accès ou portée du jeton insuffisante : distinction non encore établie. Aucune session Chrome contrôlable par les outils exposés.
- Lecture publique uniquement : boutique officielle Come & Eat Cocody approuvée, en pause ; aucune réactivation.
- Nouvelle migration additive non appliquée : `202610140007_v2_planning_safety.sql`. Retrait atomique et idempotent d’un repas de brouillon, restitution de quota réservé ; transitions opérationnelles interdites sans vraie commande liée et paiement compatible.
- Interface client : retrait avec confirmation et chargement ; repas annulés exclus du total estimé. Administration : aucune action de préparation proposée pour une estimation non matérialisée.
- PostgreSQL PGlite : six migrations V2 exécutées et assertions réussies, dont retrait isolé, refus d’accès à autrui, quota libéré une seule fois et refus de préparation sans commande. Ce schéma minimal n’est pas une validation complète de Supabase.
- TypeScript, ESLint et suite CI locale réussis. Aucun email réel, commit, push ou migration distante dans cette reprise.
- Verdict inchangé : LIVRAISON BLOQUÉE. Planning/paiements futurs, abonnements intégrés, RBAC historique et six compléments ne sont pas tous terminés. Ne pas publier sur la seule base de ces tests.

- `npm run build -- --webpack` : réussi, compilation, TypeScript et 74 pages générées.
- Edge sur ce build : 64/64 contrôles anonymes, huit routes × huit largeurs ; `/catering`, `/subscriptions`, `/meal-planner`, `/admin/reviews`, `/account/catering`, `/account/invitations`, `/admin/team`, `/vendor/catering`.
- Deux contrôles supplémentaires réussis : téléchargement de devis anonyme = 401 ; worker email désactivé = 503.
- Captures locales et JSON : `artifacts/v2-modules/`. Pas de formulaires envoyés, pas de validation authentifiée simulée.
- Galerie locale : `artifacts/v2-modules-review.html`. Les captures de connexion sont explicitement identifiées, sans les présenter comme les écrans authentifiés.
- ESLint final et git diff --check réussis ; seul avertissement Git : conversion LF/CRLF. HEAD reste e11cb67. CSS storefront et sauvegarde ont le même SHA256.
- Serveur local arrêté après la recette ; aucun worker/cron laissé actif. Pour une prochaine recette d’écriture, configurer d’abord une base isolée : la configuration locale actuelle vise le projet réel.
- CLI : projet lié pazddhyqojhrdinaqryu, lecture d’historique refusée HTTP403. Aucun dry-run ou db push exécuté.
