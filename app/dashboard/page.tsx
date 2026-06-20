import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { DistributionChart } from "@/components/DistributionChart";
import { SeverityBadge } from "@/components/SeverityBadge";
import type { AuditReport, DisparityFinding } from "@/lib/types";

const COHORT_LABEL: Record<string, string> = {
  age_band: "Age band",
  zip_cluster: "ZIP cluster",
  gender: "Gender",
};

const COHORT_VALUE_LABEL: Record<string, string> = {
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

const RT_LABEL: Record<string, string> = {
  conservative: "Conservative",
  moderate_conservative: "Moderately conservative",
  moderate: "Moderate",
  moderate_aggressive: "Moderately aggressive",
  aggressive: "Aggressive",
};

export default async function Dashboard() {
  const report: AuditReport = JSON.parse(
    await fs.readFile(resolve(process.cwd(), "data", "audit.json"), "utf-8"),
  );

  const high = report.findings.filter((f) => f.severity === "high").length;
  const medium = report.findings.filter((f) => f.severity === "medium").length;

  // Group by attribute for the two main panels.
  const ageFindings = report.findings.filter(
    (f) => f.protected_attribute === "age_band",
  );
  const zipFindings = report.findings.filter(
    (f) => f.protected_attribute === "zip_cluster",
  );
  const otherFindings = report.findings.filter(
    (f) => f.protected_attribute !== "age_band" && f.protected_attribute !== "zip_cluster",
  );

  return (
    <main className="min-h-screen">
      <Nav />

      <div className="mx-auto max-w-6xl px-8 py-12">
        {/* Page header */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Audit · Run {report.generated_at.slice(0, 10)}</p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.015em]">
              Disparate-impact review
            </h1>
          </div>
          <div className="text-right text-[12px] text-ink-3">
            <p>
              <span className="num text-ink">{report.n_clients.toLocaleString()}</span>{" "}
              clients ·{" "}
              <span className="num text-ink">{report.n_receipts.toLocaleString()}</span>{" "}
              receipts
            </p>
            <p className="mt-1">Four-fifths-rule threshold · 0.80</p>
          </div>
        </div>

        {/* Hero summary card */}
        <section className="mt-8 rounded-lg border border-hairline bg-surface p-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-[2fr_1fr]">
            <div>
              <p className="eyebrow">Headline</p>
              <p className="mt-3 text-[22px] leading-snug font-medium text-ink">
                {report.headline}
              </p>
              <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink-2">
                Each finding shows a cohort whose selection rate for a suitable
                recommendation falls below 80% of the rest of the population at
                the same stated risk tolerance.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6 self-start">
              <CountStat label="High" value={high} accent="high" />
              <CountStat label="Medium" value={medium} accent="med" />
              <CountStat label="Total" value={report.findings.length} />
            </div>
          </div>
        </section>

        {/* Drill-down: Age */}
        {ageFindings.length > 0 && (
          <FindingsPanel
            title="By age band"
            subtitle="Senior cohort cascades through the experience-and-prior-VA proxies that the engine treats as legitimate Rule 2111 inputs."
            findings={ageFindings}
          />
        )}

        {/* Drill-down: ZIP */}
        {zipFindings.length > 0 && (
          <FindingsPanel
            title="By ZIP cluster"
            subtitle="Cluster-D cohort cascades through truncated-time-horizon reporting — a documented proxy of advisor steering in under-served ZIPs."
            findings={zipFindings}
          />
        )}

        {otherFindings.length > 0 && (
          <FindingsPanel title="Other" subtitle="" findings={otherFindings} />
        )}

        {report.findings.length === 0 && (
          <div className="mt-12 rounded-lg border border-hairline bg-surface p-12 text-center">
            <p className="text-[15px] text-ink-2">
              No cohort fell below the four-fifths threshold this run.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function CountStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
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
      <p className={`num mt-2 text-[32px] font-medium leading-none ${color}`}>
        {value}
      </p>
    </div>
  );
}

function FindingsPanel({
  title,
  subtitle,
  findings,
}: {
  title: string;
  subtitle: string;
  findings: DisparityFinding[];
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
        <p className="num text-[12px] text-ink-3">
          {findings.length} {findings.length === 1 ? "finding" : "findings"}
        </p>
      </div>
      {subtitle && <p className="mt-2 max-w-2xl text-[13px] text-ink-2">{subtitle}</p>}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {findings.map((f, i) => (
          <FindingCard key={`${f.cohort}-${f.stated_risk_tolerance}-${i}`} f={f} />
        ))}
      </div>
    </section>
  );
}

function FindingCard({ f }: { f: DisparityFinding }) {
  const cohortValueLabel = COHORT_VALUE_LABEL[f.cohort] ?? f.cohort;
  const attributeLabel = COHORT_LABEL[f.protected_attribute] ?? f.protected_attribute;
  const rtLabel = RT_LABEL[f.stated_risk_tolerance] ?? f.stated_risk_tolerance;

  return (
    <article className="rounded-lg border border-hairline bg-surface p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{attributeLabel}</p>
          <h3 className="mt-1.5 text-[17px] font-semibold text-ink">
            {cohortValueLabel}
          </h3>
          <p className="mt-1 text-[12px] text-ink-2">
            Conditional on stated RT · <span className="text-ink">{rtLabel}</span>
          </p>
        </div>
        <SeverityBadge severity={f.severity} />
      </header>

      <div className="mt-5 grid grid-cols-3 gap-4 border-y border-hairline py-4">
        <Metric
          label="Selection ratio"
          value={f.selection_rate_ratio.toFixed(2)}
          accent={f.severity === "high" ? "high" : "med"}
        />
        <Metric label="Cohort n" value={f.n_cohort.toLocaleString()} />
        <Metric label="Baseline n" value={f.n_baseline.toLocaleString()} />
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-3">Recommendation distribution</p>
        <DistributionChart
          cohort={f.cohort_recommendation_distribution}
          baseline={f.baseline_recommendation_distribution}
          cohortLabel={`${cohortValueLabel} (n=${f.n_cohort})`}
          baselineLabel={`Baseline (n=${f.n_baseline})`}
        />
      </div>

      <footer className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
        <p className="text-[12px] text-ink-2 leading-relaxed pr-4">{f.rationale}</p>
        <Link
          href={`/receipts?attribute=${f.protected_attribute}&value=${f.cohort}&rt=${f.stated_risk_tolerance}`}
          className="shrink-0 whitespace-nowrap rounded-md border border-hairline-strong px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-bg transition-colors"
        >
          View receipts →
        </Link>
      </footer>
    </article>
  );
}

function Metric({
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
      <p className={`num mt-1.5 text-[18px] font-medium ${color}`}>{value}</p>
    </div>
  );
}
