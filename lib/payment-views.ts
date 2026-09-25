import { payments } from "@/db/schema";
import { paymentLifecycle } from "@/lib/payment-lifecycle";
export const paymentFields={id:payments.id,client:payments.client,service:payments.service,expectedAmount:payments.expectedAmount,dueDate:payments.dueDate,status:payments.status};
export const lifecycleView=(row:{id:number;client:string;service:string;expectedAmount:number;dueDate:string;status:string})=>paymentLifecycle.present(row);
