import 'server-only';import {siteConfig} from '@/config/site';
export type PaymentSession={provider:string;url:string;merchantPhone?:string};
export interface PaymentProvider{readonly name:string;createSession(input:{orderReference:string;amount:number;currency:'XOF'}):Promise<PaymentSession>;verifyWebhook(request:Request):Promise<never>}
export const wavePaymentLinkProvider:PaymentProvider={name:'wave_payment_link',async createSession(){return{provider:this.name,url:siteConfig.payment.wave.checkoutUrl,merchantPhone:siteConfig.payment.wave.merchantPhone}},async verifyWebhook(){throw new Error('Le lien marchand Wave ne fournit pas de webhook vérifiable.')}};
export function getPaymentProvider(){return wavePaymentLinkProvider}
