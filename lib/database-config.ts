import { NextResponse } from "next/server";

export const DATABASE_NOT_CONFIGURED="DATABASE_NOT_CONFIGURED";
export const databaseConfigured=()=>Boolean(process.env.DATABASE_URL);
export const isDatabaseNotConfigured=(error:unknown)=>error instanceof Error&&error.message===DATABASE_NOT_CONFIGURED;
export const databaseNotConfiguredResponse=()=>NextResponse.json({code:DATABASE_NOT_CONFIGURED,error:"Database not configured."},{status:503});
