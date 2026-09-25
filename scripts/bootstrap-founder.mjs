import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const { FOUNDER_NAME:name,FOUNDER_EMAIL:email,FOUNDER_PASSWORD:password,DATABASE_URL:databaseUrl }=process.env;
if(!databaseUrl)throw new Error("Set DATABASE_URL to a Neon PostgreSQL connection string.");
if(!name||!email||!password)throw new Error("Set FOUNDER_NAME, FOUNDER_EMAIL, and FOUNDER_PASSWORD.");
const salt=randomBytes(16).toString("hex"); const hash=`${salt}:${scryptSync(password,salt,64).toString("hex")}`;
const sql=neon(databaseUrl);
await sql("INSERT INTO users (name,email,password_hash,role,active,created_at,updated_at) VALUES ($1,$2,$3,'FOUNDER',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(email) DO NOTHING",[name,email,hash]);
console.log("Founder bootstrap completed. If the email already existed, no user was changed.");
