export type DashboardRange = "7d" | "30d" | "90d";
export type DashboardMaterialSort = "newest" | "oldest" | "status";

export type DashboardMaterialStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "ready"
  | "flagged";

export type DashboardMaterialType =
  | "slides"
  | "reading"
  | "notes"
  | "assessment"
  | "other";

export type DashboardExportStatus = "queued" | "completed" | "failed";
export type DashboardActivityKind = "upload" | "analysis" | "review" | "export";

export interface DashboardMaterial {
  id: string;
  title?: string | null;
  courseName?: string | null;
  type?: DashboardMaterialType | null;
  status?: DashboardMaterialStatus | null;
  uploadedAt?: string | null;
  processedAt?: string | null;
  analysisDurationMinutes?: number | null;
  issueCount?: number | null;
}

export interface DashboardExport {
  id: string;
  label?: string | null;
  courseName?: string | null;
  format?: string | null;
  status?: DashboardExportStatus | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  durationMinutes?: number | null;
}

export interface DashboardActivity {
  id: string;
  kind?: DashboardActivityKind | null;
  label?: string | null;
  description?: string | null;
  courseName?: string | null;
  createdAt?: string | null;
  status?: string | null;
}

export interface DashboardData {
  materials: DashboardMaterial[];
  exports: DashboardExport[];
  activities: DashboardActivity[];
}

export interface DashboardMetricCardValue {
  id: string;
  label: string;
  value: string;
  detail: string;
  trendLabel: string;
  trendDirection: "up" | "down" | "flat";
}

export interface DashboardMaterialRow {
  id: string;
  title: string;
  courseLabel: string;
  typeLabel: string;
  statusLabel: string;
  uploadedLabel: string;
  cycleTimeLabel: string;
  status: DashboardMaterialStatus;
  uploadedTimestamp: number;
  cycleTimeMinutes: number;
}

export interface DashboardActivityFeedItem {
  id: string;
  title: string;
  description: string;
  timestampLabel: string;
  kindLabel: string;
  tone: "accent" | "warning" | "neutral";
  createdTimestamp: number;
}
