import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SeverityBadge } from "@/components/SeverityBadge";
import { RuleRow } from "@/components/RuleRow";
import {
  getClientById,
  getProductById,
  getProducts,
  getReceiptById,
  getReceipts,
} from "@/lib/data";
import {
  COHORT_VALUE_LABEL,
  RT_LABEL,
  OBJECTIVE_LABEL,
  EXPERIENCE_LABEL,
  TAX_STATUS_LABEL,
  moneyShort,
} from "@/lib/labels";
import type { Receipt } from "@/lib/types";

export async function generateStaticParams() {
  // Pre-render the first chunk so navigation is snappy in production. The
  // rest fall through to dynamic on-demand rendering.
  const receipts = await getReceipts();
  return receipts.slice(0, 50).map((r) => ({ id: r.receipt_id }));
}

export default async function ReceiptDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getReceiptById(id);
  if (!receipt) notFound();

  const client = await getClientById(receipt.client_id);
  if (!client) notFound();

  const product = receipt.recommended_product_id
    ? await getProductById(receipt.recommended_product_id)
    : null;
  const altProductPromises = receipt.alternatives.map((a) =>
    getProductById(a.product_id),
  );
  const altProducts = await Promise.all(altProductPromises);
  const cfProduct = receipt.counterfactual.alt_product_id
    ? await getProductById(receipt.counterfactual.alt_product_id)
    : null;

  const failCount = receipt.rule_results.filter((r) => r.status === "fail").length;
  const warnCount = receipt.rule_results.filter((r) => r.status === "warn").length;

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-4xl px-8 py-10">
        <Link
          href="/receipts"
          className="text-[12px] text-ink-2 hover:text-ink"
        >
          ← All receipts
        </Link>

        {/* Header */}
        <header className="mt-5 flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow">Receipt</p>
            <h1 className="num mt-2 text-[28px] font-semibold tracking-tight">
              {receipt.receipt_id}
            </h1>
            <p className="mt-1 text-[13px] text-ink-2">
              Client{" "}
              <span className="num text-ink">{client.id}</span>
              {"  ·  Generated "}
              <span className="num">{receipt.timestamp.slice(0, 10)}</span>
            </p>
          </div>
          <Link
            href={`/receipts/${receipt.receipt_id}/appeal`}
            className="rounded-md border border-hairline-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:bg-bg transition-colors"
          >
            Generate appeal artifact
          </Link>
        </header>

        {/* Recommendation banner */}
        <section className="mt-8 rounded-lg border border-hairline bg-surface p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[2fr_1fr]">
            <div>
              <p className="eyebrow">Recommendation</p>
              {product ? (
                <>
                  <h2 className="mt-2 text-[22px] font-semibold text-ink">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-[12px] text-ink-2">
                    <span className="num">{product.id}</span> ·{" "}
                    {product.type === "variable_annuity"
                      ? "Variable annuity"
                      : "Mutual fund"}{" "}
                    · Risk level{" "}
                    <span className="num text-ink">{product.risk_level}</span>
                  </p>
                  <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
                    {receipt.reason}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-[20px] font-semibold text-sev-high">
                    No suitable product
                  </h2>
                  <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
                    {receipt.reason}
                  </p>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 self-start">
              <Stat
                label="Score"
                value={product ? receipt.score.toFixed(1) : "—"}
              />
              <Stat
                label="Warns"
                value={String(warnCount)}
                accent={warnCount > 0 ? "med" : undefined}
              />
              <Stat
                label="Fails"
                value={String(failCount)}
                accent={failCount > 0 ? "high" : undefined}
              />
            </div>
          </div>
        </section>

        {/* Client snapshot */}
        <section className="mt-10">
          <h3 className="text-[15px] font-semibold tracking-tight">
            Client snapshot
          </h3>
          <p className="mt-1 text-[12px] text-ink-2">
            Inputs the engine evaluated. Protected attributes are stored
            separately and never reach the engine — shown here for audit
            transparency.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-hairline bg-surface p-6 sm:grid-cols-3">
            <Field
              label="Age"
              value={
                <>
                  <span className="num">{client.factors.age}</span>
                </>
              }
            />
            <Field
              label="Annual income"
              value={
                <span className="num">{moneyShort(client.factors.annual_income_usd)}</span>
              }
            />
            <Field
              label="Net worth"
              value={
                <span className="num">{moneyShort(client.factors.net_worth_usd)}</span>
              }
            />
            <Field
              label="Liquid assets"
              value={
                <span className="num">
                  {moneyShort(client.factors.liquid_assets_usd)}
                </span>
              }
            />
            <Field
              label="Tax status"
              value={TAX_STATUS_LABEL[client.factors.tax_status]}
            />
            <Field
              label="Risk tolerance"
              value={RT_LABEL[client.factors.risk_tolerance]}
            />
            <Field
              label="Objective"
              value={OBJECTIVE_LABEL[client.factors.investment_objective]}
            />
            <Field
              label="Experience"
              value={EXPERIENCE_LABEL[client.factors.investment_experience]}
            />
            <Field
              label="Time horizon"
              value={
                <span>
                  <span className="num">{client.factors.time_horizon_years}</span>{" "}
                  <span className="text-ink-3">years</span>
                </span>
              }
            />
            <Field
              label="Liquidity need"
              value={
                <span>
                  <span className="num">
                    {client.factors.liquidity_need_within_years}
                  </span>{" "}
                  <span className="text-ink-3">years</span>
                </span>
              }
            />
            <Field
              label="Existing VA holdings"
              value={
                <span className="num">
                  {moneyShort(client.factors.existing_va_holdings_usd)}
                </span>
              }
            />
            <Field
              label="In tax-advantaged acct"
              value={client.factors.in_tax_advantaged_account ? "Yes" : "No"}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border border-dashed border-hairline-strong px-6 py-4 sm:grid-cols-3 bg-bg/50">
            <Field
              label="Age band (audit only)"
              value={
                <span className="text-ink-2">
                  {COHORT_VALUE_LABEL[client.protected.age_band]}
                </span>
              }
            />
            <Field
              label="ZIP cluster (audit only)"
              value={
                <span className="uppercase text-ink-2">
                  {client.protected.zip_cluster}
                </span>
              }
            />
            <Field
              label="Gender (audit only)"
              value={
                <span className="text-ink-2">
                  {COHORT_VALUE_LABEL[client.protected.gender]}
                </span>
              }
            />
            {client.seed_tag && (
              <div className="sm:col-span-3 text-[11px] text-ink-2 leading-relaxed">
                <span className="eyebrow mr-2">Seed</span>
                <span className="num">{client.seed_tag}</span>{" "}
                <span className="text-ink-3">
                  — this client was deliberately drawn to encode a documented
                  bias pattern (see README).
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Factor breakdown */}
        <section className="mt-10">
          <h3 className="text-[15px] font-semibold tracking-tight">
            Rule firings
          </h3>
          <p className="mt-1 text-[12px] text-ink-2">
            Each Rule 2111 / 2330 factor evaluated against the recommended
            product. Click a row to see client value, product requirement, and
            rationale.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface">
            {receipt.rule_results.map((r) => (
              <RuleRow key={r.rule_id} r={r} />
            ))}
          </div>
        </section>

        {/* Counterfactual */}
        <section className="mt-10">
          <h3 className="text-[15px] font-semibold tracking-tight">
            Counterfactual
          </h3>
          <p className="mt-1 text-[12px] text-ink-2">
            What changes if the client had stated a slightly different
            answer to one factor?
          </p>
          <div className="mt-4 rounded-lg border border-hairline bg-surface p-6">
            {receipt.counterfactual.alt_product_id ? (
              <p className="text-[14px] leading-relaxed text-ink">
                If the client had stated{" "}
                <span className="font-semibold text-ink">
                  {RT_LABEL[receipt.counterfactual.alt_value as string] ??
                    receipt.counterfactual.alt_value}
                </span>{" "}
                instead of{" "}
                <span className="font-semibold">
                  {RT_LABEL[client.factors.risk_tolerance]}
                </span>{" "}
                for risk tolerance, the recommendation would change to{" "}
                <span className="font-semibold text-ink">
                  {cfProduct?.name ?? receipt.counterfactual.alt_product_id}
                </span>
                .
              </p>
            ) : (
              <p className="text-[14px] text-ink-2">
                Bumping risk tolerance one notch up does not change the
                recommendation — this receipt is stable to that perturbation.
              </p>
            )}
          </div>
        </section>

        {/* Alternatives */}
        {receipt.alternatives.length > 0 && (
          <section className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-tight">
              Other products evaluated
            </h3>
            <p className="mt-1 text-[12px] text-ink-2">
              Top five other products scored by the engine, with the rules
              that knocked them out (if any).
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface">
              <table className="w-full text-[13px]">
                <thead className="border-b border-hairline bg-bg">
                  <tr className="text-left text-ink-3 text-[10px] uppercase tracking-wider">
                    <th className="px-5 py-2.5 font-medium">Product</th>
                    <th className="px-5 py-2.5 font-medium text-right">Score</th>
                    <th className="px-5 py-2.5 font-medium">Failed rules</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.alternatives.map((a, i) => {
                    const p = altProducts[i];
                    return (
                      <tr
                        key={a.product_id}
                        className="border-b border-hairline last:border-0"
                      >
                        <td className="px-5 py-3">
                          <span className="text-ink">{p?.name ?? a.product_id}</span>
                          <span className="ml-2 num text-ink-3 text-[11px]">
                            {a.product_id}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right num text-ink-2">
                          {a.failing_rules.length > 0 ? "—" : a.score.toFixed(1)}
                        </td>
                        <td className="px-5 py-3">
                          {a.failing_rules.length > 0 ? (
                            <span className="num text-[11px] text-ink-2">
                              {a.failing_rules.join(", ")}
                            </span>
                          ) : (
                            <span className="text-ink-3 text-[12px]">
                              eligible, lower score
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "high" | "med";
}) {
  const color =
    accent === "high"
      ? "text-sev-high"
      : accent === "med"
      ? "text-sev-med"
      : "text-ink";
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1.5 text-[22px] font-medium leading-none ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 text-[14px] text-ink">{value}</p>
    </div>
  );
}
