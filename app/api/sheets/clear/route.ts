import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { operationalStore } from "@/lib/operational-store";

export async function POST() {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    operationalStore.clearAllData();
    return NextResponse.json({
      success: true,
      message: "All operational data cleared successfully. System is now empty and awaiting Google Sheets synchronization.",
      clearedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to clear data.";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Authentication required." : "Insufficient permissions." },
      { status: message === "UNAUTHORIZED" ? 401 : 403 }
    );
  }
}
