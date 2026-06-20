import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DownloadButton } from "@/components/DownloadButton";
import { SeverityBadge } from "@/components/SeverityBadge";
import {
  getAudit,
  getClientById,
  getProductById,
  getReceiptById,
} from "@/lib/data";
import { generateAppealArtifacts } from "@/lib/appeal";

export default async function AppealPage({
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
  const audit = await getAudit();

  const { client_letter, compliance_memo, in_flagged_cohort } =
    generateAppealArtifacts(client, receipt, product, audit);

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-5xl px-8 py-10">
        <Link
          href={`/receipts/${receipt.receipt_id}`}
          className="text-[12px] text-ink-2 hover:text-ink"
        >
          ← Back to receipt
        </Link>

        <header className="mt-5 flex items-start justify-between gap-6">
          <div>
            <p className="eyebrow">Appeal artifact</p>
            <h1 className="num mt-2 text-[28px] font-semibold tracking-tight">
              {receipt.receipt_id}
            </h1>
            <p className="mt-1 text-[13px] text-ink-2 max-w-xl">
              Two deterministic artifacts generated from this receipt: a
              client-facing letter and an internal compliance memo. No model,
              no LLM — straight templates over the receipt and the current
              audit report.
            </p>
          </div>
          {in_flagged_cohort && (
            <div className="text-right">
              <SeverityBadge severity="high" />
              <p className="mt-1.5 text-[11px] text-ink-2">
                In flagged cohort —<br /> memo includes bias review
              </p>
            </div>
          )}
        </header>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ArtifactCard
            title="Client letter"
            subtitle="Plain language, explains the decision and how to appeal."
            content={client_letter}
            filename={`${receipt.receipt_id}-client-letter.txt`}
          />
          <ArtifactCard
            title="Compliance memo"
            subtitle="Internal — cites Rule 2111 / 2330 and any active cohort finding."
            content={compliance_memo}
            filename={`${receipt.receipt_id}-compliance-memo.txt`}
          />
        </div>
      </div>
    </main>
  );
}

function ArtifactCard({
  title,
  subtitle,
  content,
  filename,
}: {
  title: string;
  subtitle: string;
  content: string;
  filename: string;
}) {
  return (
    <article className="rounded-lg border border-hairline bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-[12px] text-ink-2">{subtitle}</p>
        </div>
        <DownloadButton filename={filename} content={content}>
          Download .txt
        </DownloadButton>
      </header>
      <pre className="num whitespace-pre-wrap break-words px-6 py-5 text-[11.5px] leading-[1.65] text-ink-2 max-h-[640px] overflow-auto">
{content}
      </pre>
    </article>
  );
}
