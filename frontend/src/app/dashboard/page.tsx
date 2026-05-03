import type { Metadata } from "next";

import { DashboardClientPage } from "@/components/dashboard/DashboardClientPage";

export const metadata: Metadata = {
  title: "Dashboard | Curriculum Updater",
  description: "Project dashboard for academic materials and AI-assisted workflows.",
};

export default function DashboardPage() {
  return <DashboardClientPage />;
}
