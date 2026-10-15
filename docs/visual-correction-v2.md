# Correction visuelle food-v2

## A. Pourquoi la première passe était insuffisante

Les captures initiales et première modernisation ont des SHA-256 différents et montrent bien deux rendus. Le titre du hero passe du serif au sans-serif, l'image concept change et les cartes s'arrondissent. Cela confirme des différences effectives, mais pas une transformation suffisante.

Les causes concrètes sont une structure inchangée (texte à gauche, photo ronde à droite), la même succession de grands blocs, beaucoup d'espace inutilisé avec un seul restaurant/produit, des catégories minuscules et une typographie mélangée. `premium-2026.css` utilisait des polices système et ses règles génériques h2 perdaient contre les règles historiques spécifiques telles que `.section-head h2` qui imposent Georgia. La première passe n'avait ajouté aucun vrai nouveau composant public : elle modifiait surtout les styles. L'annonce était donc trop ambitieuse par rapport au résultat visible.

Les captures historiques ne suffisent pas à prouver rétrospectivement les détails du cache navigateur ; leur différence et leurs caractéristiques visibles ne suggèrent pas une duplication accidentelle. La nouvelle passe enregistre la version DOM, les URLs CSS chargées, la police calculée et le chargement de Manrope dans `artifacts/visual-v2/report.json`.

## B. Différences réalisées cette fois

- Manrope variable embarquée localement (Fontsource), utilisée dans tous les titres publics avec des sélecteurs ciblés. Aucun appel Google Fonts dans le navigateur.
- Hero photographique plein cadre : photo culinaire réelle en arrière-plan, composition vert profond/texte blanc, recherche intégrée, suppression du cadrage circulaire. Mobile : photo en premier, texte et commande sur un socle vert.
- Catégories en tuiles horizontales image/texte, fond crème et rythme plus compact.
- Restaurant unique présenté en grande composition horizontale photo/identité/menu sur desktop, plutôt qu'une petite carte perdue dans une grille vide. Comportement adaptatif lorsque plusieurs restaurants sont disponibles.
- Produit vedette unique en composition image/texte large ; les grilles gardent leurs comportements lorsque le catalogue s'étoffe.
- Cartes restaurant : statut sur la photo, identité plus forte, CTA de découverte explicite. Favoris et liens conservés.
- Cuisine sur fond vert, section restaurateurs crème chaud, concept asymétrique, CTA final menthe : variation réelle des compositions, sans nouveaux textes métier.
- Page restaurant : couverture cadrée, bloc identité superposé, navigation de catégories vert profond.
- Produit : photo immersive, panneau clair, prix contrasté, options/quantité/total préservés.
- Micro-interactions limitées aux cartes/flèches ; réduction des animations respectée.

Fichiers : `src/app/storefront-redesign.css`, `src/app/layout.tsx`, `src/app/(public)/layout.tsx`, `src/app/(public)/page.tsx`, `src/components/restaurant-card.tsx`, package.json/lock.

Les styles nouveaux sont limités à `.storefront` : aucun remodelage admin/vendor. Les vraies images et données restent celles des repositories existants. Aucune règle de prix, disponibilité, paiement, commission ou option n'est modifiée.

## C. Revue immédiate

```powershell
Set-Location 'F:\documents\come-and-eat'
npm.cmd start -- -p 3210
```

Ouvrir `http://localhost:3210` après build. Pour le développement : `npm.cmd run dev -- -p 3210`.

Comparaison : `F:\documents\come-and-eat\artifacts\come-and-eat-visual-comparison.html`.

Les captures originales sont conservées dans `visual-qa-before-20261014-complete`. La première modernisation est conservée dans `visual-qa-premiere-modernisation`. Les nouvelles captures sont dans `visual-v2`. Pour les pages produit et restaurant desktop sans capture initiale, le comparatif identifie explicitement l'avant comme celui de la première modernisation ; aucun faux ancien rendu n'est généré.

## Vérifications

Le script `scripts/visual-v2.mjs` lance Edge dans un contexte neuf par largeur, bloque les Service Workers, attend les polices, vérifie `food-v2`, le CSS calculé, la console et le débordement, puis capture accueil/restaurant/produit sur 320, 375, 390, 430, 768, 1024, 1280 et 1440 px. Il teste aussi ouverture/fermeture du menu mobile. Les URLs restaurant/produit restent fixes dans la session ; les lectures publiques ne modifient aucune donnée.

Les captures comparent Alloco sur l'accueil, Djeun Royal sur la fiche produit et Come & Eat Cocody. Les statuts opérationnels proviennent des lectures publiques actuelles et peuvent évoluer depuis les captures historiques ; aucune donnée n'est modifiée pour simuler un restaurant ouvert. Aucune donnée n'est ajoutée pour donner artificiellement l'impression d'une marketplace plus fournie.

Un défaut hérité du premier frontend a été détecté visuellement : la barre sticky de la fiche produit recouvrait le prix. Elle est replacée dans le flux après les options, avec contrôle de non-chevauchement. La sélection et désélection de deux boissons est vérifiée dans Edge lorsque le produit le permet, sans soumettre de commande.

La recette authentifiée RLS/Storage et les paiements réels restent hors de cette validation locale. Les précédentes migrations et les correctifs locaux sont conservés. Aucun commit/push/déploiement/migration distante.

## Résultats techniques

- ESLint global, TypeScript, suite CI, tests financiers et build de production : réussis.
- Tests CI : marketplace, prix/paiements, commandes, horaires, emails, espèces/options facultatives, partage/multi-sélection.
- Contact et correctifs locaux : réussis, avec mocks pour les envois et sans email réel.
- Edge : 24 parcours accueil/restaurant/produit sur huit largeurs, console sans erreur, aucun overflow, Manrope chargée, marqueur `food-v2` présent et rayon de photo hero à 0 px. Menu mobile ouvert/fermé à 375 et 430 px.
- Panier/checkout : captures locales sur 375 et 1440 px avec fixture localStorage explicitement signalée ; aucune commande soumise.
- Prix/options : non-chevauchement prix/barre et sélection/désélection de deux boissons contrôlés dans Edge.
- Captures définitives : retour en haut de page après interaction, puis capture ; évite le header sticky photographié au milieu de page. Les images lazy sont chargées avant la capture pleine page afin de ne pas confondre photographie absente et photographie non encore chargée.

Ces contrôles ne constituent pas une recette authentifiée complète des modules admin/vendor ni un paiement réel. Ils couvrent le rendu modifié et les contrats métier existants.
