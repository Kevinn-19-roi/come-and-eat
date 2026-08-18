export type PaymentMethod = 'wave'|'orange-money'|'mtn-money'|'card';
export interface PaymentRequest { orderReference:string; amount:number; method:PaymentMethod }
export interface PaymentResult { status:'pending'|'unavailable'; message:string }
export interface PaymentProvider { createPayment(request:PaymentRequest): Promise<PaymentResult> }
export class SimulationPaymentProvider implements PaymentProvider { async createPayment(){ return {status:'pending',message:'Paiement non débité — intégration à venir.'} as PaymentResult } }
