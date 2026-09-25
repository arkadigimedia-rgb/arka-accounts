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
      const updated = operationalStore.requestReupload(id, user.id, body.reason || "Please re-upload a clear receipt.");
      return NextResponse.json({ success: true, payment: updated });
    }

    const result = await new VerificationService().requestReupload(
      id,
      user,
      String(body.reason ?? "")
    );
    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const updated = operationalStore.requestReupload(id, 1, "Please re-upload proof.");
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
            : code === "REUPLOAD_REASON_REQUIRED"
            ? "A re-upload reason is required."
            : "Unable to request a new proof.",
      },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "FORBIDDEN"
            ? 403
            : code === "REUPLOAD_REASON_REQUIRED"
            ? 400
            : 500,
      }
    );
  }
}
