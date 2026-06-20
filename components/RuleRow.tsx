import type { RuleResult } from "@/lib/types";

export function RuleRow({ r }: { r: RuleResult }) {
  const statusStyles =
    r.status === "pass"
      ? "bg-sev-ok-bg text-sev-ok"
      : r.status === "warn"
      ? "bg-sev-med-bg text-sev-med"
      : "bg-sev-high-bg text-sev-high";
  return (
    <details className="group border-b border-hairline last:border-0">
      <summary className="grid cursor-pointer grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 hover:bg-bg transition-colors list-none">
        <span
          className={`inline-flex w-12 justify-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusStyles}`}
        >
          {r.status}
        </span>
        <span className="text-[13px] text-ink">{r.factor}</span>
        <span className="num text-[11px] text-ink-3">{r.rule_id}</span>
        <span className="text-ink-3 text-[14px] transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 pb-4 pt-1 text-[12px] sm:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow">Client value</p>
          <p className="num mt-1 text-ink">{formatValue(r.client_value)}</p>
        </div>
        <div>
          <p className="eyebrow">Product requirement</p>
          <p className="num mt-1 text-ink">{formatValue(r.product_requirement)}</p>
        </div>
        <p className="sm:col-span-2 text-ink-2 leading-relaxed">{r.rationale}</p>
      </div>
    </details>
  );
}

function formatValue(v: string | number | boolean | null): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  return v;
}
