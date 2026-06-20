// Suitability engine. Takes a client + product universe, returns a Receipt.
// Pure function, deterministic, no I/O.

import type {
  Client,
  Product,
  Receipt,
  RuleResult,
} from "./types";
import { evaluate, score } from "./rules";

interface Evaluation {
  product: Product;
  rule_results: RuleResult[];
  score: number;
  hard_fails: string[];
}

export function recommend(client: Client, products: Product[]): Receipt {
  const evaluations: Evaluation[] = products.map((p) => {
    const rule_results = evaluate(client.factors, p);
    const { score: s, hard_fails } = score(client.factors, p, rule_results);
    return { product: p, rule_results, score: s, hard_fails };
  });

  const survivors = evaluations.filter((e) => e.hard_fails.length === 0);
  survivors.sort((a, b) => b.score - a.score);

  const top = survivors[0] ?? null;

  // Counterfactual: try flipping risk_tolerance one notch (a common
  // sensitivity people ask about). If the result changes, surface it.
  const cf = counterfactual(client, products, top?.product.id ?? null);

  // Build alternatives list — all evaluations sorted by score, with reasons.
  const alternatives = [...evaluations]
    .sort((a, b) => b.score - a.score)
    .filter((e) => e.product.id !== top?.product.id)
    .slice(0, 5)
    .map((e) => ({
      product_id: e.product.id,
      score: Number.isFinite(e.score) ? Math.round(e.score * 10) / 10 : 0,
      failing_rules: e.hard_fails,
    }));

  const rule_results = top
    ? top.rule_results
    : // If nothing fits, show why the closest product was knocked out.
      evaluations.sort((a, b) => b.score - a.score)[0]?.rule_results ?? [];

  return {
    receipt_id: `R${client.id.slice(1)}`,
    client_id: client.id,
    recommended_product_id: top?.product.id ?? null,
    score: top ? Math.round(top.score * 10) / 10 : 0,
    reason: top
      ? `${top.product.name} selected — top eligible match for stated risk tolerance ${client.factors.risk_tolerance} and objective ${client.factors.investment_objective}.`
      : "No product satisfies all hard rules — escalate to advisor review.",
    rule_results,
    alternatives,
    counterfactual: cf,
    timestamp: new Date(0).toISOString(), // deterministic for reproducibility
  };
}

function counterfactual(
  client: Client,
  products: Product[],
  current_product_id: string | null,
): Receipt["counterfactual"] {
  // Try bumping risk_tolerance one step up. If recommendation changes, report.
  const rt_steps: Array<typeof client.factors.risk_tolerance> = [
    "conservative",
    "moderate_conservative",
    "moderate",
    "moderate_aggressive",
    "aggressive",
  ];
  const idx = rt_steps.indexOf(client.factors.risk_tolerance);
  const next = idx >= 0 && idx < rt_steps.length - 1 ? rt_steps[idx + 1] : null;
  if (!next) {
    return { changed_factor: null, alt_value: null, alt_product_id: null };
  }
  const alt_factors = { ...client.factors, risk_tolerance: next };
  const alt_eval = products.map((p) => {
    const rr = evaluate(alt_factors, p);
    const sc = score(alt_factors, p, rr);
    return { p, score: sc.score, hard_fails: sc.hard_fails };
  });
  const survivors = alt_eval.filter((e) => e.hard_fails.length === 0);
  survivors.sort((a, b) => b.score - a.score);
  const alt_top = survivors[0]?.p.id ?? null;
  if (alt_top === current_product_id) {
    return { changed_factor: null, alt_value: null, alt_product_id: null };
  }
  return {
    changed_factor: "risk_tolerance",
    alt_value: next,
    alt_product_id: alt_top,
  };
}
