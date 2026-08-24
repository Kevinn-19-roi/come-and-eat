import 'server-only';
export type EmailEvent='customer_order_received'|'admin_order_requires_review'|'customer_payment_confirmed'|'vendor_order_ready';
export type EmailMessage={event:EmailEvent;to:string;reference:string;restaurantName?:string};
export interface EmailProvider{send(message:EmailMessage):Promise<{sent:boolean;providerId?:string;reason?:string}>}
/** Aucun faux envoi en production : une intégration réelle devra remplacer ce provider. */
export const unconfiguredEmailProvider:EmailProvider={async send(){return{sent:false,reason:'Aucun fournisseur email transactionnel configuré.'}}};
export function getEmailProvider():EmailProvider{return unconfiguredEmailProvider}
export interface NotificationProvider{sendOrderCreated(input:{reference:string;email?:string;phone:string}):Promise<{sent:boolean;reason?:string}>}
export const deferredNotificationProvider:NotificationProvider={async sendOrderCreated(input){if(!input.email)return{sent:false,reason:'Aucune adresse email.'};return getEmailProvider().send({event:'customer_order_received',to:input.email,reference:input.reference})}};
