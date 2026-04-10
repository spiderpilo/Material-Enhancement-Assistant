"use client";

import { useRef, useState } from "react";

import { UploadCloudIcon } from "@/components/course-content-upload/icons";

export function UploadDropzone() {
  const [selectedCount, setSelectedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-[24px] border-2 border-dashed border-[color:var(--line-strong)] bg-[linear-gradient(180deg,rgba(255,253,249,0.88),rgba(237,244,239,0.94))] px-6 py-10 shadow-[var(--shadow-soft)] sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-[420px] flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--secondary-surface)] text-[color:var(--secondary-text)]">
          <UploadCloudIcon className="h-8 w-8" />
        </div>

        <h3 className="mt-5 font-[family:var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[2.25rem]">
          Drop files to upload
        </h3>
        <p className="mt-3 text-base leading-8 text-[color:var(--muted-strong)]">
          Supports PDF, DOCX, PPTX slides, and high-res lecture images. (Max
          50MB per file)
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
            className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-6 py-3 text-base font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--line-strong)] hover:bg-[color:var(--accent-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-soft)]"
          >
            Browse Files
          </button>
          <button
            type="button"
            disabled
            aria-label="Import from Drive (coming soon, currently unavailable)"
            className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-[color:var(--line)] bg-[rgba(201,195,189,0.34)] px-6 py-3 text-base font-medium text-[color:var(--foreground)] opacity-60 transition disabled:hover:bg-[rgba(201,195,189,0.34)] focus:outline-none"
          >
            Import from Drive
          </button>
        </div>

        <p
          aria-live="polite"
          className="mt-4 text-sm text-[color:var(--muted)]"
        >
          {selectedCount === 0
            ? "No files selected yet."
            : `${selectedCount} file${selectedCount === 1 ? "" : "s"} selected.`}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
          className="sr-only"
          onChange={(event) => {
            const fileCount = event.target.files?.length ?? 0;
            setSelectedCount(fileCount);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
