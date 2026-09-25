import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { databaseConfigured } from "@/lib/database-config";
import { GoogleSheetsProvider } from "@/lib/google-sheets";
import { isEmailConfigured } from "@/lib/email-provider";
import { demoModeEnabled } from "@/lib/demo-mode";
import { operationalStore } from "@/lib/operational-store";

export async function GET() {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");

    // 1. Neon DB check
    let databaseStatus = "NOT_CONFIGURED";
    let databaseLatency = 0;
    if (databaseConfigured()) {
      try {
        const start = Date.now();
        await getDb().execute(sql`SELECT 1`);
        databaseLatency = Date.now() - start;
        databaseStatus = "CONNECTED";
      } catch {
        databaseStatus = "CONNECTION_ERROR";
      }
    }

    // 2. Google Sheets check
    const currentSheetUrl = operationalStore.getConfiguredSheetUrl() || process.env.GOOGLE_SHEET_URL || (process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : "");
    const sheetsProvider = new GoogleSheetsProvider(currentSheetUrl);
    const sheetsConnection = await sheetsProvider.testConnection();

    // 3. Email provider check
    const emailConfigured = isEmailConfigured();
    const emailProvider = process.env.EMAIL_PROVIDER || "None";

    // 4. OCR / AI provider check
    const ocrConfigured = Boolean(
      (process.env.AI_PROVIDER || process.env.OCR_PROVIDER) &&
      (process.env.AI_API_KEY || process.env.OCR_API_KEY)
    );
    const ocrProvider = process.env.AI_PROVIDER || process.env.OCR_PROVIDER || "None";

    // 5. Storage provider check
    const storageProvider = process.env.STORAGE_PROVIDER || (process.env.NODE_ENV === "production" ? "r2" : "local");
    const storageConfigured = process.env.NODE_ENV !== "production" || Boolean(process.env.STORAGE_PROVIDER === "r2");

    const summary = operationalStore.getSummaryMetrics();

    return NextResponse.json({
      environment: process.env.NODE_ENV || "development",
      demoMode: demoModeEnabled(),
      integrations: {
        database: {
          provider: "Neon PostgreSQL",
          status: databaseStatus,
          configured: databaseConfigured(),
          latencyMs: databaseLatency,
        },
        googleSheets: {
          provider: "Google Sheets API / Link Integration",
          status: sheetsConnection.state,
          message: sheetsConnection.message,
          sheetUrl: currentSheetUrl || null,
          sheetId: currentSheetUrl ? currentSheetUrl : (process.env.GOOGLE_SHEET_ID || null),
          tab: process.env.GOOGLE_SHEET_TAB || null,
          lastSync: summary.lastSync,
          loadedClients: summary.totalClients,
        },
        email: {
          provider: emailProvider,
          configured: emailConfigured,
          status: emailConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
          from: process.env.EMAIL_FROM || "billing@arka.operations",
        },
        ocr: {
          provider: ocrProvider,
          configured: ocrConfigured,
          status: ocrConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
        },
        storage: {
          provider: storageProvider,
          configured: storageConfigured,
          status: storageConfigured ? "AVAILABLE" : "CONFIGURATION_REQUIRED",
        },
      },
      systemTime: new Date().toISOString(),
      businessTimezone: "Asia/Kolkata",
    });
  } catch (error) {
    console.error("[SETTINGS_ERROR]", error);
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to read settings." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
