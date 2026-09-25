import { NextResponse } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, clients, payments, services } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase();
    const status = searchParams.get("status");

    if (!process.env.DATABASE_URL) {
      const rows = operationalStore.getClients({ search: search ?? undefined, status: status ?? undefined });
      return NextResponse.json(rows);
    }

    const db = getDb();
    const rows = await db
      .select({
        id: clients.id,
        clientCode: clients.clientCode,
        name: clients.name,
        companyName: clients.companyName,
        contactPerson: clients.contactPerson,
        email: clients.email,
        phone: clients.phone,
        city: clients.city,
        state: clients.state,
        gstNumber: clients.gstNumber,
        status: clients.status,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(status ? eq(clients.status, status) : undefined)
      .orderBy(desc(clients.id));

    let filtered = rows;
    if (search) {
      filtered = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.companyName && c.companyName.toLowerCase().includes(search)) ||
          (c.clientCode && c.clientCode.toLowerCase().includes(search)) ||
          (c.email && c.email.toLowerCase().includes(search))
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search")?.toLowerCase();
      const status = searchParams.get("status");
      return NextResponse.json(operationalStore.getClients({ search: search ?? undefined, status: status ?? undefined }));
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to list clients." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const body = (await request.json()) as {
      clientCode?: string;
      name: string;
      companyName?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      gstNumber?: string;
    };

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      const created = operationalStore.createClient(body);
      return NextResponse.json(created, { status: 201 });
    }

    const db = getDb();
    const [client] = await db
      .insert(clients)
      .values({
        clientCode: body.clientCode || null,
        name: body.name.trim(),
        companyName: body.companyName || null,
        contactPerson: body.contactPerson || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        gstNumber: body.gstNumber || null,
        status: "ACTIVE",
        accountOwnerId: user.id,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      entityType: "client",
      entityId: String(client.id),
      action: "CLIENT_CREATED",
      newValue: JSON.stringify({ name: client.name, email: client.email }),
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const body = (await request.json().catch(() => ({}))) as any;
      if (body?.name) {
        return NextResponse.json(operationalStore.createClient(body), { status: 201 });
      }
      return databaseNotConfiguredResponse();
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to create client." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
