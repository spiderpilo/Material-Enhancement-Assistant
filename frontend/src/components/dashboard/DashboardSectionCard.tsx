import type { ReactNode } from "react";

type DashboardSectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DashboardSectionCard({
  title,
  description,
  action,
  children,
}: DashboardSectionCardProps) {
  return (
    <section className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted-strong)]">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}
