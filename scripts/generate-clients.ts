// Generate N synthetic clients with documented bias seeds.
// Output: data/clients.json
//
// Run with: npx tsx scripts/generate-clients.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import seedrandom from "seedrandom";
import type {
  Client,
  ClientFactors,
  ProtectedAttributes,
  RiskTolerance,
  InvestmentObjective,
  Experience,
  TaxStatus,
  AgeBand,
  ZipCluster,
  Gender,
} from "../lib/types";
import { SEED_CONFIG } from "../lib/bias-seeds";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N_CLIENTS = 5000;
const RNG_SEED = "suitability-audit-v1";

const rng = seedrandom(RNG_SEED);

function pick<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickWeighted<T>(pairs: Array<[T, number]>): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

function uniformInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function normal(mean: number, sd: number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function ageToBand(age: number): AgeBand {
  if (age < 45) return "under_45";
  if (age < 65) return "45_to_64";
  return "65_plus";
}

function generateOne(idx: number): Client {
  // Demographics.
  const age = Math.max(25, Math.min(85, Math.round(normal(52, 14))));
  const age_band = ageToBand(age);
  const zip_cluster: ZipCluster = pickWeighted([
    ["a", 0.3],
    ["b", 0.3],
    ["c", 0.25],
    ["d", 0.15],
  ]);
  const gender: Gender = pickWeighted([
    ["f", 0.49],
    ["m", 0.49],
    ["nb", 0.02],
  ]);

  // Baseline financials.
  const income_mean = 70000 + (age - 25) * 1500;
  const annual_income_usd = Math.max(
    25000,
    Math.round(normal(income_mean, 35000)),
  );
  const net_worth_mean = annual_income_usd * (age > 45 ? 6 : 3);
  const net_worth_usd = Math.max(
    5000,
    Math.round(normal(net_worth_mean, net_worth_mean * 0.5)),
  );
  const liquid_assets_usd = Math.max(
    1000,
    Math.round(net_worth_usd * (0.15 + rng() * 0.35)),
  );

  const tax_status: TaxStatus =
    annual_income_usd > 200000 ? "high" : annual_income_usd > 90000 ? "mid" : "low";

  // Risk tolerance — older clients skew slightly more conservative.
  const rt_weights: Array<[RiskTolerance, number]> = age >= 65
    ? [
        ["conservative", 0.35],
        ["moderate_conservative", 0.3],
        ["moderate", 0.2],
        ["moderate_aggressive", 0.1],
        ["aggressive", 0.05],
      ]
    : age >= 45
    ? [
        ["conservative", 0.15],
        ["moderate_conservative", 0.25],
        ["moderate", 0.3],
        ["moderate_aggressive", 0.2],
        ["aggressive", 0.1],
      ]
    : [
        ["conservative", 0.08],
        ["moderate_conservative", 0.15],
        ["moderate", 0.3],
        ["moderate_aggressive", 0.27],
        ["aggressive", 0.2],
      ];
  const risk_tolerance = pickWeighted(rt_weights);

  // Investment objective — loosely aligned to RT.
  const objective_weights_by_rt: Record<
    RiskTolerance,
    Array<[InvestmentObjective, number]>
  > = {
    conservative: [
      ["capital_preservation", 0.5],
      ["income", 0.4],
      ["growth_and_income", 0.1],
      ["growth", 0],
      ["speculation", 0],
    ],
    moderate_conservative: [
      ["capital_preservation", 0.2],
      ["income", 0.35],
      ["growth_and_income", 0.35],
      ["growth", 0.1],
      ["speculation", 0],
    ],
    moderate: [
      ["capital_preservation", 0.05],
      ["income", 0.2],
      ["growth_and_income", 0.4],
      ["growth", 0.3],
      ["speculation", 0.05],
    ],
    moderate_aggressive: [
      ["capital_preservation", 0],
      ["income", 0.05],
      ["growth_and_income", 0.2],
      ["growth", 0.55],
      ["speculation", 0.2],
    ],
    aggressive: [
      ["capital_preservation", 0],
      ["income", 0],
      ["growth_and_income", 0.1],
      ["growth", 0.5],
      ["speculation", 0.4],
    ],
  };
  const objective_weights = objective_weights_by_rt[risk_tolerance];
  const investment_objective = pickWeighted(objective_weights);

  // Baseline experience.
  const exp_weights: Array<[Experience, number]> = [
    ["none", 0.2],
    ["limited", 0.35],
    ["good", 0.3],
    ["extensive", 0.15],
  ];
  let investment_experience = pickWeighted(exp_weights);

  // Baseline time horizon (years) — anchored on age + objective.
  const default_horizon = Math.max(
    1,
    Math.round((80 - age) * (investment_objective === "growth" ? 0.7 : 0.5)),
  );
  let time_horizon_years = Math.max(1, Math.round(normal(default_horizon, 3)));

  // Liquidity need = years from now before client expects to need PRINCIPAL.
  // Higher for income/capital-preservation objectives (retirees living off
  // yield don't need principal liquidity), lower for growth/speculation.
  const liquidity_base = {
    capital_preservation: 7,
    income: 8,
    growth_and_income: 5,
    growth: 4,
    speculation: 2,
  }[investment_objective];
  const liquidity_need_within_years = Math.max(
    0,
    Math.min(time_horizon_years, Math.round(normal(liquidity_base, 2))),
  );

  // Baseline VA holdings.
  let existing_va_holdings_usd = rng() < 0.08 ? Math.round(net_worth_usd * 0.2) : 0;

  // ---- BIAS SEED 1: AGE proxy ----
  const seed_tags: string[] = [];
  if (age_band === "65_plus") {
    if (rng() < SEED_CONFIG.age_senior_no_experience_rate) {
      investment_experience = "none";
      seed_tags.push("age_senior_no_experience");
    }
    if (rng() < SEED_CONFIG.age_senior_vahold_rate) {
      existing_va_holdings_usd = Math.round(net_worth_usd * (0.15 + rng() * 0.2));
      seed_tags.push("age_senior_prior_va");
    }
  }

  // ---- BIAS SEED 2: ZIP proxy ----
  if (
    zip_cluster === "d" &&
    (investment_objective === "growth" ||
      investment_objective === "growth_and_income") &&
    rng() < SEED_CONFIG.zip_d_short_horizon_rate
  ) {
    time_horizon_years = Math.min(
      time_horizon_years,
      SEED_CONFIG.zip_d_short_horizon_max_years,
    );
    seed_tags.push("zip_d_truncated_horizon");
  }

  const factors: ClientFactors = {
    age,
    annual_income_usd,
    net_worth_usd,
    liquid_assets_usd,
    tax_status,
    investment_objective,
    investment_experience,
    time_horizon_years,
    liquidity_need_within_years,
    risk_tolerance,
    existing_va_holdings_usd,
    in_tax_advantaged_account: rng() < 0.35,
  };

  const protectedAttrs: ProtectedAttributes = {
    age_band,
    zip_cluster,
    gender,
  };

  return {
    id: `C${String(idx + 1).padStart(5, "0")}`,
    factors,
    protected: protectedAttrs,
    seed_tag: seed_tags.length > 0 ? seed_tags.join("+") : null,
  };
}

function main() {
  const clients: Client[] = [];
  for (let i = 0; i < N_CLIENTS; i++) {
    clients.push(generateOne(i));
  }

  const outDir = resolve(__dirname, "..", "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "clients.json");
  writeFileSync(outPath, JSON.stringify(clients, null, 2));

  // Quick distribution print so we can sanity-check.
  const tag_counts = clients.reduce<Record<string, number>>((acc, c) => {
    const k = c.seed_tag ?? "baseline";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${clients.length} clients to ${outPath}`);
  console.log("Seed-tag distribution:");
  for (const [k, v] of Object.entries(tag_counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(40)} ${v}`);
  }

  const by_age_band = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.protected.age_band] = (acc[c.protected.age_band] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\nBy age band:");
  for (const [k, v] of Object.entries(by_age_band)) {
    console.log(`  ${k.padEnd(15)} ${v}`);
  }

  const by_zip = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.protected.zip_cluster] = (acc[c.protected.zip_cluster] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\nBy ZIP cluster:");
  for (const [k, v] of Object.entries(by_zip)) {
    console.log(`  ${k.padEnd(15)} ${v}`);
  }
}

main();
