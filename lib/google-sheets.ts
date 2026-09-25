export type SheetConnection = {
  state: "NOT_CONFIGURED" | "CONNECTED" | "CONNECTION_ERROR" | "ACCESS_DENIED";
  message: string;
};

export interface SheetProvider {
  testConnection(): Promise<SheetConnection>;
  getRows(): Promise<Record<string, string>[]>;
}

export function extractSheetId(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return trimmed;
}

function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

export class GoogleSheetsProvider implements SheetProvider {
  constructor(private readonly customSheetIdOrUrl?: string) {}

  private getSheetId(): string | null {
    return extractSheetId(
      this.customSheetIdOrUrl || process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_URL
    );
  }

  private hasServiceAccount(): boolean {
    return !!(
      this.getSheetId() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    );
  }

  private async client() {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    return google.sheets({ version: "v4", auth });
  }

  async testConnection(): Promise<SheetConnection> {
    const sheetId = this.getSheetId();
    if (!sheetId) {
      return {
        state: "NOT_CONFIGURED",
        message: "GOOGLE_SHEET_ID or Google Sheet URL is not configured.",
      };
    }

    if (this.hasServiceAccount()) {
      try {
        const client = await this.client();
        await client.spreadsheets.get({ spreadsheetId: sheetId });
        return { state: "CONNECTED", message: "Spreadsheet access confirmed via Google Service Account." };
      } catch (error) {
        const status = (error as { code?: number }).code;
        return {
          state: status === 403 ? "ACCESS_DENIED" : "CONNECTION_ERROR",
          message:
            status === 403
              ? "Service account cannot access the spreadsheet."
              : "Google Sheets connection failed.",
        };
      }
    }

    // Direct export fallback for link-shared spreadsheets
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`, {
        method: "HEAD",
        headers: { "User-Agent": "ARKA-Finance-Operations/1.0" },
      });
      if (res.ok) {
        return { state: "CONNECTED", message: "Spreadsheet access confirmed via Google Sheets link." };
      }
      if (res.status === 403 || res.status === 401) {
        return {
          state: "ACCESS_DENIED",
          message: "Spreadsheet requires permissions. Set sharing to 'Anyone with the link can view' or provide service account credentials.",
        };
      }
      return { state: "CONNECTION_ERROR", message: `Google Sheets returned HTTP ${res.status}.` };
    } catch {
      return { state: "CONNECTION_ERROR", message: "Unable to reach Google Sheets." };
    }
  }

  async getRows(): Promise<Record<string, string>[]> {
    const sheetId = this.getSheetId();
    if (!sheetId) throw new Error("NOT_CONFIGURED");

    if (this.hasServiceAccount()) {
      const check = await this.testConnection();
      if (check.state !== "CONNECTED") throw new Error(check.state);

      const range = [process.env.GOOGLE_SHEET_TAB, process.env.GOOGLE_SHEET_RANGE].filter(Boolean).join("!");
      const client = await this.client();
      const values =
        (
          await client.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range,
          })
        ).data.values ?? [];
      const [headers, ...rows] = values;
      if (!headers) return [];
      return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? "")])));
    }

    // Direct fetch via CSV export
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`, {
      headers: { "User-Agent": "ARKA-Finance-Operations/1.0" },
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) throw new Error("ACCESS_DENIED");
      throw new Error("CONNECTION_ERROR");
    }
    const text = await res.text();
    return parseCsv(text);
  }
}
