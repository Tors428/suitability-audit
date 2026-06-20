// Proxy audit. Joins receipts to protected attributes (kept separate from
// the engine for exactly this purpose), computes disparate-impact statistics,
// and emits an AuditReport.
//
// Method:
//   For each protected-attribute slice (age_band, zip_cluster), conditional
//   on stated risk_tolerance (a Rule 2111 factor the engine IS allowed to
//   read), we compare the distribution of recommended products' risk_levels
//   for the cohort vs. the baseline (all other cohorts pooled). We compute a
//   four-fifths-rule style ratio of the "favorable outcome rate" (got a
//   recommendation at all, OR got a recommendation matching their stated RT).
//
// A ratio below 0.80 is flagged per EEOC guidance on adverse impact (used
// here as an analog — FINRA does not prescribe a numeric threshold for
// suitability disparate impact, but the 4/5 rule is the industry default).

import type {
  Client,
  Receipt,
  Product,
  AuditReport,
  DisparityFinding,
  RiskTolerance,
  AgeBand,
  ZipCluster,
  Gender,
} from "./types";

const RT_VALUES: RiskTolerance[] = [
  "conservative",
  "moderate_conservative",
  "moderate",
  "moderate_aggressive",
  "aggressive",
];

interface Joined {
  client: Client;
  receipt: Receipt;
  product: Product | null;
}

function join(
  clients: Client[],
  receipts: Receipt[],
  products: Product[],
): Joined[] {
  const cmap = new Map(clients.map((c) => [c.id, c]));
  const pmap = new Map(products.map((p) => [p.id, p]));
  return receipts.map((r) => ({
    client: cmap.get(r.client_id)!,
    receipt: r,
    product: r.recommended_product_id ? pmap.get(r.recommended_product_id) ?? null : null,
  }));
}

function favorableOutcomeRate(rows: Joined[]): {
  rate: number;
  recommended: number;
  total: number;
  distribution: Record<string, number>;
} {
  if (rows.length === 0)
    return { rate: 0, recommended: 0, total: 0, distribution: {} };
  const recommended = rows.filter((r) => r.product !== null).length;
  const dist: Record<string, number> = { none: 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const r of rows) {
    if (r.product === null) dist["none"]++;
    else dist[String(r.product.risk_level)]++;
  }
  for (const k of Object.keys(dist)) dist[k] = dist[k] / rows.length;
  return { rate: recommended / rows.length, recommended, total: rows.length, distribution: dist };
}

function severityFor(ratio: number, n: number): "low" | "medium" | "high" {
  if (n < 50) return "low";
  if (ratio < 0.6) return "high";
  if (ratio < 0.8) return "medium";
  return "low";
}

function analyzeSlice<K extends string>(
  attribute: "age_band" | "zip_cluster" | "gender",
  cohortKey: K,
  cohortRows: Joined[],
  baselineRows: Joined[],
  stated_rt: RiskTolerance,
): DisparityFinding | null {
  if (cohortRows.length < 20) return null;
  const cohort = favorableOutcomeRate(cohortRows);
  const baseline = favorableOutcomeRate(baselineRows);
  const ratio = baseline.rate === 0 ? 1 : cohort.rate / baseline.rate;
  const severity = severityFor(ratio, cohort.total);
  if (severity === "low") return null;

  return {
    protected_attribute: attribute,
    cohort: cohortKey,
    stated_risk_tolerance: stated_rt,
    cohort_recommendation_distribution: cohort.distribution,
    baseline_recommendation_distribution: baseline.distribution,
    selection_rate_ratio: Math.round(ratio * 1000) / 1000,
    n_cohort: cohort.total,
    n_baseline: baseline.total,
    severity,
    rationale:
      `Conditional on stated risk tolerance "${stated_rt}", clients in cohort ` +
      `${attribute}=${cohortKey} received a suitable recommendation at ` +
      `${(cohort.rate * 100).toFixed(1)}% vs ${(baseline.rate * 100).toFixed(1)}% ` +
      `for the rest of the population (selection-rate ratio ${ratio.toFixed(2)}, ` +
      `below the four-fifths threshold of 0.80).`,
  };
}

export function audit(
  clients: Client[],
  receipts: Receipt[],
  products: Product[],
): AuditReport {
  const rows = join(clients, receipts, products);
  const findings: DisparityFinding[] = [];

  const age_bands: AgeBand[] = ["under_45", "45_to_64", "65_plus"];
  const zip_clusters: ZipCluster[] = ["a", "b", "c", "d"];
  const genders: Gender[] = ["f", "m", "nb"];

  for (const rt of RT_VALUES) {
    const rt_rows = rows.filter((r) => r.client.factors.risk_tolerance === rt);

    for (const band of age_bands) {
      const cohort = rt_rows.filter((r) => r.client.protected.age_band === band);
      const baseline = rt_rows.filter((r) => r.client.protected.age_band !== band);
      const f = analyzeSlice("age_band", band, cohort, baseline, rt);
      if (f) findings.push(f);
    }
    for (const zip of zip_clusters) {
      const cohort = rt_rows.filter((r) => r.client.protected.zip_cluster === zip);
      const baseline = rt_rows.filter((r) => r.client.protected.zip_cluster !== zip);
      const f = analyzeSlice("zip_cluster", zip, cohort, baseline, rt);
      if (f) findings.push(f);
    }
    for (const g of genders) {
      const cohort = rt_rows.filter((r) => r.client.protected.gender === g);
      const baseline = rt_rows.filter((r) => r.client.protected.gender !== g);
      const f = analyzeSlice("gender", g, cohort, baseline, rt);
      if (f) findings.push(f);
    }
  }

  findings.sort((a, b) => a.selection_rate_ratio - b.selection_rate_ratio);

  const high_sev = findings.filter((f) => f.severity === "high").length;
  const med_sev = findings.filter((f) => f.severity === "medium").length;
  const headline =
    findings.length === 0
      ? "No disparate-impact patterns detected above the four-fifths threshold."
      : `${findings.length} disparate-impact ${findings.length === 1 ? "pattern" : "patterns"} ` +
        `detected (${high_sev} high-severity, ${med_sev} medium-severity).`;

  return {
    generated_at: new Date(0).toISOString(),
    n_clients: clients.length,
    n_receipts: receipts.length,
    findings,
    headline,
  };
}
