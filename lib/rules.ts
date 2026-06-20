// Rule 2111 / 2330 rule functions. Each takes a (client_factors, product) pair
// and returns a RuleResult. "fail" = hard knockout, "warn" = scored down,
// "pass" = ok.
//
// Each rule references the FINRA citation it implements in the rule_id.
// Rule families:
//   R2111.* — general suitability factors (FINRA Rule 2111)
//   R2330.* — variable annuity-specific (FINRA Rule 2330)

import type {
  ClientFactors,
  Product,
  RuleResult,
  Experience,
  RiskTolerance,
} from "./types";

const EXP_ORDER: Record<Experience, number> = {
  none: 0,
  limited: 1,
  good: 2,
  extensive: 3,
};

const RT_ORDER: Record<RiskTolerance, number> = {
  conservative: 1,
  moderate_conservative: 2,
  moderate: 3,
  moderate_aggressive: 4,
  aggressive: 5,
};

type Rule = (c: ClientFactors, p: Product) => RuleResult;

export const ageRule: Rule = (c, p) => {
  const ok =
    c.age >= p.requirements.min_age &&
    (p.requirements.max_age === null || c.age <= p.requirements.max_age);
  return {
    rule_id: "R2111.AGE",
    factor: "Age",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Client age ${c.age} within product range ${p.requirements.min_age}–${p.requirements.max_age ?? "∞"}.`
      : `Client age ${c.age} outside product range ${p.requirements.min_age}–${p.requirements.max_age ?? "∞"}.`,
    client_value: c.age,
    product_requirement: `${p.requirements.min_age}–${p.requirements.max_age ?? "∞"}`,
  };
};

export const timeHorizonRule: Rule = (c, p) => {
  const ok = c.time_horizon_years >= p.requirements.min_time_horizon_years;
  return {
    rule_id: "R2111.TIME_HORIZON",
    factor: "Investment time horizon",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Client horizon ${c.time_horizon_years}y meets product minimum ${p.requirements.min_time_horizon_years}y.`
      : `Client horizon ${c.time_horizon_years}y below product minimum ${p.requirements.min_time_horizon_years}y.`,
    client_value: c.time_horizon_years,
    product_requirement: p.requirements.min_time_horizon_years,
  };
};

export const liquidityRule: Rule = (c, p) => {
  // Client's expected time-until-need-principal must be at least as long as
  // the period the product effectively locks up funds. Hard knockout for VAs
  // (real surrender penalty); warn-only for mutual funds (just volatility).
  const ok = c.liquidity_need_within_years >= p.requirements.max_liquidity_need_years;
  const status = ok ? "pass" : p.type === "variable_annuity" ? "fail" : "warn";
  return {
    rule_id: "R2111.LIQUIDITY",
    factor: "Liquidity needs",
    status,
    rationale: ok
      ? `Client needs liquidity in ≥${c.liquidity_need_within_years}y; product locks for ≤${p.requirements.max_liquidity_need_years}y.`
      : `Client needs liquidity in ${c.liquidity_need_within_years}y; product designed for ≥${p.requirements.max_liquidity_need_years}y holding.`,
    client_value: c.liquidity_need_within_years,
    product_requirement: p.requirements.max_liquidity_need_years,
  };
};

export const netWorthRule: Rule = (c, p) => {
  const ok = c.net_worth_usd >= p.requirements.min_net_worth_usd;
  return {
    rule_id: "R2111.NET_WORTH",
    factor: "Financial situation — net worth",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Net worth $${c.net_worth_usd.toLocaleString()} meets minimum $${p.requirements.min_net_worth_usd.toLocaleString()}.`
      : `Net worth $${c.net_worth_usd.toLocaleString()} below minimum $${p.requirements.min_net_worth_usd.toLocaleString()}.`,
    client_value: c.net_worth_usd,
    product_requirement: p.requirements.min_net_worth_usd,
  };
};

export const liquidAssetsRule: Rule = (c, p) => {
  const ok = c.liquid_assets_usd >= p.requirements.min_liquid_assets_usd;
  return {
    rule_id: "R2111.LIQUID_ASSETS",
    factor: "Financial situation — liquid assets",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Liquid assets $${c.liquid_assets_usd.toLocaleString()} meets minimum.`
      : `Liquid assets $${c.liquid_assets_usd.toLocaleString()} below minimum $${p.requirements.min_liquid_assets_usd.toLocaleString()}.`,
    client_value: c.liquid_assets_usd,
    product_requirement: p.requirements.min_liquid_assets_usd,
  };
};

export const riskToleranceRule: Rule = (c, p) => {
  const ok = p.requirements.allowed_risk_tolerances.includes(c.risk_tolerance);
  return {
    rule_id: "R2111.RISK_TOLERANCE",
    factor: "Risk tolerance",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Stated risk tolerance "${c.risk_tolerance}" is within product's allowed set.`
      : `Stated risk tolerance "${c.risk_tolerance}" not in product's allowed set [${p.requirements.allowed_risk_tolerances.join(", ")}].`,
    client_value: c.risk_tolerance,
    product_requirement: p.requirements.allowed_risk_tolerances.join("|"),
  };
};

export const objectiveRule: Rule = (c, p) => {
  const ok = p.requirements.allowed_objectives.includes(c.investment_objective);
  return {
    rule_id: "R2111.OBJECTIVE",
    factor: "Investment objective",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Objective "${c.investment_objective}" matches product.`
      : `Objective "${c.investment_objective}" not in product's allowed set [${p.requirements.allowed_objectives.join(", ")}].`,
    client_value: c.investment_objective,
    product_requirement: p.requirements.allowed_objectives.join("|"),
  };
};

export const experienceRule: Rule = (c, p) => {
  const ok = EXP_ORDER[c.investment_experience] >= EXP_ORDER[p.requirements.min_experience];
  return {
    rule_id: "R2111.EXPERIENCE",
    factor: "Investment experience",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Experience "${c.investment_experience}" meets minimum "${p.requirements.min_experience}".`
      : `Experience "${c.investment_experience}" below minimum "${p.requirements.min_experience}".`,
    client_value: c.investment_experience,
    product_requirement: p.requirements.min_experience,
  };
};

// ---------- Rule 2330 — Variable Annuity specific ----------

export const vaInTaxAdvantagedRule: Rule = (c, p) => {
  if (p.type !== "variable_annuity") {
    return {
      rule_id: "R2330.TAX_LOCATION",
      factor: "VA in tax-advantaged account",
      status: "pass",
      rationale: "Not a variable annuity — rule not applicable.",
      client_value: null,
      product_requirement: null,
    };
  }
  const conflict = c.in_tax_advantaged_account;
  return {
    rule_id: "R2330.TAX_LOCATION",
    factor: "VA in tax-advantaged account",
    status: conflict ? "warn" : "pass",
    rationale: conflict
      ? "VA inside an already tax-deferred account duplicates the primary tax benefit — heightened scrutiny required."
      : "VA held in taxable account; tax-deferral provides genuine benefit.",
    client_value: c.in_tax_advantaged_account,
    product_requirement: false,
  };
};

export const vaConcentrationRule: Rule = (c, p) => {
  if (p.type !== "variable_annuity") {
    return {
      rule_id: "R2330.CONCENTRATION",
      factor: "VA concentration",
      status: "pass",
      rationale: "Not a variable annuity — rule not applicable.",
      client_value: null,
      product_requirement: null,
    };
  }
  // If client already holds >40% net worth in VAs, flag.
  const ratio = c.net_worth_usd > 0 ? c.existing_va_holdings_usd / c.net_worth_usd : 0;
  const status = ratio > 0.4 ? "fail" : ratio > 0.2 ? "warn" : "pass";
  return {
    rule_id: "R2330.CONCENTRATION",
    factor: "VA concentration",
    status,
    rationale:
      status === "fail"
        ? `Existing VA holdings already ${(ratio * 100).toFixed(0)}% of net worth — adding another VA is unsuitable.`
        : status === "warn"
        ? `Existing VA holdings ${(ratio * 100).toFixed(0)}% of net worth — adding more requires documented justification.`
        : `Existing VA holdings ${(ratio * 100).toFixed(0)}% of net worth — within tolerance.`,
    client_value: `${(ratio * 100).toFixed(0)}%`,
    product_requirement: "≤20% (pass) / ≤40% (warn)",
  };
};

export const vaSeniorScrutinyRule: Rule = (c, p) => {
  if (p.type !== "variable_annuity") {
    return {
      rule_id: "R2330.SENIOR_SCRUTINY",
      factor: "Senior VA scrutiny",
      status: "pass",
      rationale: "Not a variable annuity — rule not applicable.",
      client_value: null,
      product_requirement: null,
    };
  }
  // Heightened review for clients ≥70 buying a VA with surrender period.
  const trigger = c.age >= 70 && p.economics.surrender_period_years >= 5;
  return {
    rule_id: "R2330.SENIOR_SCRUTINY",
    factor: "Senior VA scrutiny",
    status: trigger ? "warn" : "pass",
    rationale: trigger
      ? `Client age ${c.age} buying VA with ${p.economics.surrender_period_years}y surrender — requires principal review and signed disclosure.`
      : "No heightened senior scrutiny triggered.",
    client_value: c.age,
    product_requirement: "<70 OR surrender <5y",
  };
};

export const vaSurrenderHorizonRule: Rule = (c, p) => {
  // Cross-rule: VA surrender period must fit within client's expected holding period.
  if (p.type !== "variable_annuity") {
    return {
      rule_id: "R2330.SURRENDER_HORIZON",
      factor: "Surrender vs. horizon",
      status: "pass",
      rationale: "Not a variable annuity — rule not applicable.",
      client_value: null,
      product_requirement: null,
    };
  }
  const ok = c.time_horizon_years >= p.economics.surrender_period_years;
  return {
    rule_id: "R2330.SURRENDER_HORIZON",
    factor: "Surrender vs. horizon",
    status: ok ? "pass" : "fail",
    rationale: ok
      ? `Client horizon ${c.time_horizon_years}y covers ${p.economics.surrender_period_years}y surrender period.`
      : `Client horizon ${c.time_horizon_years}y shorter than ${p.economics.surrender_period_years}y surrender — early withdrawal penalty risk.`,
    client_value: c.time_horizon_years,
    product_requirement: p.economics.surrender_period_years,
  };
};

export const ALL_RULES: Rule[] = [
  ageRule,
  timeHorizonRule,
  liquidityRule,
  netWorthRule,
  liquidAssetsRule,
  riskToleranceRule,
  objectiveRule,
  experienceRule,
  vaInTaxAdvantagedRule,
  vaConcentrationRule,
  vaSeniorScrutinyRule,
  vaSurrenderHorizonRule,
];

export function evaluate(c: ClientFactors, p: Product): RuleResult[] {
  return ALL_RULES.map((r) => r(c, p));
}

// Engine scoring. Among products with no "fail" rules:
//   - Start at 100.
//   - Subtract 8 per "warn".
//   - Subtract |client_RT_rank - product_risk_level| * 6 (RT–product alignment).
//   - Add a small commission tilt (modeling advisor incentive bias —
//     deliberately included so the proxy audit has something to surface).
//
// The commission tilt is the realistic source of disparate impact in this
// demo: factor-by-factor every recommendation looks rule-compliant, but
// when commission breaks ties, eligible high-commission products win
// disproportionately for cohorts whose proxies make them eligible.
export function score(
  c: ClientFactors,
  p: Product,
  results: RuleResult[],
): { score: number; hard_fails: string[] } {
  const hard_fails = results.filter((r) => r.status === "fail").map((r) => r.rule_id);
  if (hard_fails.length > 0) {
    return { score: -Infinity, hard_fails };
  }
  let s = 100;
  s -= results.filter((r) => r.status === "warn").length * 8;
  s -= Math.abs(RT_ORDER[c.risk_tolerance] - p.risk_level) * 6;
  // Commission tilt — small but decisive in ties.
  s += p.economics.commission_pct * 1.2;
  return { score: s, hard_fails };
}
