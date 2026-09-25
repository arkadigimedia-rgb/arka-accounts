import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { VerificationService } from "@/lib/verification-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const id = Number((await params).id);

    if (!process.env.DATABASE_URL) {
      const updated = operationalStore.approvePayment(id, user.id);
      return NextResponse.json({ success: true, payment: updated });
    }

    const result = await new VerificationService().approve(id, user);
    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const updated = operationalStore.approvePayment(id, 1);
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
            : code === "VERIFICATION_NOT_APPROVABLE"
            ? "Only a matched or reviewed verification can be approved."
            : code === "VERIFICATION_NOT_FOUND"
            ? "Verification record not found."
            : "Unable to approve verification.",
      },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "FORBIDDEN"
            ? 403
            : code === "VERIFICATION_NOT_APPROVABLE"
            ? 409
            : code === "VERIFICATION_NOT_FOUND"
            ? 404
            : 500,
      }
    );
  }
}
