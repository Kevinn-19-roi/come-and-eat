export const siteConfig = {
  brand: {
    name: 'Come & Eat',
    tagline: 'Le goût qui parle',
    logo: '/brand/come-eat-logo-transparent.webp',
    description: 'Cuisine généreuse préparée à la commande, disponible en livraison ou à retirer à Abidjan.',
  },
  contact: {
    phone: '+225 07 48 99 22 11',
    email: 'bonjour@come-eat.local',
    address: 'Abidjan, Côte d’Ivoire',
  },
  hours: 'Tous les jours · 11h–23h',
  announcement: 'Livraison à Abidjan · 7j/7',
  delivery: {
    promise: 'Livraison estimée en 25 minutes',
    areas: ['Cocody','Plateau','Marcory','Riviera'],
    pickupLabel: 'Retrait au restaurant, sans attente',
  },
  loyalty: { enabled: true, label: 'Programme fidélité' },
  hero: {
    eyebrow: 'Cuisine préparée à la commande',
    title: 'Le goût qui parle.',
    body: 'Des recettes généreuses, des produits frais et une cuisine faite au moment de votre commande.',
    primaryCta: { label: 'Voir le menu', href: '/menu' },
    secondaryCta: { label: 'Nous contacter', href: '/contact' },
    featuredProduct: { name: 'Formule Burger', price: '7 000 FCFA', href: '/menu/formule-burger', image: '/images/burger.svg' },
  },
  homepage: {
    popularEyebrow: 'Les plus demandés',
    popularTitle: 'Les favoris de la maison',
    categoriesEyebrow: 'À chacun son envie',
    categoriesTitle: 'Par où commencer ?',
    categoriesIntro: 'Une carte courte, généreuse et préparée à la commande.',
    conceptEyebrow: 'Notre façon de cuisiner',
    conceptTitle: 'Bon, frais, sans détour.',
    conceptIntro: 'Trois engagements simples qui se retrouvent dans chaque commande.',
    values: [
      { number: '01', title: 'Des produits frais', body: 'Des ingrédients sélectionnés pour des recettes simples et généreuses.' },
      { number: '02', title: 'Préparé minute', body: 'Votre repas est cuisiné au moment où vous le commandez.' },
      { number: '03', title: 'Livré chaud', body: 'Une livraison organisée pour préserver le goût et la texture.' },
    ],
    finalCta: { title: 'Votre repas, simplement.', body: 'Choisissez vos plats, personnalisez-les et indiquez où vous livrer.' },
  },
  footer: {
    description: 'Une cuisine simple et généreuse, préparée avec soin à Abidjan.',
    legal: '© 2026 Come & Eat',
  },
  social: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
  externalLinks: { bloop: 'https://bloop-ci.com' },
  payment: {
    wave: {
      label: 'Wave',
      checkoutUrl: 'https://pay.wave.com/m/M_ci_4k5NBZ8a_cwl/c/ci/',
      merchantPhone: '+225 07 11 45 97 23',
    },
  },
} as const;
