type AuthShowcaseProps = {
  description: string;
  eyebrow: string;
  footerLabel?: string;
  steps?: string[];
  title: string;
};

export function AuthShowcase({
  description,
  eyebrow,
  footerLabel,
  steps = [],
  title,
}: AuthShowcaseProps) {
  return (
    <section className="auth-showcase flex h-full min-h-[360px] flex-col justify-between p-6 sm:p-8 lg:min-h-[720px] lg:p-10 xl:p-11">
      <div className="relative">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d7ebbd]">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-[family:var(--font-display)] text-[2.45rem] font-semibold tracking-[-0.05em] text-[#f4f6ef] sm:text-[2.8rem] sm:leading-[1.05]">
            {title}
          </h1>
          <p className="mt-4 max-w-[32rem] text-sm leading-6 text-[#c4cabd] sm:text-[15px]">
            {description}
          </p>
        </div>
      </div>

      <div className="relative mt-10 space-y-3 text-sm text-[#d2d8cc]">
        {steps.map((step) => (
          <p key={step}>{step}</p>
        ))}

        {footerLabel ? (
          <p className="pt-5 text-[10px] uppercase tracking-[0.22em] text-[#7f8979]">
            {footerLabel}
          </p>
        ) : null}
      </div>
    </section>
  );
}
