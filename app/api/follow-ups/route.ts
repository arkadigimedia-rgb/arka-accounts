import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { followUpService } from "@/lib/follow-up-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId") ? Number(searchParams.get("paymentId")) : undefined;
    const status = searchParams.get("status") || undefined;
    const dueBefore = searchParams.get("dueBefore") || undefined;

    if (!process.env.DATABASE_URL) {
      const list = operationalStore.getFollowUps();
      let filtered = list;
      if (paymentId) filtered = filtered.filter((f) => f.paymentId === paymentId);
      if (status) filtered = filtered.filter((f) => f.status === status);
      return NextResponse.json(filtered);
    }

    const list = await followUpService.listFollowUps({ paymentId, status, dueBefore });
    return NextResponse.json(list);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return NextResponse.json(operationalStore.getFollowUps());
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load follow-ups." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const body = (await request.json()) as {
      paymentId: number;
      action: string;
      notes?: string;
      followUpDate: string;
    };

    if (!body.paymentId || !body.action || !body.followUpDate) {
      return NextResponse.json({ error: "paymentId, action, and followUpDate are required." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          id: Date.now(),
          paymentId: body.paymentId,
          clientId: 1,
          clientName: "Follow-up Client",
          channel: "PHONE",
          notes: body.notes || body.action,
          scheduledAt: body.followUpDate,
          completedAt: null,
          status: "PENDING",
          collector: user.name,
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      );
    }

    const created = await followUpService.createFollowUp({
      paymentId: body.paymentId,
      userId: user.id,
      action: body.action,
      notes: body.notes,
      followUpDate: body.followUpDate,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to create follow-up." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const body = (await request.json()) as {
      id: number;
      status: "COMPLETED" | "CANCELLED";
      notes?: string;
    };

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "id and status are required." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ id: body.id, status: body.status, completedAt: new Date().toISOString() });
    }

    const updated = await followUpService.completeFollowUp(body.id, user.id);

    return NextResponse.json(updated);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to update follow-up." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
