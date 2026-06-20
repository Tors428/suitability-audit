import Link from "next/link";
import { Nav } from "@/components/Nav";
import { SeverityBadge } from "@/components/SeverityBadge";
import { getClients, getProducts, getReceipts } from "@/lib/data";
import {
  COHORT_LABEL,
  COHORT_VALUE_LABEL,
  RT_LABEL,
} from "@/lib/labels";
import type { Receipt, Client, Product } from "@/lib/types";

const PAGE_SIZE = 50;

interface Filter {
  attribute?: "age_band" | "zip_cluster" | "gender";
  value?: string;
  rt?: string;
  outcome?: "matched" | "no_match";
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter: Filter = {
    attribute: sp.attribute as Filter["attribute"],
    value: typeof sp.value === "string" ? sp.value : undefined,
    rt: typeof sp.rt === "string" ? sp.rt : undefined,
    outcome: sp.outcome as Filter["outcome"],
  };
  const page = Math.max(1, parseInt((sp.page as string) ?? "1", 10) || 1);

  const [clients, products, receipts] = await Promise.all([
    getClients(),
    getProducts(),
    getReceipts(),
  ]);
  const cmap = new Map(clients.map((c) => [c.id, c]));
  const pmap = new Map(products.map((p) => [p.id, p]));

  const filtered = receipts.filter((r) => {
    const c = cmap.get(r.client_id);
    if (!c) return false;
    if (filter.attribute && filter.value) {
      if (filter.attribute === "age_band" && c.protected.age_band !== filter.value)
        return false;
      if (filter.attribute === "zip_cluster" && c.protected.zip_cluster !== filter.value)
        return false;
      if (filter.attribute === "gender" && c.protected.gender !== filter.value)
        return false;
    }
    if (filter.rt && c.factors.risk_tolerance !== filter.rt) return false;
    if (filter.outcome === "matched" && r.recommended_product_id === null) return false;
    if (filter.outcome === "no_match" && r.recommended_product_id !== null) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filterChips: Array<{ label: string; href: string }> = [];
  const baseParams = new URLSearchParams();
  if (filter.attribute && filter.value) {
    filterChips.push({
      label: `${COHORT_LABEL[filter.attribute] ?? filter.attribute}: ${COHORT_VALUE_LABEL[filter.value] ?? filter.value}`,
      href: removeParams(sp, ["attribute", "value", "page"]),
    });
  }
  if (filter.rt) {
    filterChips.push({
      label: `RT: ${RT_LABEL[filter.rt] ?? filter.rt}`,
      href: removeParams(sp, ["rt", "page"]),
    });
  }
  if (filter.outcome) {
    filterChips.push({
      label: filter.outcome === "no_match" ? "No-match only" : "Matched only",
      href: removeParams(sp, ["outcome", "page"]),
    });
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-6xl px-8 py-12">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Receipts</p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.015em]">
              {filterChips.length > 0 ? "Filtered receipts" : "All receipts"}
            </h1>
          </div>
          <p className="num text-[12px] text-ink-3">
            <span className="text-ink">{total.toLocaleString()}</span> of{" "}
            {receipts.length.toLocaleString()}
          </p>
        </div>

        {filterChips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-ink-3">Filters</span>
            {filterChips.map((chip, i) => (
              <Link
                key={i}
                href={chip.href === "" ? "/receipts" : `/receipts?${chip.href}`}
                className="inline-flex items-center gap-1 rounded-full border border-hairline-strong bg-surface px-3 py-1 text-ink hover:bg-bg transition-colors"
                title="Click to remove"
              >
                {chip.label}
                <span className="text-ink-3">×</span>
              </Link>
            ))}
            <Link
              href="/receipts"
              className="text-ink-3 hover:text-ink underline underline-offset-2 ml-1"
            >
              Clear all
            </Link>
          </div>
        )}

        <FilterBar current={filter} baseSp={sp} />

        <div className="mt-6 overflow-hidden rounded-lg border border-hairline bg-surface">
          <table className="w-full text-[13px]">
            <thead className="border-b border-hairline bg-bg">
              <tr className="text-left text-ink-3">
                <Th>Receipt</Th>
                <Th>Client</Th>
                <Th>Age</Th>
                <Th>ZIP</Th>
                <Th>Stated RT</Th>
                <Th>Recommendation</Th>
                <Th align="right">Score</Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const c = cmap.get(r.client_id)!;
                const p = r.recommended_product_id
                  ? pmap.get(r.recommended_product_id) ?? null
                  : null;
                return (
                  <tr
                    key={r.receipt_id}
                    className="border-b border-hairline last:border-0 hover:bg-bg transition-colors"
                  >
                    <Td>
                      <Link
                        href={`/receipts/${r.receipt_id}`}
                        className="font-medium text-ink hover:underline underline-offset-2"
                      >
                        {r.receipt_id}
                      </Link>
                    </Td>
                    <Td>
                      <span className="num text-ink-2">{c.id}</span>
                    </Td>
                    <Td>
                      <span className="num">{c.factors.age}</span>
                      <span className="ml-1 text-ink-3">
                        ({COHORT_VALUE_LABEL[c.protected.age_band]})
                      </span>
                    </Td>
                    <Td>
                      <span className="uppercase">{c.protected.zip_cluster}</span>
                    </Td>
                    <Td>{RT_LABEL[c.factors.risk_tolerance]}</Td>
                    <Td>
                      {p ? (
                        <span>
                          <span className="text-ink">{p.name}</span>
                          <span className="ml-2 text-ink-3 num">{p.id}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <SeverityBadge severity="medium" />
                          <span className="text-ink-2">No suitable product</span>
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="num text-ink-2">
                        {r.recommended_product_id ? r.score.toFixed(1) : "—"}
                      </span>
                    </Td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-2 text-[14px]">
                    No receipts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <Pagination current={page} total={totalPages} sp={sp} />
        )}
      </div>
    </main>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-4 py-3 font-medium uppercase tracking-wider text-[10px] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td className={`px-4 py-3 ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function removeParams(
  sp: Record<string, string | string[] | undefined>,
  keys: string[],
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (keys.includes(k)) continue;
    if (typeof v === "string") params.set(k, v);
  }
  return params.toString();
}

function FilterBar({
  current,
  baseSp,
}: {
  current: Filter;
  baseSp: Record<string, string | string[] | undefined>;
}) {
  const link = (overrides: Partial<Record<string, string | undefined>>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseSp)) {
      if (k === "page") continue;
      if (typeof v === "string") params.set(k, v);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `/receipts?${s}` : "/receipts";
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-hairline bg-surface px-5 py-3 text-[12px]">
      <FilterGroup
        label="Outcome"
        options={[
          { value: undefined, label: "All" },
          { value: "matched", label: "Matched" },
          { value: "no_match", label: "No match" },
        ]}
        current={current.outcome}
        toHref={(v) => link({ outcome: v })}
      />
      <FilterGroup
        label="Risk tolerance"
        options={[
          { value: undefined, label: "All" },
          { value: "conservative", label: "Cons." },
          { value: "moderate_conservative", label: "Mod. cons." },
          { value: "moderate", label: "Mod." },
          { value: "moderate_aggressive", label: "Mod. agg." },
          { value: "aggressive", label: "Agg." },
        ]}
        current={current.rt}
        toHref={(v) => link({ rt: v })}
      />
    </div>
  );
}

function FilterGroup<T extends string | undefined>({
  label,
  options,
  current,
  toHref,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  current: T;
  toHref: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-3">{label}</span>
      <div className="flex items-center gap-1">
        {options.map((o) => {
          const active = (current ?? "") === (o.value ?? "");
          return (
            <Link
              key={o.label}
              href={toHref(o.value)}
              className={`rounded-md px-2 py-1 ${
                active
                  ? "bg-ink text-surface"
                  : "text-ink-2 hover:bg-bg"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Pagination({
  current,
  total,
  sp,
}: {
  current: number;
  total: number;
  sp: Record<string, string | string[] | undefined>;
}) {
  const linkFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "page") continue;
      if (typeof v === "string") params.set(k, v);
    }
    params.set("page", String(page));
    return `/receipts?${params.toString()}`;
  };
  return (
    <div className="mt-6 flex items-center justify-between text-[13px] text-ink-2">
      <p>
        Page <span className="num text-ink">{current}</span> of{" "}
        <span className="num text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        {current > 1 && (
          <Link
            href={linkFor(current - 1)}
            className="rounded-md border border-hairline-strong px-3 py-1.5 hover:bg-surface"
          >
            ← Previous
          </Link>
        )}
        {current < total && (
          <Link
            href={linkFor(current + 1)}
            className="rounded-md border border-hairline-strong px-3 py-1.5 hover:bg-surface"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
