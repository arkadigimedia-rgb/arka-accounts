import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { operationalStore } from "@/lib/operational-store";

export async function POST(request: Request) {
  try {
    if (operationalStore.getClients().length === 0) {
      try {
        await operationalStore.syncLiveGoogleSheet();
      } catch (e) {
        console.error("Auto-sync error on empty store:", e);
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let rows: Array<Record<string, any>> = [];

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as any;
      rows = Array.isArray(body?.rows) ? body.rows : [];
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No Excel or CSV file uploaded." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "The uploaded file does not contain any data rows." }, { status: 400 });
    }

    const summary = operationalStore.importBillingRows(rows);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${summary.processed} row(s): updated ${summary.updated} existing schedule(s), created ${summary.created} new record(s).`,
      summary,
    });
  } catch (error) {
    console.error("Error importing billing Excel:", error);
    const msg = error instanceof Error ? error.message : "Failed to import billing spreadsheet";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Generate sample Excel template for billing cycle changes
    const sampleData = [
      {
        "Client Name": "Acme Media Corp",
        "Billing Cycle": "Monthly",
        "Amount Payable": 50000,
        "Invoice Date": "2026-10-01",
        "Invoice Due Date": "2026-10-07",
        "Product/Service": "Digital Marketing Service / Google and Meta Ads",
        "Phone": "+91 98765 43210",
      },
      {
        "Client Name": "Apex Retail Pvt Ltd",
        "Billing Cycle": "Quarterly",
        "Amount Payable": 120000,
        "Invoice Date": "2026-10-01",
        "Invoice Due Date": "2026-10-10",
        "Product/Service": "Digital Marketing Service / Google and Meta Ads",
        "Phone": "+91 91234 56789",
      },
      {
        "Client Name": "Zenith Studios",
        "Billing Cycle": "Monthly",
        "Amount Payable": 35000,
        "Invoice Date": "2026-10-05",
        "Invoice Due Date": "2026-10-12",
        "Product/Service": "Digital Marketing Service / Google and Meta Ads",
        "Phone": "+91 99887 76655",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Billing Schedules");

    // Adjust column widths
    worksheet["!cols"] = [
      { wch: 25 }, // Client Name
      { wch: 15 }, // Billing Cycle
      { wch: 18 }, // Amount Payable
      { wch: 15 }, // Invoice Date
      { wch: 18 }, // Invoice Due Date
      { wch: 45 }, // Product/Service
      { wch: 18 }, // Phone
    ];

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Billing_Cycle_Change_Template.xlsx"',
      },
    });
  } catch (error) {
    console.error("Error generating billing template:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
