import Link from "next/link";

import { AppShell } from "@/components/app-shell/AppShell";
import { MetadataPanel } from "@/components/course-content-upload/MetadataPanel";
import { UploadDropzone } from "@/components/course-content-upload/UploadDropzone";
import { UploadedDocumentsCard } from "@/components/course-content-upload/UploadedDocumentsCard";
import { StartAnalysisIcon } from "@/components/course-content-upload/icons";

export default function Home() {
  return (
    <AppShell
      activeNavItem="uploads"
      headerTitle="Upload Materials"
      headerSearchPlaceholder="Search archive..."
      headerActions={
        <Link
          href="/dashboard"
          className="hidden items-center justify-center rounded-full border border-[color:var(--secondary-soft)] bg-[rgba(255,253,249,0.86)] px-4 py-2 text-sm font-semibold text-[color:var(--secondary-text)] transition hover:border-[color:var(--secondary)] hover:bg-[color:var(--secondary-soft)] sm:inline-flex"
        >
          View Dashboard
        </Link>
      }
    >
      <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8">
        <section className="flex flex-col gap-6 overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(255,253,249,0.98),rgba(237,244,239,0.94)_58%,rgba(244,139,154,0.12)_100%)] p-6 shadow-[var(--shadow-card)] sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-[family:var(--font-display)] text-[2.5rem] font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-[3rem] sm:leading-[1.1]">
              Course Content Upload
            </h1>
            <p className="mt-2 max-w-xl text-base leading-8 text-[color:var(--muted-strong)]">
              Add your lecture slides, readings, and notes to begin automated
              synthesis.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent),#5CA484)] px-7 py-3 text-base font-semibold text-white shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
          >
            <StartAnalysisIcon className="h-[18px] w-[18px]" />
            Start Analysis
          </button>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_362px] xl:items-start">
          <div className="space-y-8">
            <UploadDropzone />
            <UploadedDocumentsCard />
          </div>
          <MetadataPanel />
        </section>
      </div>
    </AppShell>
  );
}
