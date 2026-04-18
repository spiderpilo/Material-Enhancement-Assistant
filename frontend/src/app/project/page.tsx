import type { Metadata } from "next";

import { MaterialEnhancementWorkspace } from "@/components/material-enhancement/MaterialEnhancementWorkspace";

export const metadata: Metadata = {
  title: "Project Page | Material Enhancement Assistant",
  description: "Project workspace for materials, previews, recommendations, and AI tools.",
};

export default function ProjectPage() {
  return <MaterialEnhancementWorkspace />;
}
