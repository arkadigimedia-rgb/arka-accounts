import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { GoogleSheetsProvider } from "@/lib/google-sheets";
import { SheetSyncService } from "@/lib/sheet-sync";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");

    let customSheetUrl: string | undefined;
    try {
      const body = (await request.json()) as any;
      customSheetUrl = body?.sheetUrl || body?.spreadsheetId;
    } catch {
      // Body is optional
    }

    if (!process.env.DATABASE_URL) {
      const result = await operationalStore.syncLiveGoogleSheet(customSheetUrl);
      return NextResponse.json({
        syncId: Date.now(),
        status: "COMPLETED",
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: 0,
        failed: 0,
        errors: [],
        sheetUrl: result.sheetUrl,
        syncedAt: result.syncedAt,
      });
    }

    const provider = new GoogleSheetsProvider(customSheetUrl);
    const connection = await provider.testConnection();
    if (connection.state !== "CONNECTED") {
      return NextResponse.json({ code: "CONFIGURATION_REQUIRED", connection }, { status: 503 });
    }
    return NextResponse.json(await new SheetSyncService(provider).sync(actor.id));
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const result = await operationalStore.syncLiveGoogleSheet();
      return NextResponse.json({
        syncId: Date.now(),
        status: "COMPLETED",
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: 0,
        failed: 0,
        errors: [],
        sheetUrl: result.sheetUrl,
        syncedAt: result.syncedAt,
      });
    }
    const message = error instanceof Error ? error.message : "Unable to synchronize spreadsheet.";
    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "Authentication required." : message === "FORBIDDEN" ? "Insufficient permissions." : "Unable to synchronize spreadsheet." },
      { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
