export const siteConfig = {
  brand: {
    name: 'Come & Eat',
    tagline: 'Le goût qui parle',
    logo: '/brand/come-eat-logo.webp',
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
  },
  footer: {
    description: 'Une cuisine simple et généreuse, préparée avec soin à Abidjan.',
    legal: '© 2026 Come & Eat',
  },
  social: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
  externalLinks: { bloop: 'https://bloop-ci.com' },
} as const;