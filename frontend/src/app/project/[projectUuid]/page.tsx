import type { Metadata } from "next";

import { MaterialEnhancementWorkspace } from "@/components/material-enhancement/MaterialEnhancementWorkspace";

export const metadata: Metadata = {
  title: "Project Workspace | Curriculum Updater",
  description: "Project workspace for materials, previews, recommendations, and AI tools.",
};

export default function ProjectWorkspacePage({
  params,
}: {
  params: { projectUuid: string };
}) {
  return <MaterialEnhancementWorkspace projectUuid={params.projectUuid} />;
}
