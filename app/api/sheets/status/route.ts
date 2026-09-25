import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { GoogleSheetsProvider } from "@/lib/google-sheets";
import { databaseNotConfiguredResponse,isDatabaseNotConfigured } from "@/lib/database-config";

export async function GET(){
  try { await requireRole("FOUNDER","ACCOUNTS_MANAGER"); return NextResponse.json(await new GoogleSheetsProvider().testConnection()); }
  catch(error) { if(isDatabaseNotConfigured(error))return databaseNotConfiguredResponse(); const message=error instanceof Error?error.message:""; return NextResponse.json({error:message==="UNAUTHORIZED"?"Authentication required.":"Insufficient permissions."},{status:message==="UNAUTHORIZED"?401:403}); }
}
