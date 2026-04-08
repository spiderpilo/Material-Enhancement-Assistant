import {
  ClipboardIcon,
  CourseStackIcon,
  HomeIcon,
  ReviewBubbleIcon,
} from "@/components/course-content-upload/icons";

const features = [
  {
    title: "Smarter content refinement",
    description:
      "Improve lectures and course materials with structured, research-backed suggestions.",
    icon: ClipboardIcon,
  },
  {
    title: "Guided review workflow",
    description:
      "Review, edit, and approve AI-generated improvements side by side.",
    icon: ReviewBubbleIcon,
  },
  {
    title: "Structured institutional alignment",
    description:
      "Ensure compliance with governance standards and accreditation needs.",
    icon: CourseStackIcon,
  },
];

export function LoginShowcase() {
  return (
    <section className="relative flex h-full min-h-[360px] flex-col justify-between overflow-hidden bg-[#183326] p-7 text-white sm:p-8 lg:min-h-[560px]">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: [
            "linear-gradient(180deg, rgba(10, 20, 15, 0.22), rgba(10, 20, 15, 0.72))",
            "repeating-linear-gradient(90deg, rgba(203, 182, 132, 0.22) 0 8%, transparent 8% 18%, rgba(203, 182, 132, 0.16) 18% 28%, transparent 28% 38%, rgba(203, 182, 132, 0.14) 38% 48%, transparent 48% 58%, rgba(203, 182, 132, 0.14) 58% 68%, transparent 68% 78%, rgba(203, 182, 132, 0.1) 78% 88%, transparent 88% 100%)",
            "repeating-linear-gradient(180deg, rgba(236, 222, 193, 0.12) 0 2px, transparent 2px 54px)",
          ].join(", "),
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(27,53,39,0.22),rgba(12,24,18,0.7))]" />
      <div className="absolute inset-x-0 top-0 h-16 opacity-70 [background-image:repeating-linear-gradient(145deg,rgba(223,214,191,0.38)_0_18px,transparent_18px_42px)]" />
      <div className="absolute bottom-0 left-[42%] top-[22%] w-[18%] bg-[linear-gradient(180deg,rgba(223,197,120,0.14),rgba(223,197,120,0.02))] blur-sm" />
      <div className="absolute inset-y-0 right-0 w-px bg-[rgba(255,255,255,0.06)]" />

      <div className="relative">
        <div className="flex items-center gap-2 text-[1.5rem] font-semibold tracking-[-0.04em]">
          <HomeIcon className="h-5 w-5" />
          <span className="font-[family:var(--font-display)]">
            Curriculum Updater
          </span>
        </div>

        <p className="mt-5 max-w-[320px] text-sm leading-6 text-white/80">
          Supporting curriculum development through structured, research-informed
          academic planning.
        </p>
      </div>

      <div className="relative mt-10 space-y-5">
        {features.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="border-b border-white/18 pb-4 last:border-b-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/8 text-white">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/72">
                  {description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="relative mt-8 text-[10px] uppercase tracking-[0.18em] text-white/45">
        Institutional Governance Portal
      </p>
    </section>
  );
}
