"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

import { UploadCloudIcon } from "@/components/course-content-upload/icons";

type UploadDropzoneProps = {
  onFilesSelected: (files: File[]) => void;
  statusText?: string;
};

function getFilesFromInput(event: ChangeEvent<HTMLInputElement>) {
  return event.target.files ? Array.from(event.target.files) : [];
}

export function UploadDropzone({
  onFilesSelected,
  statusText,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commitFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    onFilesSelected(files);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    commitFiles(getFilesFromInput(event));
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();

    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    commitFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "rounded-3xl border-2 border-dashed bg-(--surface-subtle) px-6 py-10 transition sm:px-8 sm:py-12",
        isDragging
          ? "border-(--accent) bg-(--accent-soft)"
          : "border-(--line-strong)",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-150 flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent)">
          <UploadCloudIcon className="h-8 w-8" />
        </div>

        <h3 className="mt-5 text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.25rem]">
          Drop files to upload
        </h3>
        <p className="mt-3 text-base leading-8 text-(--muted-strong)">
          Supports PDF, DOCX, and PPTX files. Uploads begin immediately after
          selection. (Max 50MB per file)
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              inputRef.current?.click();
            }}
            className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[#eae6de] px-6 py-3 text-base font-medium text-foreground transition hover:bg-[#e1dbd1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-soft)"
          >
            Browse Files
          </button>
          <button
            type="button"
            disabled
            aria-label="Import from Drive (coming soon, currently unavailable)"
            className="inline-flex cursor-not-allowed items-center justify-center rounded-2xl bg-[#eae6de] px-6 py-3 text-base font-medium text-foreground opacity-60 transition disabled:hover:bg-[#eae6de] focus:outline-none"
          >
            Import from Drive
          </button>
        </div>

        <p
          aria-live="polite"
          className="mt-4 text-sm text-(--muted)"
        >
          {statusText ?? "No files selected yet."}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>
    </section>
  );
}
