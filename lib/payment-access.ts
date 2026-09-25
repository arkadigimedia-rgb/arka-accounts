import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, payments } from "@/db/schema";

export async function canAccessPayment(user:{id:number;role:string},paymentId:number) {
  const [payment]=await getDb().select().from(payments).where(eq(payments.id,paymentId));
  if(!payment)return {payment:null,allowed:false};
  if(["FOUNDER","ACCOUNTS_MANAGER"].includes(user.role))return {payment,allowed:true};
  if(!payment.clientId)return {payment,allowed:false};
  const [client]=await getDb().select().from(clients).where(eq(clients.id,payment.clientId));
  return {payment,allowed:client?.accountOwnerId===user.id};
}
