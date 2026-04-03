export function UploadedDocumentsCard() {
  return (
    <section className="flex min-h-[420px] flex-col rounded-[30px] border border-[color:var(--line)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
            Uploaded Documents
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Document queue
          </h2>
        </div>
      </div>

      <div className="mt-6 flex flex-1 rounded-[26px] border border-[color:var(--line)] bg-[color:var(--surface-muted)]">
        <div className="uploaded-documents-placeholder relative flex-1 overflow-hidden rounded-[26px]">
          <span className="sr-only">
            Uploaded documents will appear here once files are added.
          </span>
        </div>
      </div>
    </section>
  );
}
