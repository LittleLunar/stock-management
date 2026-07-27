import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, "..");
const repoRoot = resolve(apiRoot, "../..");

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(repoRoot, ".env"));
loadEnvFile(resolve(apiRoot, ".env"));

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/stock_management";

const sqlPath = resolve(repoRoot, "scripts/clear-data.sql");
const body = readFileSync(sqlPath, "utf8");

const sql = postgres(databaseUrl, { max: 1 });
try {
  await sql.unsafe(body);
  console.log("Cleared all application data (schema preserved).");
} finally {
  await sql.end();
}
