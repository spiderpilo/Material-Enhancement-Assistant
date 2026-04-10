"use client";

import Link from "next/link";
import { useState } from "react";

import { DashboardActivityFeed } from "@/components/dashboard/DashboardActivityFeed";
import { DashboardRecentUploadsTable } from "@/components/dashboard/DashboardDataTables";
import { DashboardMetricCard } from "@/components/dashboard/DashboardMetricCard";
import {
  ChevronDownIcon,
  ClockIcon,
  ExportArrowIcon,
  ReviewBubbleIcon,
  UploadCloudIcon,
} from "@/components/course-content-upload/icons";
import {
  filterDashboardData,
  getDashboardCourseOptions,
  getDashboardMetricCards,
  getDashboardWindowLabel,
  getMaterialTableRows,
  getRecentActivityFeedItems,
} from "@/lib/dashboard/selectors";
import type { DashboardData, DashboardRange } from "@/lib/dashboard/types";

type DashboardClientPageProps = {
  initialData: DashboardData;
};

const rangeOptions: Array<{ label: string; value: DashboardRange }> = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

const metricIcons = {
  materials: UploadCloudIcon,
  ready: ReviewBubbleIcon,
  cycleTime: ClockIcon,
  exports: ExportArrowIcon,
} as const;

export function DashboardClientPage({
  initialData,
}: DashboardClientPageProps) {
  const [referenceNow] = useState(() => new Date());
  const [range, setRange] = useState<DashboardRange>("30d");
  const [courseFilter, setCourseFilter] = useState("all");

  const courseOptions = getDashboardCourseOptions(initialData);
  const filteredData = filterDashboardData(
    initialData,
    range,
    courseFilter,
    referenceNow,
  );
  const metricCards = getDashboardMetricCards(
    initialData,
    range,
    courseFilter,
    referenceNow,
  );
  const recentUploadRows = getMaterialTableRows(filteredData, "newest").slice(0, 6);
  const feedItems = getRecentActivityFeedItems(filteredData, 6);
  const windowLabel = getDashboardWindowLabel(range, referenceNow);

  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-8">
      <section className="overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(255,253,249,0.98),rgba(237,244,239,0.95)_56%,rgba(244,139,154,0.1)_82%,rgba(207,177,119,0.12)_100%)] p-6 shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-strong)]">
              Academic Operations
            </p>
            <h1 className="mt-3 font-[family:var(--font-display)] text-[2.5rem] font-semibold tracking-[-0.05em] text-[color:var(--foreground)] sm:text-[3rem] sm:leading-[1.08]">
              Dashboard overview
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-[color:var(--muted-strong)]">
              Track uploads, processing throughput, and export readiness through
              the same visual system as the rest of the product. Every metric on
              this page is derived from structured helpers and starts in a clean
              zero state until API data arrives.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-full bg-[color:var(--surface-subtle)] p-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setRange(option.value);
                  }}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    option.value === range
                      ? "bg-[linear-gradient(135deg,var(--accent),#5CA484)] text-white shadow-[var(--shadow-button)]"
                      : "text-[color:var(--muted-strong)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),#5CA484)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
            >
              Upload material
            </Link>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DashboardSelect
            id="course-filter"
            label="Filter by course"
            value={courseFilter}
            onChange={setCourseFilter}
            options={[
              { label: "All courses", value: "all" },
              ...courseOptions.map((course) => ({
                label: course,
                value: course,
              })),
            ]}
          />

          <div className="rounded-2xl border border-[color:var(--line)] bg-[linear-gradient(135deg,rgba(255,253,249,0.88),rgba(244,139,154,0.12))] px-4 py-3 text-sm text-[color:var(--muted-strong)]">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Active window
            </span>
            <span className="mt-1 block font-medium text-[color:var(--foreground)]">
              {windowLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = metricIcons[card.id as keyof typeof metricIcons];

          return <DashboardMetricCard key={card.id} {...card} icon={Icon} />;
        })}
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <DashboardRecentUploadsTable
          rows={recentUploadRows}
        />

        <DashboardActivityFeed items={feedItems} />
      </section>
    </div>
  );
}

type DashboardSelectProps = {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
};

function DashboardSelect({
  id,
  label,
  onChange,
  options,
  value,
}: DashboardSelectProps) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="relative min-w-[190px]">
        <select
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-12 w-full appearance-none rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-subtle)] px-4 pr-10 text-sm font-medium text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:bg-white focus:ring-2 focus:ring-[color:var(--accent-soft)]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
      </div>
    </label>
  );
}
