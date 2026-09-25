import { deriveDateStatus, type PaymentStatus } from "@/lib/payment-state";

type LifecyclePayment={dueDate:string;status:string};
const preserved=new Set<PaymentStatus>(["PROOF_UPLOADED","VERIFYING","MANUAL_REVIEW","MISMATCH","VERIFIED","PAID","REJECTED"]);
const actions:Record<PaymentStatus,string>={UPCOMING:"Monitor",DUE_TODAY:"Follow Up",OVERDUE:"Follow Up",PROOF_UPLOADED:"Verify Payment",VERIFYING:"Wait for Verification",MANUAL_REVIEW:"Review",MISMATCH:"Resolve Mismatch",VERIFIED:"Confirm Payment",PAID:"Completed",REJECTED:"Request Re-upload"};
const reasons:Record<PaymentStatus,string>={UPCOMING:"Payment is not due yet.",DUE_TODAY:"Payment is due today.",OVERDUE:"Payment is past its due date.",PROOF_UPLOADED:"A proof is awaiting verification.",VERIFYING:"Payment verification is in progress.",MANUAL_REVIEW:"A human review is required.",MISMATCH:"Payment details do not match the expected amount.",VERIFIED:"Verification succeeded and needs payment confirmation.",PAID:"Payment has been confirmed.",REJECTED:"Payment proof was rejected."};
const kolkataDate=(now:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(now);
export class PaymentLifecycleService {
  getPaymentStatus(payment:LifecyclePayment,now=new Date()):PaymentStatus { return preserved.has(payment.status as PaymentStatus)?payment.status as PaymentStatus:deriveDateStatus(payment.dueDate,now); }
  getDaysUntilDue(payment:Pick<LifecyclePayment,"dueDate">,now=new Date()){const today=kolkataDate(now);return Math.round((Date.parse(`${payment.dueDate}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);}
  getNextAction(payment:LifecyclePayment,now=new Date()){return actions[this.getPaymentStatus(payment,now)];}
  getAttentionReason(payment:LifecyclePayment,now=new Date()){return reasons[this.getPaymentStatus(payment,now)];}
  present<T extends LifecyclePayment>(payment:T,now=new Date()){const status=this.getPaymentStatus(payment,now);return {...payment,status,daysUntilDue:this.getDaysUntilDue(payment,now),nextAction:actions[status],attentionReason:reasons[status]};}
  actionRequired<T extends LifecyclePayment>(payments:T[],now=new Date()){const order:Record<string,number>={OVERDUE:0,DUE_TODAY:1,MISMATCH:2,MANUAL_REVIEW:2,PROOF_UPLOADED:3,VERIFIED:4};return payments.map(p=>this.present(p,now)).filter(p=>p.status in order).sort((a,b)=>order[a.status]-order[b.status]||a.dueDate.localeCompare(b.dueDate));}
}
export const paymentLifecycle=new PaymentLifecycleService();
