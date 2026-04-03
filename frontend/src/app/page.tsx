import { FloatingHelpButton } from "@/components/course-content-upload/FloatingHelpButton";
import { MetadataPanel } from "@/components/course-content-upload/MetadataPanel";
import { SidebarNav } from "@/components/course-content-upload/SidebarNav";
import { TopHeader } from "@/components/course-content-upload/TopHeader";
import { UploadDropzone } from "@/components/course-content-upload/UploadDropzone";
import { UploadedDocumentsCard } from "@/components/course-content-upload/UploadedDocumentsCard";
import { StartAnalysisIcon } from "@/components/course-content-upload/icons";

export default function Home() {
  return (
    <main className="flex-1 bg-[color:var(--background)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <SidebarNav />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />

          <div className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8">
              <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h1 className="font-[family:var(--font-display)] text-[2.5rem] font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-[3rem] sm:leading-[1.1]">
                    Course Content Upload
                  </h1>
                  <p className="mt-2 max-w-xl text-base leading-8 text-[color:var(--muted-strong)]">
                    Add your lecture slides, readings, and notes to begin
                    automated synthesis.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-7 py-3 text-base font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-[color:var(--accent-strong)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
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
          </div>
        </div>
      </div>

      <FloatingHelpButton />
    </main>
  );
}
