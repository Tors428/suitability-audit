// Appeal artifact generator. Produces two structured text deliverables for
// a single receipt:
//
//   1. Client-facing letter — plain language, explains what the engine
//      decided, why, and how the client can ask for human review.
//   2. Internal compliance memo — references the specific Rule 2111 / 2330
//      factors and surfaces whether the receipt sits inside a flagged cohort.
//
// Templates only — no LLM, fully deterministic, reproducible.

import type {
  Client,
  Receipt,
  Product,
  AuditReport,
  DisparityFinding,
} from "./types";
import { RT_LABEL, OBJECTIVE_LABEL, COHORT_VALUE_LABEL, moneyShort } from "./labels";

function findCohortFinding(
  client: Client,
  audit: AuditReport,
): DisparityFinding | null {
  const matches = audit.findings.filter((f) => {
    if (f.stated_risk_tolerance !== client.factors.risk_tolerance) return false;
    if (f.protected_attribute === "age_band")
      return f.cohort === client.protected.age_band;
    if (f.protected_attribute === "zip_cluster")
      return f.cohort === client.protected.zip_cluster;
    if (f.protected_attribute === "gender")
      return f.cohort === client.protected.gender;
    return false;
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.selection_rate_ratio - b.selection_rate_ratio);
  return matches[0];
}

export function generateAppealArtifacts(
  client: Client,
  receipt: Receipt,
  product: Product | null,
  audit: AuditReport,
): { client_letter: string; compliance_memo: string; in_flagged_cohort: boolean } {
  const finding = findCohortFinding(client, audit);
  const in_flagged_cohort = finding !== null;

  const fails = receipt.rule_results.filter((r) => r.status === "fail");
  const warns = receipt.rule_results.filter((r) => r.status === "warn");
  const passes = receipt.rule_results.filter((r) => r.status === "pass");

  const client_letter = `${formatDate()}

Re: Your investment recommendation — reference ${receipt.receipt_id}

Dear Client,

You recently completed a suitability questionnaire with our firm. Based on
the answers you provided, our recommendation engine ${
    product
      ? `recommended the following product:

    ${product.name} (${product.id})

`
      : `was unable to identify a suitable product from our current shelf.

`
  }You have the right to ask for human review of this decision. This letter
explains what the engine looked at, why it reached the conclusion above,
and what to do next.

What the engine considered

The engine evaluated your answers against ${receipt.rule_results.length} regulatory
factors drawn from FINRA Rule 2111 (general suitability) and FINRA Rule
2330 (variable annuity-specific responsibilities).

Of those factors:
  - ${passes.length} passed
  - ${warns.length} raised a caution flag
  - ${fails.length} were not satisfied${fails.length > 0 ? `:` : "."}
${fails
  .map((r) => `      • ${r.factor} — ${r.rationale}`)
  .join("\n")}

What this means for you

${
  product
    ? `The recommendation reflects our best match for your stated risk tolerance
(${RT_LABEL[client.factors.risk_tolerance]}), investment objective
(${OBJECTIVE_LABEL[client.factors.investment_objective]}), time horizon
(${client.factors.time_horizon_years} years), and financial situation
(net worth approx. ${moneyShort(client.factors.net_worth_usd)}).
${
  receipt.counterfactual.alt_product_id
    ? `\nNote: this recommendation is sensitive to one answer. If you had stated
your risk tolerance as ${RT_LABEL[
        receipt.counterfactual.alt_value as string
      ] ?? receipt.counterfactual.alt_value}
instead of ${RT_LABEL[client.factors.risk_tolerance]}, the engine would
have recommended a different product. If your circumstances are closer
to the alternative, please tell us.`
    : ""
}`
    : `Because no product on our current shelf passes every regulatory check
for your stated answers, the engine has not made a recommendation.
This is the conservative outcome — it does not mean we cannot help.`
}

How to ask for review

If anything above is incorrect, has changed, or feels like the wrong fit,
please respond to this letter or contact your advisor within 30 days.
A registered principal will review the decision and, where appropriate,
override the engine.

You may also request:
  - A copy of the full decision receipt, including all ${receipt.rule_results.length} factor
    evaluations.
  - A copy of our firm's written supervisory procedures for handling
    suitability appeals.

Sincerely,

Compliance Operations
Reference: ${receipt.receipt_id}
`;

  const compliance_memo = `INTERNAL COMPLIANCE MEMO — NOT FOR CLIENT DISTRIBUTION

Date:            ${formatDate()}
Receipt:         ${receipt.receipt_id}
Client ID:       ${client.id}
Recommendation:  ${product ? `${product.name} (${product.id})` : "NONE — engine could not match"}
Score:           ${product ? receipt.score.toFixed(1) : "n/a"}

================================================================
1. SUITABILITY DETERMINATION
================================================================

Rule 2111 customer-specific factors evaluated:

  Age:                ${client.factors.age}
  Risk tolerance:     ${RT_LABEL[client.factors.risk_tolerance]}
  Objective:          ${OBJECTIVE_LABEL[client.factors.investment_objective]}
  Time horizon:       ${client.factors.time_horizon_years}y
  Liquidity need:     ${client.factors.liquidity_need_within_years}y
  Net worth:          ${moneyShort(client.factors.net_worth_usd)}
  Liquid assets:      ${moneyShort(client.factors.liquid_assets_usd)}
  Tax status:         ${client.factors.tax_status}
  Experience:         ${client.factors.investment_experience}
  Existing VA hldgs:  ${moneyShort(client.factors.existing_va_holdings_usd)}
  Tax-advantaged a/c: ${client.factors.in_tax_advantaged_account ? "Yes" : "No"}

Rule firings (${receipt.rule_results.length} total):

  PASS  (${passes.length}): ${passes.map((r) => r.rule_id).join(", ") || "—"}
  WARN  (${warns.length}): ${warns.map((r) => r.rule_id).join(", ") || "—"}
  FAIL  (${fails.length}): ${fails.map((r) => r.rule_id).join(", ") || "—"}

${
  warns.length > 0
    ? `Warn detail:\n${warns
        .map((r) => `  • ${r.rule_id}: ${r.rationale}`)
        .join("\n")}\n`
    : ""
}${
    fails.length > 0
      ? `Fail detail:\n${fails
          .map((r) => `  • ${r.rule_id}: ${r.rationale}`)
          .join("\n")}\n`
      : ""
  }
================================================================
2. COUNTERFACTUAL SENSITIVITY
================================================================

${
  receipt.counterfactual.alt_product_id
    ? `Recommendation is UNSTABLE to a one-step risk-tolerance shift.

  Current stated RT:    ${RT_LABEL[client.factors.risk_tolerance]}
  Alternative RT:       ${
    RT_LABEL[receipt.counterfactual.alt_value as string] ??
    receipt.counterfactual.alt_value
  }
  Alternative product:  ${receipt.counterfactual.alt_product_id}

ACTION REQUIRED: Confirm stated RT with client before transacting.`
    : `Recommendation is stable to a one-step risk-tolerance shift.
No additional client confirmation required on this basis.`
}

================================================================
3. PROXY BIAS REVIEW
================================================================

${
  finding
    ? `⚠  This receipt sits inside a flagged disparate-impact cohort.

  Protected attribute:       ${finding.protected_attribute}
  Cohort:                    ${COHORT_VALUE_LABEL[finding.cohort] ?? finding.cohort}
  Conditional on stated RT:  ${RT_LABEL[finding.stated_risk_tolerance]}
  Selection-rate ratio:      ${finding.selection_rate_ratio.toFixed(2)} (four-fifths threshold: 0.80)
  Severity:                  ${finding.severity.toUpperCase()}
  Cohort n / Baseline n:     ${finding.n_cohort} / ${finding.n_baseline}

  Finding rationale:
    ${finding.rationale}

ACTION REQUIRED:
  (a) Have a registered principal review this specific recommendation
      before transacting.
  (b) Document, in this client's file, the human-review reasoning that
      supports or overrides the engine output.
  (c) Refer this cohort finding to the firm's quarterly suitability
      pattern review.${
        client.seed_tag
          ? `\n\nNOTE: Demo data — client's bias-seed tag is "${client.seed_tag}".`
          : ""
      }`
    : `No flagged cohort applies to this receipt at the current audit threshold.
No additional bias-review action required.`
}

================================================================
4. CITATIONS
================================================================

  FINRA Rule 2111 — Suitability (customer-specific obligation)
  FINRA Rule 2330 — Members' Responsibilities Regarding Deferred
                    Variable Annuities (where product type = VA)
  EEOC §1607.4(D) — Four-fifths rule (used as analog for disparate
                    impact in product-recommendation selection rates)
  FINRA 2025 Annual Regulatory Oversight Report — suitability and
                    senior-investor risk areas

End of memo.
`;

  return { client_letter, compliance_memo, in_flagged_cohort };
}

function formatDate(): string {
  // Deterministic placeholder so artifacts diff cleanly across runs.
  return "January 1, 2026";
}
