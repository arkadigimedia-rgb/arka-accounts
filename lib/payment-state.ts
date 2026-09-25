export const PAYMENT_STATUSES = ["UPCOMING","DUE_TODAY","OVERDUE","PROOF_UPLOADED","VERIFYING","MANUAL_REVIEW","MISMATCH","VERIFIED","PAID","REJECTED"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
const transitions:Record<PaymentStatus,PaymentStatus[]>={UPCOMING:["DUE_TODAY","OVERDUE","PROOF_UPLOADED"],DUE_TODAY:["OVERDUE","PROOF_UPLOADED"],OVERDUE:["PROOF_UPLOADED"],PROOF_UPLOADED:["VERIFYING"],VERIFYING:["VERIFIED","MANUAL_REVIEW","MISMATCH"],MANUAL_REVIEW:["VERIFIED","REJECTED"],MISMATCH:["REJECTED","MANUAL_REVIEW"],VERIFIED:["PAID","REJECTED"],PAID:[],REJECTED:["PROOF_UPLOADED"]};
export function canTransition(from:PaymentStatus,to:PaymentStatus){return transitions[from]?.includes(to)??false}
export function deriveDateStatus(dueDate:string,now=new Date()):PaymentStatus{const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(now);if(dueDate<today)return "OVERDUE";if(dueDate===today)return "DUE_TODAY";return "UPCOMING"}
