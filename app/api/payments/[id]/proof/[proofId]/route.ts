import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentProofs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canAccessPayment } from "@/lib/payment-access";
import { getStorageProvider } from "@/lib/storage";
import { databaseNotConfiguredResponse,isDatabaseNotConfigured } from "@/lib/database-config";

export async function GET(_:Request,{params}:{params:Promise<{id:string;proofId:string}>}) {
  try { const user=await requireRole("FOUNDER","ACCOUNTS_MANAGER","ACCOUNT_MANAGER"); const {id,proofId}=await params; const paymentId=Number(id); const access=await canAccessPayment(user,paymentId); if(!access.payment)return NextResponse.json({error:"Payment not found."},{status:404}); if(!access.allowed)return NextResponse.json({error:"You are not authorized to access this proof."},{status:403}); const [proof]=await getDb().select().from(paymentProofs).where(and(eq(paymentProofs.id,Number(proofId)),eq(paymentProofs.paymentId,paymentId))); if(!proof)return NextResponse.json({error:"Proof not found."},{status:404}); const stored=await getStorageProvider().get(proof.fileKey); return new Response(stored.body,{headers:{"Content-Type":stored.contentType,"Content-Length":String(stored.size),"Content-Disposition":`attachment; filename="${proof.fileName.replace(/["\\]/g,"_")}"`,"Cache-Control":"private, no-store"}}); }
  catch(error) { if(isDatabaseNotConfigured(error))return databaseNotConfiguredResponse(); const message=error instanceof Error?error.message:""; return NextResponse.json({code:message==="STORAGE_CONFIGURATION_REQUIRED"?"CONFIGURATION_REQUIRED":undefined,error:message==="UNAUTHORIZED"?"Authentication required.":message==="STORAGE_CONFIGURATION_REQUIRED"?"Private production storage is not configured.":"Unable to retrieve payment proof."},{status:message==="UNAUTHORIZED"?401:message==="STORAGE_CONFIGURATION_REQUIRED"?503:500}); }
}
