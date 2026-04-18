import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import type { DashboardActivityFeedItem } from "@/lib/dashboard/types";

type DashboardActivityFeedProps = {
  items: DashboardActivityFeedItem[];
};

function getToneClasses(tone: DashboardActivityFeedItem["tone"]) {
  if (tone === "accent") {
    return "bg-[color:var(--accent-surface)] text-[color:var(--accent)]";
  }

  if (tone === "warning") {
    return "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]";
  }

  return "bg-[color:var(--surface-subtle)] text-[color:var(--muted-strong)]";
}

export function DashboardActivityFeed({ items }: DashboardActivityFeedProps) {
  return (
    <DashboardSectionCard
      title="Recent Activity"
      description="Recent uploads, analysis events, and export updates appear here automatically."
    >
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.04)] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[color:var(--foreground)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-strong)]">
                    {item.description}
                  </p>
                </div>

                <span
                  className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getToneClasses(item.tone)}`}
                >
                  {item.kindLabel}
                </span>
              </div>

              <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {item.timestampLabel}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-subtle)] p-6 text-sm leading-7 text-[color:var(--muted-strong)]">
          No activity has been recorded yet. Once uploads, analyses, or exports
          are available, this feed will render them through the shared mapping
          helpers.
        </div>
      )}
    </DashboardSectionCard>
  );
}
