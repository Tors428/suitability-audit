import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-hairline bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        <Link href="/" className="text-[13px] font-semibold tracking-tight">
          Suitability Audit
        </Link>
        <div className="flex items-center gap-6 text-[13px] text-ink-2">
          <Link href="/dashboard" className="hover:text-ink transition-colors">
            Dashboard
          </Link>
          <Link href="/receipts" className="hover:text-ink transition-colors">
            Receipts
          </Link>
        </div>
      </div>
    </nav>
  );
}
