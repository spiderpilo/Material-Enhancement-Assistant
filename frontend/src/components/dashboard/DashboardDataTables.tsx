import type { ReactNode } from "react";

import { DashboardSectionCard } from "@/components/dashboard/DashboardSectionCard";
import { getMaterialStatusTone } from "@/lib/dashboard/selectors";
import type { DashboardMaterialRow } from "@/lib/dashboard/types";

type DashboardRecentUploadsTableProps = {
  action?: ReactNode;
  rows: DashboardMaterialRow[];
};

function getToneClasses(tone: "accent" | "warning" | "neutral") {
  if (tone === "accent") {
    return "bg-[color:var(--accent-surface)] text-[color:var(--accent)]";
  }

  if (tone === "warning") {
    return "bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]";
  }

  return "bg-[color:var(--surface-subtle)] text-[color:var(--muted-strong)]";
}

export function DashboardRecentUploadsTable({
  action,
  rows,
}: DashboardRecentUploadsTableProps) {
  return (
    <DashboardSectionCard
      title="Recent Uploaded Files"
      description="The newest materials in the selected window appear here, ready to connect to live upload data later."
      action={action}
    >
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]">
                <th className="px-4">File</th>
                <th className="px-4">Course</th>
                <th className="px-4">Type</th>
                <th className="px-4">Status</th>
                <th className="px-4">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="rounded-[18px] bg-[rgba(255,255,255,0.04)]"
                >
                  <td className="rounded-l-[18px] px-4 py-4 font-semibold text-[color:var(--foreground)]">
                    {row.title}
                  </td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted-strong)]">
                    {row.courseLabel}
                  </td>
                  <td className="px-4 py-4 text-sm text-[color:var(--muted-strong)]">
                    {row.typeLabel}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getToneClasses(getMaterialStatusTone(row.status))}`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="rounded-r-[18px] px-4 py-4 text-sm text-[color:var(--muted-strong)]">
                    {row.uploadedLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-subtle)] p-6 text-sm leading-7 text-[color:var(--muted-strong)]">
          No uploaded files are available for the current filters yet.
        </div>
      )}
    </DashboardSectionCard>
  );
}
