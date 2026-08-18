import type { Category, DeliveryZone, Media, Order, Product, ProductOptionGroup, SiteSettings } from '@/types';

export const media: Media[] = [
  { id:'m1', name:'Burger maison', url:'/images/burger.svg', alt:'Burger maison Come & Eat', createdAt:'2026-08-01' },
  { id:'m2', name:'Alloco', url:'/images/alloco.svg', alt:'Alloco doré', createdAt:'2026-08-02' },
  { id:'m3', name:'Bissap', url:'/images/bissap.svg', alt:'Jus de bissap frais', createdAt:'2026-08-03' },
];
export const categories: Category[] = [
  { id:'cat-burgers', name:'Burgers', slug:'burgers', image:media[0], visible:true, order:1 },
  { id:'cat-accompagnements', name:'Accompagnements', slug:'accompagnements', image:media[1], visible:true, order:2 },
  { id:'cat-boissons', name:'Boissons', slug:'boissons', image:media[2], visible:true, order:3 },
  { id:'cat-desserts', name:'Desserts', slug:'desserts', visible:true, order:4 },
];
export const optionGroups: ProductOptionGroup[] = [
 { id:'og-side', name:'Accompagnement', required:true, multiple:false, options:[{id:'o-fries',name:'Frites',price:0,available:true},{id:'o-alloco',name:'Alloco',price:500,available:true},{id:'o-attieke',name:'Attiéké',price:500,available:true}] },
 { id:'og-drink', name:'Boisson', required:false, multiple:false, options:[{id:'o-water',name:'Eau',price:500,available:true},{id:'o-coke',name:'Coca',price:1000,available:true},{id:'o-bissap',name:'Bissap',price:1000,available:true}] },
 { id:'og-extra', name:'Suppléments', required:false, multiple:true, options:[{id:'o-cheese',name:'Fromage',price:500,available:true},{id:'o-meat',name:'Viande supplémentaire',price:1500,available:true}] },
];
export const products: Product[] = [
 {id:'p1',sku:'CEA-BUR-0001',name:'Burger Poulet',slug:'burger-poulet',categoryId:'cat-burgers',price:4500,description:'Poulet croustillant, salade fraîche et sauce maison.',image:media[0],available:true,optionGroupIds:['og-extra']},
 {id:'p2',sku:'CEA-BUR-0002',name:'Burger Bœuf',slug:'burger-boeuf',categoryId:'cat-burgers',price:5000,description:'Steak de bœuf, cheddar et oignons confits.',image:media[0],available:true,optionGroupIds:['og-extra']},
 {id:'p3',sku:'CEA-FOR-0001',name:'Formule Burger',slug:'formule-burger',categoryId:'cat-burgers',price:7000,description:'Votre burger avec un accompagnement et une boisson.',image:media[0],available:true,optionGroupIds:['og-side','og-drink','og-extra']},
 {id:'p4',sku:'CEA-ALL-0001',name:'Alloco',slug:'alloco',categoryId:'cat-accompagnements',price:2000,description:'Bananes plantain mûres, frites et dorées.',image:media[1],available:true,optionGroupIds:[]},
 {id:'p5',sku:'CEA-FRI-0001',name:'Frites',slug:'frites',categoryId:'cat-accompagnements',price:1500,description:'Frites croustillantes légèrement salées.',available:true,optionGroupIds:[]},
 {id:'p6',sku:'CEA-BIS-0001',name:'Jus de Bissap',slug:'jus-de-bissap',categoryId:'cat-boissons',price:1000,description:'Infusion d’hibiscus fraîche et parfumée.',image:media[2],available:true,optionGroupIds:[]},
 {id:'p7',sku:'CEA-EAU-0001',name:'Eau',slug:'eau',categoryId:'cat-boissons',price:500,description:'Bouteille d’eau minérale fraîche.',available:true,optionGroupIds:[]},
 {id:'p8',sku:'CEA-DES-0001',name:'Fondant chocolat',slug:'fondant-chocolat',categoryId:'cat-desserts',price:2500,description:'Gâteau au chocolat au cœur fondant.',available:false,optionGroupIds:[]},
];
export const orders: Order[] = [
 {id:'ord1',reference:'CEA-240815-1042',customer:{name:'Aïcha K.',phone:'+225 07 00 00 00 01'},items:[{id:'oi1',productName:'Formule Burger',quantity:2,unitPrice:7000,options:['Alloco','Bissap']}],total:14000,fulfillment:'delivery',address:'Cocody Angré, près de la pharmacie',zone:'Cocody',paymentMethod:'Wave',note:'Sans oignons',status:'new',createdAt:'2026-08-15T11:35:00Z'},
 {id:'ord2',reference:'CEA-240815-1038',customer:{name:'Moussa D.',phone:'+225 05 00 00 00 02'},items:[{id:'oi2',productName:'Burger Bœuf',quantity:1,unitPrice:5000,options:['Fromage']}],total:5500,fulfillment:'pickup',paymentMethod:'Orange Money',status:'preparing',createdAt:'2026-08-15T10:50:00Z'},
 {id:'ord3',reference:'CEA-240815-1029',customer:{name:'Fatou C.',phone:'+225 01 00 00 00 03'},items:[{id:'oi3',productName:'Burger Poulet',quantity:2,unitPrice:4500,options:[]}],total:9000,fulfillment:'delivery',address:'Marcory Résidentiel',zone:'Marcory',paymentMethod:'MTN Mobile Money',status:'ready',createdAt:'2026-08-15T09:20:00Z'},
];
export const deliveryZones: DeliveryZone[] = [{id:'z1',name:'Cocody',fee:1500,active:true},{id:'z2',name:'Marcory',fee:1200,active:true},{id:'z3',name:'Plateau',fee:1000,active:true}];
export const siteSettings: SiteSettings = {restaurantName:'Come & Eat',phone:'+225 07 00 00 00 00',email:'bonjour@come-eat.local',address:'Abidjan, Côte d’Ivoire',currency:'XOF',deliveryEnabled:true,pickupEnabled:true};
