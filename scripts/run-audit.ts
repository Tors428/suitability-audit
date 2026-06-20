// Run the proxy audit. Output: data/audit.json
// Run with: npx tsx scripts/run-audit.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client, Product, Receipt } from "../lib/types";
import { audit } from "../lib/audit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const clients: Client[] = JSON.parse(
  readFileSync(resolve(__dirname, "..", "data", "clients.json"), "utf-8"),
);
const products: Product[] = JSON.parse(
  readFileSync(resolve(__dirname, "..", "data", "products.json"), "utf-8"),
);
const receipts: Receipt[] = JSON.parse(
  readFileSync(resolve(__dirname, "..", "data", "receipts.json"), "utf-8"),
);

const report = audit(clients, receipts, products);

writeFileSync(
  resolve(__dirname, "..", "data", "audit.json"),
  JSON.stringify(report, null, 2),
);

console.log(report.headline);
console.log(`\n${report.findings.length} findings:\n`);
for (const f of report.findings) {
  console.log(
    `[${f.severity.toUpperCase().padEnd(6)}] ${f.protected_attribute}=${f.cohort.padEnd(10)} ` +
      `| RT=${f.stated_risk_tolerance.padEnd(22)} | ratio=${f.selection_rate_ratio.toFixed(2)} ` +
      `| n=${f.n_cohort}`,
  );
}
