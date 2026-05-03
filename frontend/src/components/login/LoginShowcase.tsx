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
    <section className="auth-showcase flex h-full min-h-[360px] flex-col justify-between p-6 sm:p-8 lg:min-h-[720px] lg:p-10 xl:p-11">
      <div className="relative">
        <div className="flex items-center gap-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-[#f4f6ef]">
          <HomeIcon className="h-5 w-5 text-[#d7ebbd]" />
          <span className="font-[family:var(--font-display)]">
            Curriculum Updater
          </span>
        </div>

        <p className="mt-5 max-w-[320px] text-sm leading-6 text-[#c4cabd]">
          Supporting curriculum development through structured, research-informed
          academic planning.
        </p>
      </div>

      <div className="relative mt-10 space-y-5">
        {features.map(({ title, description, icon: Icon }) => (
          <article
            key={title}
            className="border-b border-[rgba(255,255,255,0.14)] pb-4 last:border-b-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.14)] bg-[#181b16] text-[#d7ebbd]">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#f2f4ed]">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#b7bfb2]">
                  {description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="relative mt-8 text-[10px] uppercase tracking-[0.18em] text-[#7f8979]">
        Institutional Governance Portal
      </p>
    </section>
  );
}
