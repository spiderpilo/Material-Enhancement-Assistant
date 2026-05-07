"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import {
  DashboardCreateProjectCard,
  DashboardProjectCard,
  DashboardProjectSkeletonCard,
  type DashboardProjectCardData,
} from "@/components/dashboard/DashboardProjectCard";
import {
  AddIcon,
  ClarityIcon,
  CloseIcon,
  FileIcon,
  ProjectLogoIcon,
  QuizIcon,
  SummaryIcon,
  VisualsIcon,
} from "@/components/material-enhancement/icons";
import { getStoredAccessToken } from "@/lib/api/auth";
import {
  deleteProject,
  listProjects,
  type ProjectSummary,
  updateProjectTitle,
} from "@/lib/api/projects";

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
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingProjectUuid, setEditingProjectUuid] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [editProjectErrorMessage, setEditProjectErrorMessage] = useState<string | null>(null);
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);
  const [deletingProjectUuid, setDeletingProjectUuid] = useState<string | null>(null);
  const [deleteProjectErrorMessage, setDeleteProjectErrorMessage] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadProjects({ showLoadingIndicator }: { showLoadingIndicator: boolean }) {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        if (!isCancelled) {
          setIsLoadingProjects(false);
        }
        return;
      }

      if (showLoadingIndicator) {
        setIsLoadingProjects(true);
      }

      try {
        const nextProjects = await listProjects(accessToken);

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
        if (!isCancelled && showLoadingIndicator) {
          setIsLoadingProjects(false);
        }
      }
    }

    void loadProjects({ showLoadingIndicator: true });

    const handleWindowFocus = () => {
      void loadProjects({ showLoadingIndicator: false });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadProjects({ showLoadingIndicator: false });
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  const editingProject =
    projects.find((project) => project.project_uuid === editingProjectUuid) ?? null;
  const deletingProject =
    projects.find((project) => project.project_uuid === deletingProjectUuid) ?? null;

  const handleOpenEditProject = (projectUuid: string) => {
    const project = projects.find((item) => item.project_uuid === projectUuid);
    if (!project) {
      setToastMessage("Project not found.");
      return;
    }

    setEditingProjectUuid(projectUuid);
    setEditingProjectName(project.name.trim() || "Untitled project");
    setEditProjectErrorMessage(null);
  };

  const handleCloseEditProject = () => {
    setEditingProjectUuid(null);
    setEditingProjectName("");
    setEditProjectErrorMessage(null);
  };

  const handleSaveProjectTitle = async () => {
    const projectUuid = editingProjectUuid;
    if (!projectUuid) {
      return;
    }

    const trimmedName = editingProjectName.trim();
    if (!trimmedName) {
      setEditProjectErrorMessage("Project title is required.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setEditProjectErrorMessage("Sign in before editing a project.");
      return;
    }

    setIsSavingProjectName(true);
    setEditProjectErrorMessage(null);

    try {
      const updatedProject = await updateProjectTitle({
        accessToken,
        projectUuid,
        name: trimmedName,
      });

      setProjects((currentProjects) =>
        sortProjectsByFreshness(
          currentProjects.map((project) =>
            project.project_uuid === projectUuid
              ? {
                  ...project,
                  name: updatedProject.name,
                  updated_at: updatedProject.updated_at ?? project.updated_at,
                  last_updated: updatedProject.last_updated ?? project.last_updated,
                  material_count: updatedProject.material_count,
                }
              : project,
          ),
        ),
      );
      setToastMessage(`Project renamed to "${updatedProject.name}".`);
      handleCloseEditProject();
    } catch (cause) {
      setEditProjectErrorMessage(
        cause instanceof Error ? cause.message : "Unable to update project title.",
      );
    } finally {
      setIsSavingProjectName(false);
    }
  };

  const handleOpenDeleteProject = (projectUuid: string) => {
    const project = projects.find((item) => item.project_uuid === projectUuid);
    if (!project) {
      setToastMessage("Project not found.");
      return;
    }

    setDeletingProjectUuid(projectUuid);
    setDeleteProjectErrorMessage(null);
  };

  const handleCloseDeleteProject = () => {
    setDeletingProjectUuid(null);
    setDeleteProjectErrorMessage(null);
  };

  const handleConfirmDeleteProject = async () => {
    const projectUuid = deletingProjectUuid;
    if (!projectUuid) {
      return;
    }

    const project = projects.find((item) => item.project_uuid === projectUuid);
    if (!project) {
      setDeleteProjectErrorMessage("Project not found.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setDeleteProjectErrorMessage("Sign in before deleting a project.");
      return;
    }

    setIsDeletingProject(true);
    setDeleteProjectErrorMessage(null);

    try {
      await deleteProject({ accessToken, projectUuid });
      setProjects((currentProjects) =>
        currentProjects.filter((item) => item.project_uuid !== projectUuid),
      );
      setToastMessage(`Project "${project.name.trim() || "Untitled project"}" deleted.`);
      handleCloseDeleteProject();
    } catch (cause) {
      setDeleteProjectErrorMessage(
        cause instanceof Error ? cause.message : "Unable to delete project.",
      );
    } finally {
      setIsDeletingProject(false);
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
            onClick={() => router.push("/project")}
            className="dashboard-action-button group inline-flex h-[46px] shrink-0 items-center gap-2 self-start rounded-full px-6 text-[14px] font-semibold text-[#425731] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.24)]"
            style={displayFontStyle}
          >
            <AddIcon className="relative h-[14px] w-[14px]" />
            <span className="relative">Create new</span>
          </button>
          </div>
        </section>

        <h2 className="text-[20px] font-semibold text-[#d7ebbd]">Recent Projects</h2>

        <section className={`grid gap-5 sm:grid-cols-2 ${dashboardDesktopGrid}`}>
          <DashboardCreateProjectCard
            onClick={() => router.push("/project")}
          />

          {isLoadingProjects
            ? Array.from({ length: projectSkeletonCount }).map((_, index) => (
                <DashboardProjectSkeletonCard key={index} />
              ))
            : projectCards.map((project) => (
                <DashboardProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleOpenDeleteProject}
                  onEditTitle={handleOpenEditProject}
                />
              ))}
        </section>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50 max-w-[360px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%),linear-gradient(145deg,rgba(31,32,28,0.88)_0%,rgba(18,20,16,0.76)_100%)] px-4 py-3 text-[13px] text-[#e9e9e2] shadow-[0_24px_52px_rgba(0,0,0,0.34)] backdrop-blur-[22px]">
          {toastMessage}
        </div>
      ) : null}

      <ProjectRenameModal
        errorMessage={editProjectErrorMessage}
        isOpen={editingProject !== null}
        isSaving={isSavingProjectName}
        projectName={editingProjectName}
        onClose={handleCloseEditProject}
        onProjectNameChange={(nextProjectName) => {
          setEditingProjectName(nextProjectName);
          setEditProjectErrorMessage(null);
        }}
        onSave={handleSaveProjectTitle}
      />

      <ProjectDeleteModal
        errorMessage={deleteProjectErrorMessage}
        isDeleting={isDeletingProject}
        isOpen={deletingProject !== null}
        projectName={deletingProject?.name ?? ""}
        onClose={handleCloseDeleteProject}
        onConfirmDelete={handleConfirmDeleteProject}
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

function ProjectRenameModal({
  errorMessage,
  isOpen,
  isSaving,
  projectName,
  onClose,
  onProjectNameChange,
  onSave,
}: {
  errorMessage: string | null;
  isOpen: boolean;
  isSaving: boolean;
  projectName: string;
  onClose: () => void;
  onProjectNameChange: (nextProjectName: string) => void;
  onSave: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-[linear-gradient(180deg,rgba(3,4,7,0.72)_0%,rgba(8,9,13,0.8)_100%)] px-6 py-8 backdrop-blur-[20px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-project-modal-title"
        className="relative w-full max-w-[540px] overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(33,33,39,0.94)_0%,rgba(18,18,22,0.98)_100%)] px-8 pb-8 pt-7 shadow-[0_38px_110px_rgba(0,0,0,0.56)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(440px_220px_at_82%_-4%,rgba(255,255,255,0.08),transparent_72%),radial-gradient(360px_220px_at_18%_104%,rgba(184,219,128,0.1),transparent_70%)]" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h2
              id="rename-project-modal-title"
              className="text-[20px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]"
            >
              Edit project title
            </h2>
            <p className="mt-2 text-[13px] leading-[21px] text-[color:var(--text-muted)]">
              Update the dashboard title shown for this project.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close rename dialog"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[rgba(214,211,209,0.72)] transition hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CloseIcon className="h-[16px] w-[16px]" />
          </button>
        </div>

        <div className="relative mt-6">
          <label
            htmlFor="rename-project-input"
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]"
          >
            Project name
          </label>

          <input
            id="rename-project-input"
            type="text"
            autoFocus
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
            aria-invalid={Boolean(errorMessage)}
            className={[
              "mt-3 h-12 w-full rounded-[16px] border bg-[rgba(255,255,255,0.05)] px-4 text-[14px] text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition duration-200 placeholder:text-[rgba(168,162,158,0.75)]",
              errorMessage
                ? "border-[rgba(243,158,182,0.42)] focus:border-[rgba(243,158,182,0.5)] focus:ring-2 focus:ring-[rgba(243,158,182,0.18)]"
                : "border-[rgba(255,255,255,0.09)] focus:border-[rgba(184,219,128,0.36)] focus:ring-2 focus:ring-[rgba(184,219,128,0.16)]",
            ].join(" ")}
          />

          {errorMessage ? (
            <p className="mt-2 text-[12px] text-[rgba(243,158,182,0.92)]">{errorMessage}</p>
          ) : null}
        </div>

        <div className="relative mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 text-[14px] font-medium text-[color:var(--text-secondary)] transition hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#DDF598_0%,#D0F07E_100%)] px-6 text-[14px] font-semibold text-[#10120E] shadow-[0_20px_34px_rgba(143,173,73,0.2)] transition hover:-translate-y-0.5 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save title"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ProjectDeleteModal({
  errorMessage,
  isDeleting,
  isOpen,
  projectName,
  onClose,
  onConfirmDelete,
}: {
  errorMessage: string | null;
  isDeleting: boolean;
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const projectTitle = projectName.trim() || "Untitled project";

  return (
    <div
      className="fixed inset-0 z-[126] flex items-center justify-center bg-[linear-gradient(180deg,rgba(3,4,7,0.78)_0%,rgba(8,9,13,0.84)_100%)] px-6 py-8 backdrop-blur-[20px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-project-modal-title"
        className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(33,26,30,0.95)_0%,rgba(19,15,18,0.98)_100%)] px-8 pb-8 pt-7 shadow-[0_38px_110px_rgba(0,0,0,0.6)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_220px_at_92%_-4%,rgba(255,205,220,0.12),transparent_74%),radial-gradient(360px_220px_at_8%_102%,rgba(242,120,154,0.12),transparent_72%)]" />

        <div className="relative">
          <h2
            id="delete-project-modal-title"
            className="text-[20px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]"
          >
            Delete project
          </h2>
          <p className="mt-3 text-[14px] leading-[22px] text-[color:var(--text-muted)]">
            <span className="font-semibold text-[#ffe3ea]">{projectTitle}</span> will be permanently
            deleted. This action cannot be undone.
          </p>
          {errorMessage ? (
            <p className="mt-3 text-[12px] text-[rgba(243,158,182,0.92)]">{errorMessage}</p>
          ) : null}
        </div>

        <div className="relative mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 text-[14px] font-medium text-[color:var(--text-secondary)] transition hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-full border border-[rgba(242,120,154,0.4)] bg-[linear-gradient(180deg,rgba(255,180,204,0.95)_0%,rgba(242,120,154,0.92)_100%)] px-6 text-[14px] font-semibold text-[#2a0f17] shadow-[0_20px_34px_rgba(242,120,154,0.24)] transition hover:-translate-y-0.5 hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,190,214,0.4)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </section>
    </div>
  );
}
