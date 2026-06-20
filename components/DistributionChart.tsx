// Hand-rolled SVG bars comparing cohort vs baseline recommendation distribution.
// Six categories: none, risk_level 1..5. Two stacked rows.

type Distribution = Record<string, number>; // category -> fraction (0..1)

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "none", label: "No match" },
  { key: "1", label: "Risk 1" },
  { key: "2", label: "Risk 2" },
  { key: "3", label: "Risk 3" },
  { key: "4", label: "Risk 4" },
  { key: "5", label: "Risk 5" },
];

export function DistributionChart({
  cohort,
  baseline,
  cohortLabel,
  baselineLabel,
}: {
  cohort: Distribution;
  baseline: Distribution;
  cohortLabel: string;
  baselineLabel: string;
}) {
  // Layout: 6 columns of stacked bars. Each column 2 thin bars.
  const W = 480;
  const H = 140;
  const labelArea = 28;
  const colW = (W - 8) / CATEGORIES.length;
  const barW = 14;
  const gap = 6;
  const maxY = Math.max(
    ...CATEGORIES.flatMap((c) => [cohort[c.key] ?? 0, baseline[c.key] ?? 0]),
    0.4, // floor so tiny values are still visible
  );
  const yScale = (v: number) => (v / maxY) * (H - labelArea - 8);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Recommendation distribution"
      >
        {CATEGORIES.map((c, i) => {
          const cVal = cohort[c.key] ?? 0;
          const bVal = baseline[c.key] ?? 0;
          const cx = 4 + i * colW + colW / 2;
          const cBarX = cx - barW - gap / 2;
          const bBarX = cx + gap / 2;
          const cBarH = yScale(cVal);
          const bBarH = yScale(bVal);
          const baseY = H - labelArea;
          return (
            <g key={c.key}>
              {/* baseline rule */}
              <line
                x1={cBarX - 2}
                x2={bBarX + barW + 2}
                y1={baseY + 0.5}
                y2={baseY + 0.5}
                stroke="var(--hairline)"
                strokeWidth={1}
              />
              {/* cohort bar (filled, dark) */}
              <rect
                x={cBarX}
                y={baseY - cBarH}
                width={barW}
                height={cBarH}
                fill="var(--ink)"
                rx={1}
              />
              {/* baseline bar (outlined) */}
              <rect
                x={bBarX}
                y={baseY - bBarH}
                width={barW}
                height={bBarH}
                fill="none"
                stroke="var(--hairline-strong)"
                strokeWidth={1.5}
                rx={1}
              />
              {/* category label */}
              <text
                x={cx}
                y={H - 12}
                textAnchor="middle"
                className="fill-ink-3"
                style={{ fontSize: 10 }}
              >
                {c.label}
              </text>
              {/* delta % above the cohort bar if material */}
              {Math.abs(cVal - bVal) > 0.03 && (
                <text
                  x={cx}
                  y={baseY - Math.max(cBarH, bBarH) - 6}
                  textAnchor="middle"
                  className="fill-ink-2 num"
                  style={{ fontSize: 9 }}
                >
                  {cVal > bVal ? "+" : ""}
                  {((cVal - bVal) * 100).toFixed(0)}pp
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center gap-5 text-[11px] text-ink-2">
        <Legend swatch="filled" label={cohortLabel} />
        <Legend swatch="outline" label={baselineLabel} />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: "filled" | "outline"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={
          swatch === "filled"
            ? "inline-block h-2.5 w-2.5 bg-ink"
            : "inline-block h-2.5 w-2.5 border border-hairline-strong"
        }
      />
      {label}
    </span>
  );
}
