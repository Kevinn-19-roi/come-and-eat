export const v2Modules=[
 {href:'/admin/delivery-hours',label:'Horaires de livraison',permission:'delivery.operate'},
 {href:'/admin/messages',label:'Messages',permission:'support.manage'},
 {href:'/admin/reviews',label:'Avis clients',permission:'reviews.moderate'},
 {href:'/admin/catering',label:'Service traiteur',permission:'catering.manage'},
 {href:'/admin/planning/deliveries',label:'Livraisons programmées',permission:'planning.deliveries'},
 {href:'/admin/planning',label:'Repas programmés',permission:'planning.manage'},
 {href:'/admin/subscriptions',label:'Abonnements',permission:'subscriptions.manage'},
 {href:'/admin/team',label:'Équipe et permissions',permission:'team.manage'},
] as const;
