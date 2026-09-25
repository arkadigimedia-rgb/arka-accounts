import type { SheetConnection, SheetProvider } from "@/lib/google-sheets";

/** Test-only provider. Production routes always construct GoogleSheetsProvider. */
export class StaticSheetProvider implements SheetProvider {
  constructor(private readonly rows: Record<string,string>[]) {}
  async testConnection():Promise<SheetConnection> { return {state:"CONNECTED",message:"Test provider connected."}; }
  async getRows():Promise<Record<string,string>[]> { return this.rows; }
}
