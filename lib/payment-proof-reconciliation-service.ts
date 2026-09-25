import { and,eq,ne,or } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentVerifications,payments } from "@/db/schema";
import { reconcile } from "@/lib/reconciliation";
import type { ExtractedPaymentDetails } from "@/lib/payment-proof-extraction";

export class PaymentProofReconciliationService {
  async reconcile(payment:{id:number;client:string;expectedAmount:number;dueDate:string}, extracted:ExtractedPaymentDetails){
    const db=getDb(); const identifier=extracted.utr??extracted.transactionId??extracted.referenceNumber;
    const duplicate=identifier ? (await db.select({paymentId:paymentVerifications.paymentId,client:payments.client,amount:payments.expectedAmount,dueDate:payments.dueDate,reference:paymentVerifications.utr}).from(paymentVerifications).innerJoin(payments,eq(paymentVerifications.paymentId,payments.id)).where(and(ne(paymentVerifications.paymentId,payment.id),or(eq(paymentVerifications.utr,identifier),eq(paymentVerifications.transactionId,identifier),eq(paymentVerifications.referenceNumber,identifier)))))[0]??null : null;
    if(duplicate)return {result:"MANUAL_REVIEW" as const,reason:"POSSIBLE DUPLICATE PAYMENT — this transaction reference appears on another payment.",duplicate};
    const result=reconcile({amount:payment.expectedAmount,dueDate:payment.dueDate,client:payment.client},{amount:extracted.amount,date:extracted.paymentDate,transactionId:extracted.transactionId,utr:extracted.utr,status:"SUCCESS",confidence:extracted.confidence==="high"?0.99:extracted.confidence==="medium"?0.75:0.4,senderName:extracted.senderName});
    return {...result,duplicate:null};
  }
}
