import { paymentLifecycle } from "@/lib/payment-lifecycle";

export type DemoPayment={id:number;client:string;service:string;owner:string;expectedAmount:number;dueDate:string;status:string;nextAction:string;verification?:{extractedAmount:number;reference:string;confidence:string}};
export const demoModeEnabled=()=>process.env.NODE_ENV!=="production"&&(process.env.ARKA_DEMO_MODE==="true"||process.env.DEMO_MODE==="true")&&!process.env.DATABASE_URL;
const localDate=(offset:number)=>{const date=new Date();date.setDate(date.getDate()+offset);return date.toISOString().slice(0,10);};
export function demoPayments():DemoPayment[]{const dueToday=localDate(0);return[
  {...paymentLifecycle.present({id:-1,client:"DemoBuild Constructions",service:"Digital Marketing",owner:"Demo Account",expectedAmount:25000,dueDate:dueToday,status:"UPCOMING"}),nextAction:"Follow Up"},
  {...paymentLifecycle.present({id:-2,client:"UrbanNest Interiors",service:"Social Media Marketing",owner:"Demo Account",expectedAmount:18000,dueDate:localDate(1),status:"PROOF_UPLOADED"}),nextAction:"Verify Payment",verification:{extractedAmount:18000,reference:"DEMO-UTR-18000",confidence:"High · DEMO EXTRACTION"}}
];}
