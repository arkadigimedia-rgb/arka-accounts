import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";
const cli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));

console.log(`[ARKA] Launching production server on ${host}:${port}...`);

const child = spawn(process.execPath, [cli, "start", "-p", port, "-H", host], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
