import type { ComponentType, SVGProps } from "react";

import type { DashboardMetricCardValue } from "@/lib/dashboard/types";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type DashboardMetricCardProps = DashboardMetricCardValue & {
  icon: IconType;
};

export function DashboardMetricCard({
  detail,
  icon: Icon,
  label,
  trendDirection,
  trendLabel,
  value,
}: DashboardMetricCardProps) {
  const trendClasses =
    trendDirection === "up"
      ? "bg-[color:var(--accent-surface)] text-[color:var(--accent)]"
      : trendDirection === "down"
        ? "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]"
        : "bg-[color:var(--surface-subtle)] text-[color:var(--muted-strong)]";

  return (
    <article className="rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]">
            {label}
          </p>
          <p className="mt-4 font-[family:var(--font-display)] text-[2.4rem] font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-[2.75rem]">
            {value}
          </p>
        </div>

        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--secondary-surface)] text-[color:var(--secondary-text)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-[color:var(--muted-strong)]">
        {detail}
      </p>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-[color:var(--line)] pt-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${trendClasses}`}
        >
          {trendLabel}
        </span>
      </div>
    </article>
  );
}
