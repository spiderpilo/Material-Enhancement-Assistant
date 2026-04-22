import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell/AppShell";
import { DashboardClientPage } from "@/components/dashboard/DashboardClientPage";
import { createEmptyDashboardData } from "@/lib/dashboard/default-data";

export const metadata: Metadata = {
  title: "Dashboard | Material Enhancement Assistant",
  description: "Operational dashboard for uploads, processing progress, and export readiness.",
};

export default function DashboardPage() {
  const dashboardData = createEmptyDashboardData();

  return (
    <AppShell
      activeNavItem="dashboard"
      headerTitle="Dashboard"
      showHeaderSearch={false}
    >
      <DashboardClientPage initialData={dashboardData} />
    </AppShell>
  );
}
