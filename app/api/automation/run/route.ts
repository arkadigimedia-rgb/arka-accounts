import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { automationEngine, type JobType } from "@/lib/automation-engine";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";

export async function POST(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const body = (await request.json().catch(() => ({}))) as { jobType?: JobType };

    if (body.jobType) {
      const summary = await automationEngine.executeJob(body.jobType);
      return NextResponse.json(summary);
    }

    const summaries = await automationEngine.runDailyWorkflow();
    return NextResponse.json({ dailyWorkflow: summaries });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "Automation execution failed.";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : msg },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function GET() {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const jobs = await automationEngine.listRecentJobs(30);
    return NextResponse.json(jobs);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "Unable to load jobs.";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : msg },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
