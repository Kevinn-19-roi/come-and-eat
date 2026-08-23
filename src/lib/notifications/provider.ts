import 'server-only';
export interface NotificationProvider{sendOrderCreated(input:{reference:string;email?:string;phone:string}):Promise<{sent:boolean;reason?:string}>}
export const deferredNotificationProvider:NotificationProvider={async sendOrderCreated(){return{sent:false,reason:'Aucun fournisseur email ou SMS transactionnel configuré.'}}};
