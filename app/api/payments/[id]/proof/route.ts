import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, paymentProofs } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canAccessPayment } from "@/lib/payment-access";
import { PaymentService } from "@/lib/payment-service";
import { canTransition, type PaymentStatus } from "@/lib/payment-state";
import { getStorageProvider } from "@/lib/storage";
import { databaseNotConfiguredResponse,isDatabaseNotConfigured } from "@/lib/database-config";

const allowedTypes=new Set(["image/png","image/jpeg","application/pdf"]); const maxBytes=10*1024*1024;

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  let fileKey:string|undefined; let proofId:number|undefined;
  try {
    const user=await requireRole("FOUNDER","ACCOUNTS_MANAGER","ACCOUNT_MANAGER"); const id=Number((await params).id);
    if(!Number.isInteger(id)||id<1)return NextResponse.json({error:"Invalid payment id."},{status:400});
    const access=await canAccessPayment(user,id); if(!access.payment)return NextResponse.json({error:"Payment not found."},{status:404}); if(!access.allowed)return NextResponse.json({error:"You are not authorized to upload proof for this payment."},{status:403});
    const form=await request.formData(); const file=form.get("file");
    if(!(file instanceof File))return NextResponse.json({error:"Attach a payment proof in the file field."},{status:400});
    if(!allowedTypes.has(file.type))return NextResponse.json({error:"Only PNG, JPG/JPEG, and PDF files are allowed."},{status:415});
    if(file.size===0||file.size>maxBytes)return NextResponse.json({error:"Proof must be between 1 byte and 10 MB."},{status:413});
    if(!canTransition(access.payment.status as PaymentStatus,"PROOF_UPLOADED"))return NextResponse.json({error:"Payment cannot accept a proof in its current state."},{status:409});
    const storage=getStorageProvider(); fileKey=`payments/${id}/${crypto.randomUUID()}`; await storage.put(fileKey,await file.arrayBuffer(),file.type);
    const [proof]=await getDb().insert(paymentProofs).values({paymentId:id,fileKey,fileName:file.name,fileType:file.type,fileSize:file.size,uploadedBy:user.id}).returning(); proofId=proof.id;
    await getDb().insert(auditLogs).values({paymentId:id,userId:user.id,entityId:String(proof.id),action:"PAYMENT_PROOF_UPLOADED",newValue:JSON.stringify({fileName:file.name,fileType:file.type,fileSize:file.size}),metadata:{storage:"private"}});
    await new PaymentService().changeStatus(id,"PROOF_UPLOADED",user.id,"proof-upload");
    return NextResponse.json({id:proof.id,paymentId:id,fileName:proof.fileName,fileType:proof.fileType,fileSize:proof.fileSize,status:"PROOF_UPLOADED"},{status:201});
  } catch(error) {
    if(proofId) await getDb().delete(paymentProofs).where(eq(paymentProofs.id,proofId)).catch(()=>undefined);
    if(fileKey) await getStorageProvider().delete(fileKey).catch(()=>undefined);
    if(isDatabaseNotConfigured(error))return databaseNotConfiguredResponse(); const message=error instanceof Error?error.message:"";
    return NextResponse.json({code:message==="STORAGE_CONFIGURATION_REQUIRED"?"CONFIGURATION_REQUIRED":undefined,error:message==="UNAUTHORIZED"?"Authentication required.":message==="FORBIDDEN"?"Insufficient permissions.":message==="STORAGE_CONFIGURATION_REQUIRED"?"Private production storage is not configured.":message==="INVALID_PAYMENT_TRANSITION"?"Payment cannot accept a proof in its current state.":"Unable to upload payment proof."},{status:message==="UNAUTHORIZED"?401:message==="FORBIDDEN"?403:message==="STORAGE_CONFIGURATION_REQUIRED"?503:message==="INVALID_PAYMENT_TRANSITION"?409:500});
  }
}
