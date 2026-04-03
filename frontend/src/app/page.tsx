import { FloatingHelpButton } from "@/components/course-content-upload/FloatingHelpButton";
import { SidebarNav } from "@/components/course-content-upload/SidebarNav";
import { TopHeader } from "@/components/course-content-upload/TopHeader";
import { UploadDropzone } from "@/components/course-content-upload/UploadDropzone";
import { UploadedDocumentsCard } from "@/components/course-content-upload/UploadedDocumentsCard";

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-[1640px] flex-col gap-5 px-4 py-4 lg:flex-row lg:px-5 lg:py-5">
        <SidebarNav />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow-panel)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),rgba(255,255,255,0))]" />

          <TopHeader />

          <div className="relative flex-1 px-5 pb-8 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
            <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface-muted)] p-6 shadow-[var(--shadow-soft)] sm:p-8 lg:p-10">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                    Course Workspace
                  </p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-5xl xl:text-[3.75rem] xl:leading-[1.05]">
                    Course Content Upload
                  </h1>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--muted-strong)] sm:text-lg">
                    Upload and organize course materials before analysis. Keep
                    the review space clean, centralized, and ready for the next
                    approval step.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-7 py-4 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-[color:var(--accent-strong)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
                >
                  Start Analysis
                </button>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)]">
              <UploadDropzone />
              <UploadedDocumentsCard />
            </section>
          </div>
        </div>

        <FloatingHelpButton />
      </div>
    </main>
  );
}
