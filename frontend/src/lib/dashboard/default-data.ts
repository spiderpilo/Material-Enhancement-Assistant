import type { DashboardData } from "@/lib/dashboard/types";

export function createEmptyDashboardData(): DashboardData {
  return {
    materials: [],
    exports: [],
    activities: [],
  };
}
