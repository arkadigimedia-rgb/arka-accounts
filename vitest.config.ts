import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({test:{environment:"node",include:["tests/**/*.test.ts"]},resolve:{alias:{"@":path.resolve(__dirname,"."),"cloudflare:workers":path.resolve(__dirname,"tests/fakes/cloudflare-workers.ts")}}});
