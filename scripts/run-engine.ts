// Run the suitability engine over every synthetic client and write receipts.
// Output: data/receipts.json
//
// Run with: npx tsx scripts/run-engine.ts

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client, Product, Receipt } from "../lib/types";
import { recommend } from "../lib/engine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const clients: Client[] = JSON.parse(
  readFileSync(resolve(__dirname, "..", "data", "clients.json"), "utf-8"),
);
const products: Product[] = JSON.parse(
  readFileSync(resolve(__dirname, "..", "data", "products.json"), "utf-8"),
);

const receipts: Receipt[] = clients.map((c) => recommend(c, products));

writeFileSync(
  resolve(__dirname, "..", "data", "receipts.json"),
  JSON.stringify(receipts, null, 2),
);

// Quick distribution print.
const by_product = receipts.reduce<Record<string, number>>((acc, r) => {
  const k = r.recommended_product_id ?? "NONE";
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${receipts.length} receipts.`);
console.log("\nRecommendation distribution:");
for (const [k, v] of Object.entries(by_product).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(10)} ${v}`);
}

const no_match = receipts.filter((r) => r.recommended_product_id === null).length;
const cf_changes = receipts.filter((r) => r.counterfactual.alt_product_id !== null)
  .length;
console.log(`\nNo-match receipts: ${no_match}`);
console.log(`Receipts with counterfactual flip: ${cf_changes}`);
