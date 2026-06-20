"use client";

export function DownloadButton({
  filename,
  content,
  children,
}: {
  filename: string;
  content: string;
  children: React.ReactNode;
}) {
  const onClick = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-hairline-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-bg transition-colors"
    >
      {children}
    </button>
  );
}
