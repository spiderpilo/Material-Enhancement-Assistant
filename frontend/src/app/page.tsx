export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">
              Material Enhancement Assistant
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Next.js 16 + Tailwind CSS 4 starter
            </p>
          </div>
          <div className="rounded-full border border-stone-300/70 bg-white/80 px-4 py-2 text-sm text-stone-700 shadow-sm backdrop-blur">
            App Router ready
          </div>
        </header>

        <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800">
              Professor review workflow scaffolded
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-stone-950 sm:text-6xl">
                Build the interface for uploading, reviewing, and approving
                course material revisions.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-stone-600">
                This frontend is configured with Next.js, TypeScript, ESLint,
                and Tailwind CSS so the approval experience can be built on top
                of a clean App Router foundation.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <code className="rounded-full border border-stone-300 bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 shadow-sm">
                npm run dev
              </code>
              <code className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 shadow-sm">
                npm run build
              </code>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              [
                "Upload materials",
                "Accept lecture slides, notes, and documents for analysis.",
              ],
              [
                "Compare revisions",
                "Present original content beside grounded AI suggestions.",
              ],
              [
                "Approve changes",
                "Keep instructors in control before anything is exported.",
              ],
            ].map(([title, description]) => (
              <article
                key={title}
                className="rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(41,37,36,0.35)] backdrop-blur"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Workflow Step
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-stone-950">
                  {title}
                </h2>
                <p className="mt-3 text-base leading-7 text-stone-600">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
