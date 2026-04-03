import { UploadCloudIcon } from "@/components/course-content-upload/icons";

export function UploadDropzone() {
  return (
    <section className="rounded-[30px] border border-[color:var(--line)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-7">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
          Upload Materials
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          Add your course documents
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted-strong)]">
          Upload lecture notes, syllabi, slide decks, or supporting PDFs to
          begin the content analysis workflow.
        </p>
      </div>

      <div className="mt-6 rounded-[28px] border-2 border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-muted)] p-6 sm:p-10">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-[color:var(--accent-strong)] shadow-[var(--shadow-inset)]">
            <UploadCloudIcon className="h-9 w-9" />
          </div>

          <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
            Drop files here to upload
          </h3>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
            Drag and drop multiple files at once or select them from your
            device. Supported materials can be reviewed before analysis starts.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <label
              htmlFor="course-content-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-[color:var(--accent-strong)]"
            >
              Select files
            </label>
            <span className="inline-flex items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-6 py-3 text-sm font-medium text-[color:var(--muted-strong)]">
              PDF, DOCX, PPT, TXT
            </span>
          </div>

          <input
            id="course-content-upload"
            type="file"
            multiple
            className="sr-only"
          />
        </div>
      </div>
    </section>
  );
}
