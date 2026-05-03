"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";

import {
  DashboardCreateProjectCard,
  DashboardProjectCard,
  DashboardProjectSkeletonCard,
  type DashboardProjectCardData,
} from "@/components/dashboard/DashboardProjectCard";
import {
  CreateProjectModal,
  type CreateProjectSubmitResult,
} from "@/components/material-enhancement/CreateProjectModal";
import {
  AddIcon,
  ClarityIcon,
  FileIcon,
  ProjectLogoIcon,
  QuizIcon,
  SummaryIcon,
  VisualsIcon,
} from "@/components/material-enhancement/icons";
import { getStoredAccessToken } from "@/lib/api/auth";
import { createProject, listProjects, type ProjectSummary } from "@/lib/api/projects";

const dashboardDesktopGrid =
  "xl:w-[1376px] xl:grid-cols-[289px_repeat(3,329px)] xl:auto-rows-[280px]";
const projectSkeletonCount = 4;

const displayFontStyle: CSSProperties = {
  fontFamily: '"Plus Jakarta Sans", Inter, "Segoe UI", sans-serif',
};

const projectCardIcons = [
  FileIcon,
  SummaryIcon,
  QuizIcon,
  VisualsIcon,
  ClarityIcon,
] as const;

export function DashboardClientPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      setIsLoadingProjects(false);
      return;
    }

    const signedInAccessToken = accessToken;
    let isCancelled = false;

    async function loadProjects() {
      setIsLoadingProjects(true);

      try {
        const nextProjects = await listProjects(signedInAccessToken);

        if (isCancelled) {
          return;
        }

        setProjects(sortProjectsByFreshness(nextProjects));
      } catch (cause) {
        if (!isCancelled) {
          setToastMessage(
            cause instanceof Error ? cause.message : "Unable to load your projects.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 3600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  const projectCards = mapProjectsToCards(projects);
  const recentProjects = sortProjectsByFreshness(projects).slice(0, 6);

  const handleCreateProjectSubmit = async ({
    projectName,
  }: {
    projectName: string;
  }): Promise<CreateProjectSubmitResult> => {
    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      return {
        success: false,
        errorMessage: "Sign in before creating a project.",
      };
    }

    try {
      const project = await createProject({ accessToken, name: projectName });
      setProjects((currentProjects) =>
        sortProjectsByFreshness([project, ...currentProjects]),
      );
      setToastMessage(`Project "${project.name}" created.`);
      return { success: true };
    } catch (cause) {
      return {
        success: false,
        errorMessage: cause instanceof Error ? cause.message : "Unable to create project.",
      };
    }
  };

  return (
    <main className="dashboard-premium min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-8 px-5 py-10 sm:px-8 sm:py-12 lg:gap-10">
        <DashboardBrandLockup />

        <section className="dashboard-hero-panel rounded-[32px] px-6 py-7 sm:px-8 sm:py-8 lg:px-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[925px]">
            <h1
              className="text-[2.5rem] font-semibold tracking-[-0.02em] text-[#d7ebbd] drop-shadow-[0_10px_24px_rgba(197,225,165,0.14)] sm:text-[40px] sm:leading-[48px]"
              style={displayFontStyle}
            >
              Dashboard
            </h1>
            <p className="mt-[8px] max-w-[48rem] text-[16px] leading-[25.6px] text-[#d2d5c8]">
              Manage your academic projects, research findings, and course
              materials in one focused environment.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateProjectModalOpen(true)}
            className="dashboard-action-button group inline-flex h-[46px] shrink-0 items-center gap-2 self-start rounded-full px-6 text-[14px] font-semibold text-[#425731] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.24)]"
            style={displayFontStyle}
          >
            <AddIcon className="relative h-[14px] w-[14px]" />
            <span className="relative">Create new</span>
          </button>
          </div>
        </section>

        <section className="dashboard-hero-panel rounded-[28px] px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-[22px] font-semibold tracking-[-0.02em] text-[#d7ebbd]"
              style={displayFontStyle}
            >
              Recent Projects
            </h2>
            <p className="text-[12px] uppercase tracking-[0.1em] text-[#cfd3c3]">
              Newest first
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            {recentProjects.length === 0 && !isLoadingProjects ? (
              <p className="text-[14px] text-[#cfd3c3]">No projects yet. Create one to get started.</p>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.project_uuid}
                  href={`/project/${project.project_uuid}`}
                  className="flex items-center justify-between rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-left transition hover:border-[rgba(197,225,165,0.24)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <span className="truncate text-[15px] font-medium text-[#eef0e7]">
                    {project.name.trim() || "Untitled project"}
                  </span>
                  <span className="ml-3 shrink-0 text-[12px] text-[#cfd3c3]">
                    {formatProjectUpdatedLabel(project.last_updated ?? project.updated_at ?? project.created_at)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className={`grid gap-5 sm:grid-cols-2 ${dashboardDesktopGrid}`}>
          <DashboardCreateProjectCard
            onClick={() => setIsCreateProjectModalOpen(true)}
          />

          {isLoadingProjects
            ? Array.from({ length: projectSkeletonCount }).map((_, index) => (
                <DashboardProjectSkeletonCard key={index} />
              ))
            : projectCards.map((project) => (
                <DashboardProjectCard key={project.id} project={project} />
              ))}
        </section>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50 max-w-[360px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%),linear-gradient(145deg,rgba(31,32,28,0.88)_0%,rgba(18,20,16,0.76)_100%)] px-4 py-3 text-[13px] text-[#e9e9e2] shadow-[0_24px_52px_rgba(0,0,0,0.34)] backdrop-blur-[22px]">
          {toastMessage}
        </div>
      ) : null}

      <CreateProjectModal
        initialProjectName=""
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreateProject={handleCreateProjectSubmit}
      />
    </main>
  );
}

function DashboardBrandLockup() {
  return (
    <div className="flex min-h-[77px] items-center gap-[18px]">
      <div className="flex h-[43px] w-[43px] shrink-0 items-center justify-center">
        <ProjectLogoIcon className="h-[43px] w-[43px]" />
      </div>

      <div
        className="max-w-[760px] text-[24px] font-semibold uppercase tracking-[0.14em] text-[#346739] [text-shadow:0_4px_4px_rgba(255,216,223,0.20)] sm:text-[22px] lg:text-[24px] xl:text-[26px]"
        style={displayFontStyle}
      >
        Curriculum Updater
      </div>
    </div>
  );
}

function mapProjectsToCards(projects: ProjectSummary[]): DashboardProjectCardData[] {
  return sortProjectsByFreshness(projects).map((project) => {
    const Icon = getProjectCardIcon(project);
    const sourceCount = Math.max(project.material_count, 0);

    return {
      href: `/project/${project.project_uuid}`,
      icon: Icon,
      id: project.project_uuid,
      sourceCountLabel: `${sourceCount} ${sourceCount === 1 ? "Source" : "Sources"}`,
      title: project.name.trim() || "Untitled project",
      updatedLabel: formatProjectUpdatedLabel(project.last_updated ?? project.updated_at ?? project.created_at),
    };
  });
}

function getProjectCardIcon(project: ProjectSummary) {
  const seed = `${project.project_uuid}-${project.name}`.split("").reduce((total, character) => {
    return total + character.charCodeAt(0);
  }, 0);

  return projectCardIcons[seed % projectCardIcons.length];
}

function sortProjectsByFreshness(projects: ProjectSummary[]) {
  return [...projects].sort((firstProject, secondProject) => {
    return getProjectFreshness(secondProject) - getProjectFreshness(firstProject);
  });
}

function getProjectFreshness(project: ProjectSummary) {
  const value = project.last_updated ?? project.updated_at ?? project.created_at ?? "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatProjectUpdatedLabel(value?: string | null) {
  if (!value) {
    return "Updated recently";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Updated recently";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const comparedDate = new Date(parsedDate);
  comparedDate.setHours(0, 0, 0, 0);

  const differenceInDays = Math.round(
    (today.getTime() - comparedDate.getTime()) / 86_400_000,
  );

  if (differenceInDays <= 0) {
    return "Updated today";
  }

  if (differenceInDays === 1) {
    return "Updated yesterday";
  }

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(parsedDate)}`;
}
