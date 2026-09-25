import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { actionIntelligence } from "@/lib/action-intelligence";
import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const q = new URL(request.url).searchParams;

  if (demoModeEnabled()) {
    const actions = actionIntelligence
      .actions(demoPayments().map((p) => ({ ...p, email: "demo@example.test" })))
      .filter((a) => !q.get("client") || a.client.toLowerCase().includes(q.get("client")!.toLowerCase()));
    return NextResponse.json({ actions: actions.slice(0, Number(q.get("limit") ?? 50)) });
  }

  if (!process.env.DATABASE_URL) {
    const rows = operationalStore.getPayments().map((p) => ({
      id: p.id,
      client: p.client,
      service: p.service,
      expectedAmount: p.expectedAmount,
      dueDate: p.dueDate,
      status: p.status,
    }));
    return NextResponse.json({ actions: actionIntelligence.actions(rows).slice(0, Number(q.get("limit") ?? 50)) });
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const rows = await getDb()
      .select({
        id: payments.id,
        client: payments.client,
        service: payments.service,
        expectedAmount: payments.expectedAmount,
        dueDate: payments.dueDate,
        status: payments.status,
      })
      .from(payments);

    if (rows.length > 0) {
      return NextResponse.json({ actions: actionIntelligence.actions(rows).slice(0, Number(q.get("limit") ?? 50)) });
    }

    const storeRows = operationalStore.getPayments().map((p) => ({
      id: p.id,
      client: p.client,
      service: p.service,
      expectedAmount: p.expectedAmount,
      dueDate: p.dueDate,
      status: p.status,
    }));
    return NextResponse.json({ actions: actionIntelligence.actions(storeRows).slice(0, Number(q.get("limit") ?? 50)) });
  } catch (error) {
    const rows = operationalStore.getPayments().map((p) => ({
      id: p.id,
      client: p.client,
      service: p.service,
      expectedAmount: p.expectedAmount,
      dueDate: p.dueDate,
      status: p.status,
    }));
    return NextResponse.json({ actions: actionIntelligence.actions(rows).slice(0, 50) });
  }
}
