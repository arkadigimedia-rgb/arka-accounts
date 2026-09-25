import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { DATABASE_NOT_CONFIGURED } from "@/lib/database-config";

export function getDb() {
  const connectionString=process.env.DATABASE_URL;
  if(!connectionString)throw new Error(DATABASE_NOT_CONFIGURED);
  return drizzle({client:neon(connectionString),schema});
}
