import Link from "next/link";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import type { AuditReport } from "@/lib/types";

export default async function Home() {
  const report: AuditReport = JSON.parse(
    await fs.readFile(resolve(process.cwd(), "data", "audit.json"), "utf-8"),
  );
  const high = report.findings.filter((f) => f.severity === "high").length;
  const med = report.findings.filter((f) => f.severity === "medium").length;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-8 pt-24 pb-32">
        <p className="eyebrow">Suitability Audit</p>
        <h1 className="mt-6 text-[44px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
          A bias-detection layer for the suitability decisions broker-dealers
          have to defend.
        </h1>
        <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-ink-2">
          5,000 synthetic clients. 10 products. One deterministic rules engine
          built on FINRA Rule 2111 and Rule 2330. A separate audit layer
          surfaces disparate-impact patterns even when the engine never sees a
          protected attribute.
        </p>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-ink px-5 py-3 text-[14px] font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Open bias dashboard →
          </Link>
          <Link
            href="/receipts"
            className="inline-flex items-center justify-center rounded-md border border-hairline-strong px-5 py-3 text-[14px] font-medium text-ink hover:bg-white transition-colors"
          >
            Browse receipts
          </Link>
        </div>

        <div className="mt-20 border-t border-hairline pt-10">
          <p className="eyebrow">Current audit headline</p>
          <p className="mt-4 text-[20px] leading-snug text-ink">
            {report.headline}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-8 max-w-md">
            <Stat label="Clients" value={report.n_clients.toLocaleString()} />
            <Stat label="High severity" value={high.toString()} accent="high" />
            <Stat label="Medium severity" value={med.toString()} accent="med" />
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-y-10 gap-x-12 sm:grid-cols-2 text-[14px] leading-relaxed text-ink-2">
          <Pillar
            title="Per-decision receipts"
            body="Every recommendation produces a structured record naming the Rule 2111 factors evaluated, the client value, the product requirement, and pass / warn / fail status."
          />
          <Pillar
            title="Proxy bias detection"
            body="The engine never reads protected attributes. The audit joins receipts to a separate attributes table and applies a four-fifths-rule selection-ratio test."
          />
          <Pillar
            title="Counterfactual transparency"
            body="Each receipt answers the natural follow-up: if the client had stated a slightly different risk tolerance, would the recommendation change?"
          />
          <Pillar
            title="Appeal-ready artifacts"
            body="A finding does not close itself. Each flagged receipt can generate a client-facing letter and an internal compliance memo for advisor review."
          />
        </div>

        <footer className="mt-24 border-t border-hairline pt-8 text-[12px] text-ink-3">
          Built on FINRA Rule 2111, Rule 2330, and EEOC §1607.4(D) four-fifths
          guidance. Synthetic data — no real clients, no real recommendations.
        </footer>
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
      <p className={`num mt-2 text-[28px] font-medium leading-none ${color}`}>
        {value}
      </p>
    </div>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-2">{body}</p>
    </div>
  );
}
