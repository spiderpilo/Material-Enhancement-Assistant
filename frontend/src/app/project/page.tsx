"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getStoredAccessToken } from "@/lib/api/auth";
import { createProject, type ProjectSummary } from "@/lib/api/projects";

let inFlightProjectCreation:
  | { accessToken: string; request: Promise<ProjectSummary> }
  | null = null;

function getOrStartProjectCreation(accessToken: string): Promise<ProjectSummary> {
  if (
    inFlightProjectCreation &&
    inFlightProjectCreation.accessToken === accessToken
  ) {
    return inFlightProjectCreation.request;
  }

  const request = createProject({ accessToken }).finally(() => {
    if (inFlightProjectCreation?.request === request) {
      inFlightProjectCreation = null;
    }
  });

  inFlightProjectCreation = { accessToken, request };
  return request;
}

export default function ProjectCompatibilityPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Creating your project...");

  useEffect(() => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    let isCancelled = false;

    async function redirectToProject() {
      try {
        const createdProject = await getOrStartProjectCreation(accessToken);
        router.replace(`/project/${createdProject.project_uuid}`);
      } catch (cause) {
        if (!isCancelled) {
          setStatusMessage(
            cause instanceof Error ? cause.message : "Unable to open a project right now.",
          );
        }
      }
    }

    void redirectToProject();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-[color:var(--text-secondary,#d2d5c8)]">{statusMessage}</p>
    </main>
  );
}
