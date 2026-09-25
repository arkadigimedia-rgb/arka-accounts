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

    // 1. Quick Switch or direct role login
    if (targetRole === "HR" || email.includes("hr")) {
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

    if (targetRole === "FOUNDER" || email.includes("founder") || email.includes("admin")) {
      const founderUser = {
        id: 1,
        name: "ARKA Founder (Admin)",
        email: "founder@arkadigitalmedia.in",
        role: "FOUNDER",
        active: true,
      };
      await createSession(founderUser);
      return NextResponse.json(founderUser);
    }

    // 2. Database verification if available and email provided
    if (process.env.DATABASE_URL && email) {
      try {
        const [dbUser] = await getDb().select().from(users).where(eq(users.email, email));
        if (dbUser && dbUser.active && (!password || verifyPassword(password, dbUser.passwordHash))) {
          await createSession(dbUser);
          return NextResponse.json({
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          });
        }
      } catch {
        // Fall back to role-based resolution
      }
    }

    // 3. Fallback based on email keywords or default to Founder
    if (email === "hr@arkadigitalmedia.in" || email === "hr@arkafinance.com" || email === "hr") {
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
