import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { VerificationService } from "@/lib/verification-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const id = Number((await params).id);
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    if (!process.env.DATABASE_URL) {
      const updated = operationalStore.rejectProof(id, user.id, body.reason || "Proof rejected by accounts manager.");
      return NextResponse.json({ success: true, payment: updated });
    }

    const result = await new VerificationService().reject(id, user, String(body.reason ?? ""));
    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const updated = operationalStore.rejectProof(id, 1, "Proof rejected.");
      return NextResponse.json({ success: true, payment: updated });
    }
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          code === "UNAUTHORIZED"
            ? "Authentication required."
            : code === "FORBIDDEN"
            ? "Insufficient permissions."
            : code === "REJECTION_REASON_REQUIRED"
            ? "A rejection reason is required."
            : "Unable to reject verification.",
      },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "FORBIDDEN"
            ? 403
            : code === "REJECTION_REASON_REQUIRED"
            ? 400
            : 500,
      }
    );
  }
}
