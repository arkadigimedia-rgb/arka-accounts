import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";
import { databaseConfigured } from "@/lib/database-config";
import { demoModeEnabled } from "@/lib/demo-mode";
const emailStatus=()=>process.env.EMAIL_PROVIDER&&process.env.EMAIL_API_KEY?"configured":"not_configured";
export async function GET(){if(!databaseConfigured())return NextResponse.json({application:"healthy",database:"not_configured",email:emailStatus(),code:"DATABASE_NOT_CONFIGURED",demoMode:demoModeEnabled()});try{await getDb().execute(sql`select 1`);return NextResponse.json({application:"healthy",database:"available",email:emailStatus(),demoMode:false});}catch{return NextResponse.json({application:"healthy",database:"unavailable",email:emailStatus(),demoMode:false},{status:503});}}
