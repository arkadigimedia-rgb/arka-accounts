import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { ReminderService } from "@/lib/reminder-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const id = Number((await params).id);
    const service = new ReminderService();
    const result = await service.retryReminder(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    if (msg === "REMINDER_NOT_FOUND") return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    if (msg === "ONLY_FAILED_REMINDERS_RETRIABLE") {
      return NextResponse.json({ error: "Only failed reminders can be retried." }, { status: 409 });
    }
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to retry reminder." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
