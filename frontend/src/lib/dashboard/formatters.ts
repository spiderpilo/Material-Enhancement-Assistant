import type {
  DashboardExportStatus,
  DashboardMaterialStatus,
  DashboardMaterialType,
} from "@/lib/dashboard/types";

const countFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

function safeDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDashboardCount(value: number) {
  return countFormatter.format(Math.max(0, Math.round(value)));
}

export function formatDashboardPercent(value: number) {
  return `${percentFormatter.format(Math.max(0, value))}%`;
}

export function formatDashboardDurationMinutes(value: number) {
  const minutes = Math.max(0, Math.round(value));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function formatDashboardTrendLabel(value: number) {
  const rounded = Math.round(value);

  if (rounded === 0) {
    return "No change vs previous window";
  }

  return `${rounded > 0 ? "+" : ""}${rounded}% vs previous window`;
}

export function formatDashboardDate(value?: string | null) {
  const parsed = safeDate(value);
  return parsed ? longDateFormatter.format(parsed) : "No date";
}

export function formatDashboardWeekday(value?: string | null) {
  const parsed = safeDate(value);
  return parsed ? weekdayFormatter.format(parsed) : "Now";
}

export function formatDashboardDateRange(
  startDate?: string | null,
  endDate?: string | null,
) {
  const start = safeDate(startDate);
  const end = safeDate(endDate);

  if (!start || !end) {
    return "No activity";
  }

  return `${longDateFormatter.format(start)} - ${longDateFormatter.format(end)}`;
}

export function formatMaterialStatusLabel(status?: DashboardMaterialStatus | null) {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "queued":
      return "Queued";
    case "processing":
      return "Processing";
    case "ready":
      return "Ready";
    case "flagged":
      return "Flagged";
    default:
      return "Unknown";
  }
}

export function formatMaterialTypeLabel(type?: DashboardMaterialType | null) {
  switch (type) {
    case "slides":
      return "Slides";
    case "reading":
      return "Reading";
    case "notes":
      return "Notes";
    case "assessment":
      return "Assessment";
    case "other":
      return "Other";
    default:
      return "Unspecified";
  }
}

export function formatExportStatusLabel(status?: DashboardExportStatus | null) {
  switch (status) {
    case "queued":
      return "Queued";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

export function formatDashboardEmptyValue(
  value: string | number | null | undefined,
  fallback = "0",
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}
