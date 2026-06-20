// Shared display label maps. Centralised so the dashboard, receipts list,
// and detail page all read the same.

export const COHORT_LABEL: Record<string, string> = {
  age_band: "Age band",
  zip_cluster: "ZIP cluster",
  gender: "Gender",
};

export const COHORT_VALUE_LABEL: Record<string, string> = {
  under_45: "Under 45",
  "45_to_64": "45 to 64",
  "65_plus": "65 and over",
  a: "Cluster A",
  b: "Cluster B",
  c: "Cluster C",
  d: "Cluster D",
  f: "Female",
  m: "Male",
  nb: "Non-binary",
};

export const RT_LABEL: Record<string, string> = {
  conservative: "Conservative",
  moderate_conservative: "Moderately conservative",
  moderate: "Moderate",
  moderate_aggressive: "Moderately aggressive",
  aggressive: "Aggressive",
};

export const OBJECTIVE_LABEL: Record<string, string> = {
  capital_preservation: "Capital preservation",
  income: "Income",
  growth_and_income: "Growth and income",
  growth: "Growth",
  speculation: "Speculation",
};

export const EXPERIENCE_LABEL: Record<string, string> = {
  none: "None",
  limited: "Limited",
  good: "Good",
  extensive: "Extensive",
};

export const TAX_STATUS_LABEL: Record<string, string> = {
  low: "Low",
  mid: "Mid",
  high: "High",
};

export function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}
