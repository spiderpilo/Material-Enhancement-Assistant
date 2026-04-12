import {
  formatDashboardCount,
  formatDashboardDate,
  formatDashboardDateRange,
  formatDashboardDurationMinutes,
  formatDashboardPercent,
  formatDashboardTrendLabel,
  formatMaterialStatusLabel,
  formatMaterialTypeLabel,
} from "@/lib/dashboard/formatters";
import type {
  DashboardActivityFeedItem,
  DashboardData,
  DashboardExportStatus,
  DashboardMaterial,
  DashboardMaterialRow,
  DashboardMaterialSort,
  DashboardMaterialStatus,
  DashboardMetricCardValue,
  DashboardRange,
} from "@/lib/dashboard/types";

type TimeWindow = {
  start: Date;
  end: Date;
};

type RangeConfig = {
  bucketCount: number;
  bucketSizeDays: number;
};

const RANGE_CONFIG: Record<DashboardRange, RangeConfig> = {
  "7d": { bucketCount: 7, bucketSizeDays: 1 },
  "30d": { bucketCount: 6, bucketSizeDays: 5 },
  "90d": { bucketCount: 6, bucketSizeDays: 15 },
};

const MATERIAL_STATUS_SORT_ORDER: Record<DashboardMaterialStatus, number> = {
  ready: 0,
  processing: 1,
  queued: 2,
  uploaded: 3,
  flagged: 4,
};

function safeDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function normalizeCourseLabel(value?: string | null) {
  return value?.trim() || "Unassigned Course";
}

function normalizeMaterialStatus(
  value?: DashboardMaterialStatus | null,
): DashboardMaterialStatus {
  return value ?? "uploaded";
}

function normalizeExportStatus(value?: DashboardExportStatus | null) {
  return value ?? "queued";
}

function createWindow(range: DashboardRange, now = new Date()): TimeWindow {
  const config = RANGE_CONFIG[range];
  const end = endOfDay(now);
  const spanDays = config.bucketCount * config.bucketSizeDays;
  const start = startOfDay(addDays(end, -(spanDays - 1)));

  return { start, end };
}

function createPreviousWindow(range: DashboardRange, now = new Date()): TimeWindow {
  const currentWindow = createWindow(range, now);
  const config = RANGE_CONFIG[range];
  const spanDays = config.bucketCount * config.bucketSizeDays;
  const end = endOfDay(addDays(currentWindow.start, -1));
  const start = startOfDay(addDays(end, -(spanDays - 1)));

  return { start, end };
}

function isWithinWindow(date: Date | null, window: TimeWindow) {
  if (!date) {
    return false;
  }

  return date >= window.start && date <= window.end;
}

function materialMatchesWindow(material: DashboardMaterial, window: TimeWindow) {
  return (
    isWithinWindow(safeDate(material.uploadedAt), window) ||
    isWithinWindow(safeDate(material.processedAt), window)
  );
}

function compareNumbersDesc(left: number, right: number) {
  return right - left;
}

function compareNumbersAsc(left: number, right: number) {
  return left - right;
}

function calculateAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function getDashboardWindowLabel(range: DashboardRange, now = new Date()) {
  const { start, end } = createWindow(range, now);
  return formatDashboardDateRange(start.toISOString(), end.toISOString());
}

export function getDashboardCourseOptions(data: DashboardData) {
  return Array.from(
    new Set([
      ...data.materials.map((item) => normalizeCourseLabel(item.courseName)),
      ...data.exports.map((item) => normalizeCourseLabel(item.courseName)),
      ...data.activities.map((item) => normalizeCourseLabel(item.courseName)),
    ]),
  ).sort((left, right) => left.localeCompare(right));
}

export function filterDashboardData(
  data: DashboardData,
  range: DashboardRange,
  courseName: string,
  now = new Date(),
): DashboardData {
  const window = createWindow(range, now);
  const matchesCourse = (value?: string | null) =>
    courseName === "all" || normalizeCourseLabel(value) === courseName;

  return {
    materials: data.materials.filter(
      (item) => matchesCourse(item.courseName) && materialMatchesWindow(item, window),
    ),
    exports: data.exports.filter(
      (item) =>
        matchesCourse(item.courseName) &&
        (isWithinWindow(safeDate(item.requestedAt), window) ||
          isWithinWindow(safeDate(item.completedAt), window)),
    ),
    activities: data.activities.filter(
      (item) =>
        matchesCourse(item.courseName) &&
        isWithinWindow(safeDate(item.createdAt), window),
    ),
  };
}

export function getTotalMaterialCount(data: DashboardData) {
  return data.materials.length;
}

export function getReadyMaterialCount(data: DashboardData) {
  return data.materials.filter(
    (item) => normalizeMaterialStatus(item.status) === "ready",
  ).length;
}

export function getQueuedMaterialCount(data: DashboardData) {
  return data.materials.filter((item) =>
    ["uploaded", "queued", "processing"].includes(normalizeMaterialStatus(item.status)),
  ).length;
}

export function getFlaggedMaterialCount(data: DashboardData) {
  return data.materials.filter(
    (item) => normalizeMaterialStatus(item.status) === "flagged",
  ).length;
}

export function getCourseCount(data: DashboardData) {
  return new Set(
    data.materials.map((item) => normalizeCourseLabel(item.courseName)),
  ).size;
}

export function getAverageAnalysisDurationMinutes(data: DashboardData) {
  const durations = data.materials
    .map((item) => item.analysisDurationMinutes ?? 0)
    .filter((value) => value > 0);

  return calculateAverage(durations);
}

export function getExportCount(data: DashboardData) {
  return data.exports.length;
}

export function getCompletedExportCount(data: DashboardData) {
  return data.exports.filter(
    (item) => normalizeExportStatus(item.status) === "completed",
  ).length;
}

export function getExportSuccessRate(data: DashboardData) {
  const total = getExportCount(data);

  if (total === 0) {
    return 0;
  }

  return (getCompletedExportCount(data) / total) * 100;
}

export function getMaterialCompletionRate(data: DashboardData) {
  const total = getTotalMaterialCount(data);

  if (total === 0) {
    return 0;
  }

  return (getReadyMaterialCount(data) / total) * 100;
}

export function calculateTrendPercentage(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function getTrendDirection(value: number): "up" | "down" | "flat" {
  if (value > 0) {
    return "up";
  }

  if (value < 0) {
    return "down";
  }

  return "flat";
}

function buildMetricCardValue(
  label: string,
  value: string,
  detail: string,
  currentMetric: number,
  previousMetric: number,
  id: string,
): DashboardMetricCardValue {
  const trend = calculateTrendPercentage(currentMetric, previousMetric);

  return {
    id,
    label,
    value,
    detail,
    trendLabel: formatDashboardTrendLabel(trend),
    trendDirection: getTrendDirection(trend),
  };
}

export function getDashboardMetricCards(
  allData: DashboardData,
  range: DashboardRange,
  courseName: string,
  now = new Date(),
): DashboardMetricCardValue[] {
  const currentData = filterDashboardData(allData, range, courseName, now);
  const previousWindow = createPreviousWindow(range, now);
  const previousData = {
    materials: allData.materials.filter(
      (item) =>
        (courseName === "all" ||
          normalizeCourseLabel(item.courseName) === courseName) &&
        materialMatchesWindow(item, previousWindow),
    ),
    exports: allData.exports.filter(
      (item) =>
        (courseName === "all" ||
          normalizeCourseLabel(item.courseName) === courseName) &&
        (isWithinWindow(safeDate(item.requestedAt), previousWindow) ||
          isWithinWindow(safeDate(item.completedAt), previousWindow)),
    ),
    activities: allData.activities.filter(
      (item) =>
        (courseName === "all" ||
          normalizeCourseLabel(item.courseName) === courseName) &&
        isWithinWindow(safeDate(item.createdAt), previousWindow),
    ),
  };

  const totalMaterials = getTotalMaterialCount(currentData);
  const previousMaterials = getTotalMaterialCount(previousData);
  const readyMaterials = getReadyMaterialCount(currentData);
  const previousReadyMaterials = getReadyMaterialCount(previousData);
  const averageDuration = getAverageAnalysisDurationMinutes(currentData);
  const previousAverageDuration = getAverageAnalysisDurationMinutes(previousData);
  const exportSuccessRate = getExportSuccessRate(currentData);
  const previousExportSuccessRate = getExportSuccessRate(previousData);

  return [
    buildMetricCardValue(
      "Materials in scope",
      formatDashboardCount(totalMaterials),
      `${formatDashboardCount(getCourseCount(currentData))} courses represented`,
      totalMaterials,
      previousMaterials,
      "materials",
    ),
    buildMetricCardValue(
      "Ready for review",
      formatDashboardCount(readyMaterials),
      `${formatDashboardCount(getQueuedMaterialCount(currentData))} still in flow`,
      readyMaterials,
      previousReadyMaterials,
      "ready",
    ),
    buildMetricCardValue(
      "Average cycle time",
      formatDashboardDurationMinutes(averageDuration),
      `${formatDashboardCount(getFlaggedMaterialCount(currentData))} flagged for follow-up`,
      averageDuration,
      previousAverageDuration,
      "cycleTime",
    ),
    buildMetricCardValue(
      "Export success",
      formatDashboardPercent(exportSuccessRate),
      `${formatDashboardCount(getCompletedExportCount(currentData))} completed exports`,
      exportSuccessRate,
      previousExportSuccessRate,
      "exports",
    ),
  ];
}

export function getMaterialTableRows(
  data: DashboardData,
  sort: DashboardMaterialSort = "newest",
): DashboardMaterialRow[] {
  const rows = data.materials.map((item) => {
    const status = normalizeMaterialStatus(item.status);
    const uploadedTimestamp = safeDate(item.uploadedAt)?.getTime() ?? 0;
    const cycleTimeMinutes = Math.max(0, item.analysisDurationMinutes ?? 0);

    return {
      id: item.id,
      title: item.title?.trim() || "Untitled material",
      courseLabel: normalizeCourseLabel(item.courseName),
      typeLabel: formatMaterialTypeLabel(item.type),
      statusLabel: formatMaterialStatusLabel(status),
      uploadedLabel: formatDashboardDate(item.uploadedAt),
      cycleTimeLabel: formatDashboardDurationMinutes(cycleTimeMinutes),
      status,
      uploadedTimestamp,
      cycleTimeMinutes,
    };
  });

  return rows.sort((left, right) => {
    if (sort === "oldest") {
      return (
        compareNumbersAsc(left.uploadedTimestamp, right.uploadedTimestamp) ||
        left.title.localeCompare(right.title)
      );
    }

    if (sort === "status") {
      return (
        compareNumbersAsc(
          MATERIAL_STATUS_SORT_ORDER[left.status],
          MATERIAL_STATUS_SORT_ORDER[right.status],
        ) || left.title.localeCompare(right.title)
      );
    }

    return (
      compareNumbersDesc(left.uploadedTimestamp, right.uploadedTimestamp) ||
      left.title.localeCompare(right.title)
    );
  });
}

function buildActivityItemTone(
  kindLabel: string,
  description: string,
): DashboardActivityFeedItem["tone"] {
  const lowerKind = kindLabel.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (
    lowerKind.includes("flag") ||
    lowerKind.includes("failed") ||
    lowerDescription.includes("flagged") ||
    lowerDescription.includes("failed")
  ) {
    return "warning" as const;
  }

  if (
    lowerKind.includes("ready") ||
    lowerKind.includes("completed") ||
    lowerDescription.includes("completed") ||
    lowerDescription.includes("ready")
  ) {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function getRecentActivityFeedItems(
  data: DashboardData,
  limit = 6,
): DashboardActivityFeedItem[] {
  const explicitActivityItems: DashboardActivityFeedItem[] = data.activities.map(
    (item) => {
      const title = item.label?.trim() || "System activity";
      const description = item.description?.trim() || "No additional detail yet.";

      return {
        id: item.id,
        title,
        description,
        timestampLabel: formatDashboardDate(item.createdAt),
        kindLabel: item.kind?.trim() || "Activity",
        tone: buildActivityItemTone(item.kind ?? "", description),
        createdTimestamp: safeDate(item.createdAt)?.getTime() ?? 0,
      };
    },
  );

  const materialActivityItems: DashboardActivityFeedItem[] = data.materials.flatMap(
    (item) => {
      const courseLabel = normalizeCourseLabel(item.courseName);
      const materialTitle = item.title?.trim() || "Untitled material";
      const materialStatus = normalizeMaterialStatus(item.status);
      const processedTone: DashboardActivityFeedItem["tone"] =
        materialStatus === "flagged"
          ? "warning"
          : materialStatus === "ready"
            ? "accent"
            : "neutral";
      const processedKindLabel =
        materialStatus === "ready"
          ? "Ready"
          : materialStatus === "flagged"
            ? "Flagged"
            : "Analysis";
      const processedDescription =
        materialStatus === "ready"
          ? `Ready for review in ${courseLabel}.`
          : materialStatus === "flagged"
            ? `Flagged for follow-up in ${courseLabel}.`
            : `Processing in ${courseLabel}.`;
      const entries: DashboardActivityFeedItem[] = [
        {
          id: `upload-${item.id}`,
          title: materialTitle,
          description: `Uploaded to ${courseLabel}.`,
          timestampLabel: formatDashboardDate(item.uploadedAt),
          kindLabel: "Upload",
          tone: "neutral",
          createdTimestamp: safeDate(item.uploadedAt)?.getTime() ?? 0,
        },
        {
          id: `ready-${item.id}`,
          title: materialTitle,
          description: processedDescription,
          timestampLabel: formatDashboardDate(item.processedAt),
          kindLabel: processedKindLabel,
          tone: processedTone,
          createdTimestamp: safeDate(item.processedAt)?.getTime() ?? 0,
        },
      ];

      return entries.filter((entry) => entry.createdTimestamp > 0);
    },
  );

  const exportActivityItems: DashboardActivityFeedItem[] = data.exports.flatMap(
    (item) => {
      const courseLabel = normalizeCourseLabel(item.courseName);
      const exportLabel = item.label?.trim() || "Untitled export";
      const status = normalizeExportStatus(item.status);
      const completionTone: DashboardActivityFeedItem["tone"] =
        status === "completed" ? "accent" : "warning";
      const entries: DashboardActivityFeedItem[] = [
        {
          id: `export-request-${item.id}`,
          title: exportLabel,
          description: `Requested for ${courseLabel}.`,
          timestampLabel: formatDashboardDate(item.requestedAt),
          kindLabel: "Export queued",
          tone: "neutral",
          createdTimestamp: safeDate(item.requestedAt)?.getTime() ?? 0,
        },
        {
          id: `export-complete-${item.id}`,
          title: exportLabel,
          description:
            status === "completed"
              ? `Completed for ${courseLabel}.`
              : `Failed for ${courseLabel}.`,
          timestampLabel: formatDashboardDate(item.completedAt),
          kindLabel: status === "completed" ? "Export completed" : "Export failed",
          tone: completionTone,
          createdTimestamp: safeDate(item.completedAt)?.getTime() ?? 0,
        },
      ];

      return entries.filter((entry) => entry.createdTimestamp > 0);
    },
  );

  const feed: DashboardActivityFeedItem[] = [
    ...explicitActivityItems,
    ...materialActivityItems,
    ...exportActivityItems,
  ];

  return feed
    .sort(
      (left, right) =>
        compareNumbersDesc(left.createdTimestamp, right.createdTimestamp) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, limit);
}

export function getMaterialStatusTone(status: DashboardMaterialStatus) {
  if (status === "ready") {
    return "accent" as const;
  }

  if (status === "flagged") {
    return "warning" as const;
  }

  return "neutral" as const;
}
