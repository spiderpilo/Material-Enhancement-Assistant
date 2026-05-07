import type { Metadata } from "next";

import { MaterialEnhancementWorkspace } from "@/components/material-enhancement/MaterialEnhancementWorkspace";

export const metadata: Metadata = {
  title: "Project Workspace | Curriculum Updater",
  description: "Project workspace for materials, previews, recommendations, and AI tools.",
};

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectUuid: string }>;
}) {
  const { projectUuid } = await params;
  return <MaterialEnhancementWorkspace projectUuid={projectUuid} />;
}
