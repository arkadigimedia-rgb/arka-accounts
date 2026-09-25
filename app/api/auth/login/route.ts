import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      role?: string;
    };

    const targetRole = body.role?.toUpperCase();
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password?.trim() || "";

    // Strictly enforce password 123456 as requested
    if (password !== "123456") {
      return NextResponse.json(
        { error: "Invalid password. Please check your credentials and try again." },
        { status: 401 }
      );
    }

    const isHr = targetRole === "HR" || email.includes("hr");

    // Check DB user if DATABASE_URL is active
    if (process.env.DATABASE_URL && email) {
      try {
        const [dbUser] = await getDb().select().from(users).where(eq(users.email, email));
        if (dbUser && dbUser.active) {
          const userSession = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          };
          await createSession(userSession);
          return NextResponse.json(userSession);
        }
      } catch {
        // Fall back to preset roles below
      }
    }

    if (isHr) {
      const hrUser = {
        id: 2,
        name: "ARKA HR Operations",
        email: "hr@arkadigitalmedia.in",
        role: "HR",
        active: true,
      };
      await createSession(hrUser);
      return NextResponse.json(hrUser);
    }

    // Default to Founder Portal
    const founderUser = {
      id: 1,
      name: "ARKA Founder (Admin)",
      email: "founder@arkadigitalmedia.in",
      role: "FOUNDER",
      active: true,
    };
    await createSession(founderUser);
    return NextResponse.json(founderUser);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unable to log in.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
