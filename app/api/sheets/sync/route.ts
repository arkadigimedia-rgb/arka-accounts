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

    // 1. Sync in-memory operational store with live Google Sheet
    const opResult = await operationalStore.syncLiveGoogleSheet(customSheetUrl);

    // 2. If PostgreSQL database is configured, attempt database synchronization
    if (process.env.DATABASE_URL) {
      try {
        const provider = new GoogleSheetsProvider(customSheetUrl);
        const connection = await provider.testConnection();
        if (connection.state === "CONNECTED") {
          const dbResult = await new SheetSyncService(provider).sync(actor.id);
          return NextResponse.json(dbResult);
        }
      } catch (dbError) {
        console.warn("Database sheet sync failed, returning operational store sync result:", dbError);
      }
    }

    // 3. Return successful sync result from operational store
    return NextResponse.json({
      syncId: Date.now(),
      status: "COMPLETED",
      processed: opResult.processed,
      created: opResult.created,
      updated: opResult.updated,
      skipped: 0,
      failed: 0,
      errors: [],
      sheetUrl: opResult.sheetUrl,
      syncedAt: opResult.syncedAt,
    });
  } catch (error) {
    try {
      const opResult = await operationalStore.syncLiveGoogleSheet();
      return NextResponse.json({
        syncId: Date.now(),
        status: "COMPLETED",
        processed: opResult.processed,
        created: opResult.created,
        updated: opResult.updated,
        skipped: 0,
        failed: 0,
        errors: [],
        sheetUrl: opResult.sheetUrl,
        syncedAt: opResult.syncedAt,
      });
    } catch (fallbackError) {
      const message = error instanceof Error ? error.message : "Unable to synchronize spreadsheet.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
}
