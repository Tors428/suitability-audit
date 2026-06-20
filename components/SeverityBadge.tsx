type Severity = "high" | "medium" | "low";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles =
    severity === "high"
      ? "bg-sev-high-bg text-sev-high"
      : severity === "medium"
      ? "bg-sev-med-bg text-sev-med"
      : "bg-sev-ok-bg text-sev-ok";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles}`}
    >
      {severity}
    </span>
  );
}
