// Domain types for the Suitability Audit demo.
//
// Reference: FINRA Rule 2111 (Suitability) customer-specific factors and
// FINRA Rule 2330 (Members' Responsibilities Regarding Deferred Variable
// Annuities). These types model the inputs the engine actually consults and
// the protected attributes the engine MUST NOT consult — the audit consults
// them separately to test for disparate impact.

export type RiskTolerance =
  | "conservative"
  | "moderate_conservative"
  | "moderate"
  | "moderate_aggressive"
  | "aggressive";

export type InvestmentObjective =
  | "capital_preservation"
  | "income"
  | "growth_and_income"
  | "growth"
  | "speculation";

export type Experience = "none" | "limited" | "good" | "extensive";

export type TaxStatus = "low" | "mid" | "high";

export type ProductType = "variable_annuity" | "mutual_fund";

// ---------- Engine-visible client factors (Rule 2111) ----------

export interface ClientFactors {
  age: number;
  annual_income_usd: number;
  net_worth_usd: number;
  liquid_assets_usd: number;
  tax_status: TaxStatus;
  investment_objective: InvestmentObjective;
  investment_experience: Experience;
  time_horizon_years: number;
  liquidity_need_within_years: number; // when client expects to need funds
  risk_tolerance: RiskTolerance;
  existing_va_holdings_usd: number; // for 2330 concentration check
  in_tax_advantaged_account: boolean; // IRA / 401k — VAs make less sense here
}

// ---------- Protected attributes — engine MUST NOT see these ----------

export type AgeBand = "under_45" | "45_to_64" | "65_plus";
export type ZipCluster = "a" | "b" | "c" | "d";
export type Gender = "m" | "f" | "nb";

export interface ProtectedAttributes {
  age_band: AgeBand;
  zip_cluster: ZipCluster;
  gender: Gender;
}

// ---------- Client ----------

export interface Client {
  id: string;
  factors: ClientFactors;
  // Held separately so it's obvious the engine doesn't get them.
  // Audit code joins on id.
  protected: ProtectedAttributes;
  // Documented bias seed contribution, for transparency in the README.
  // null = unbiased baseline draw.
  seed_tag: string | null;
}

// ---------- Product master ----------

export interface ProductRequirements {
  min_age: number;
  max_age: number | null;
  min_time_horizon_years: number;
  max_liquidity_need_years: number; // product needs funds locked at least this long
  min_net_worth_usd: number;
  min_liquid_assets_usd: number;
  allowed_risk_tolerances: RiskTolerance[];
  allowed_objectives: InvestmentObjective[];
  min_experience: Experience;
}

export interface ProductEconomics {
  // Cost transparency matters for the audit story.
  expense_ratio_pct: number; // annual, e.g. 0.05 = 5bps
  commission_pct: number; // upfront / trail combined, normalized
  surrender_period_years: number; // 0 for mutual funds
  has_living_benefit_rider: boolean; // VA-only
  rider_cost_pct: number; // annual
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  // Internal risk level for matching against client RT (5-point scale).
  risk_level: 1 | 2 | 3 | 4 | 5;
  requirements: ProductRequirements;
  economics: ProductEconomics;
  description: string;
}

// ---------- Rule firing results ----------

export type RuleStatus = "pass" | "warn" | "fail";

export interface RuleResult {
  rule_id: string; // e.g. "R2111.AGE", "R2330.CONCENTRATION"
  factor: string; // human label
  status: RuleStatus;
  rationale: string;
  client_value: string | number | boolean | null;
  product_requirement: string | number | boolean | null;
}

// ---------- Receipt ----------

export interface Receipt {
  receipt_id: string;
  client_id: string;
  recommended_product_id: string | null; // null = no suitable product
  score: number; // engine-internal match score for the chosen product
  reason: string; // one-line summary of the recommendation
  rule_results: RuleResult[]; // for the chosen (or top-evaluated) product
  alternatives: Array<{
    product_id: string;
    score: number;
    failing_rules: string[]; // rule_ids that knocked it out
  }>;
  counterfactual: {
    // If we flipped the single most influential client factor, would the
    // recommendation change? Used by the receipt UI.
    changed_factor: string | null;
    alt_value: string | number | null;
    alt_product_id: string | null;
  };
  timestamp: string; // ISO
}

// ---------- Audit report ----------

export interface DisparityFinding {
  protected_attribute: "age_band" | "zip_cluster" | "gender";
  cohort: string; // e.g. "65_plus"
  // Conditional on stated risk tolerance, what fraction got recommended
  // a product at risk_level >= cohort_baseline + 1?
  stated_risk_tolerance: RiskTolerance;
  cohort_recommendation_distribution: Record<string, number>; // risk_level -> fraction
  baseline_recommendation_distribution: Record<string, number>;
  // Four-fifths rule style ratio. <0.8 = disparate impact red flag.
  selection_rate_ratio: number;
  n_cohort: number;
  n_baseline: number;
  severity: "low" | "medium" | "high";
  rationale: string;
}

export interface AuditReport {
  generated_at: string;
  n_clients: number;
  n_receipts: number;
  findings: DisparityFinding[];
  // High-level summary line for the dashboard hero card.
  headline: string;
}
