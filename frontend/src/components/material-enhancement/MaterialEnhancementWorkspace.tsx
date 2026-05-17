"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useRouter } from "next/navigation";

import {
  AddMaterialsModal,
  type AddMaterialsSubmitResult,
} from "@/components/material-enhancement/AddMaterialsModal";
import { AIToolsSidebar } from "@/components/material-enhancement/AIToolsSidebar";
import { MaterialsSidebar } from "@/components/material-enhancement/MaterialsSidebar";
import { PreviewWorkspace } from "@/components/material-enhancement/PreviewWorkspace";
import { ProjectHeader } from "@/components/material-enhancement/ProjectHeader";
import {
  type QuizGenerationStatus,
  type QuizViewMode,
} from "@/components/material-enhancement/QuizPanel";
import { generateQuiz, type GeneratedQuiz } from "@/lib/api/quiz";
import type {
  ActiveTool,
  Material,
  Recommendation,
} from "@/lib/material-enhancement/workspace";
import {
  applyPreviewManifestToMaterial,
  createMaterialFromCourseContentRecord,
  createMaterialFromProjectMaterialRecord,
  generateRecommendations,
  getMaterialBaseName,
  getSelectedMaterial,
  getSelectedPreviewItem,
  revokeMaterialObjectUrls,
  validateUpload,
} from "@/lib/material-enhancement/workspace";
import { getStoredAccessToken } from "@/lib/api/auth";
import {
  deleteCourseContent,
  getCourseContentPreview,
  renameCourseContent,
  uploadCourseContent,
} from "@/lib/api/course-content";
import {
  getProject,
  type Project,
  updateProjectTitle,
} from "@/lib/api/projects";

const EXPANDED_LEFT_GRID_COLUMNS = "320px";
const COLLAPSED_LEFT_GRID_COLUMNS = "84px";
const STUDIO_COLLAPSED_WIDTH = "320px";
const STUDIO_EXPANDED_WIDTH = "minmax(0, min(720px, calc(100vw - 32px)))";
const PREVIEW_POLL_INTERVAL_MS = 1400;
const PREVIEW_POLL_ATTEMPTS = 40;

type GeneratedQuizHistoryItem = {
  createdAt: number;
  id: string;
  quiz: GeneratedQuiz;
};

export function MaterialEnhancementWorkspace({
  projectUuid,
}: {
  projectUuid: string;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isAddMaterialsModalOpen, setIsAddMaterialsModalOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [checkedMaterialIds, setCheckedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedPreviewItemId, setSelectedPreviewItemId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>("summary");
  const [isQuizExpanded, setIsQuizExpanded] = useState(false);
  const [quizStatus, setQuizStatus] = useState<QuizGenerationStatus>("idle");
  const [quizHistory, setQuizHistory] = useState<GeneratedQuizHistoryItem[]>([]);
  const [activeQuizHistoryId, setActiveQuizHistoryId] = useState<string | null>(null);
  const [quizErrorMessage, setQuizErrorMessage] = useState<string | null>(null);
  const [pendingQuizSourceCount, setPendingQuizSourceCount] = useState<number | null>(null);
  const [activeQuizQuestionIndex, setActiveQuizQuestionIndex] = useState(0);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, string>>({});
  const [quizViewMode, setQuizViewMode] = useState<QuizViewMode>("question");
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    generateRecommendations(null),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [renamingMaterialId, setRenamingMaterialId] = useState<string | null>(null);
  const [renamingMaterialDraftName, setRenamingMaterialDraftName] = useState("");
  const [renameMaterialErrorMessage, setRenameMaterialErrorMessage] = useState<string | null>(null);
  const [isRenamingMaterial, setIsRenamingMaterial] = useState(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [deleteMaterialErrorMessage, setDeleteMaterialErrorMessage] = useState<string | null>(null);
  const [isDeletingMaterial, setIsDeletingMaterial] = useState(false);
  const isMountedRef = useRef(true);
  const selectedMaterialIdRef = useRef<string | null>(null);
  const selectedProjectIdRef = useRef<number | null>(null);
  const quizRequestKeyRef = useRef("");

  const normalizedRouteProjectUuid = projectUuid.trim();
  const selectedProject =
    projects.find((project) => project.project_uuid === normalizedRouteProjectUuid) ??
    projects.find((project) => project.id === selectedProjectId) ??
    projects[0] ??
    null;
  const projectName = selectedProject?.name ?? "";
  const isProjectNameEditable =
    !isLoadingProject &&
    normalizedRouteProjectUuid.length > 0 &&
    normalizedRouteProjectUuid !== "undefined" &&
    projects.some((project) => project.project_uuid === normalizedRouteProjectUuid);
  const selectedMaterial = getSelectedMaterial(materials, selectedMaterialId);
  const renamingMaterial =
    materials.find((material) => material.id === renamingMaterialId) ?? null;
  const deletingMaterial =
    materials.find((material) => material.id === deletingMaterialId) ?? null;
  const selectedPreviewItem = getSelectedPreviewItem(
    selectedMaterial,
    selectedPreviewItemId,
  );
  const checkedMaterials = materials.filter((material) =>
    checkedMaterialIds.includes(material.id),
  );
  const currentQuizSourceKey = buildQuizSourceKey(checkedMaterials);
  const activeQuizHistoryItem =
    quizHistory.find((quizHistoryItem) => quizHistoryItem.id === activeQuizHistoryId) ?? null;
  const activeQuiz = activeQuizHistoryItem?.quiz ?? null;

  useEffect(() => {
    setRecommendations(generateRecommendations(selectedMaterial));
  }, [selectedMaterial]);

  useEffect(() => {
    selectedMaterialIdRef.current = selectedMaterialId;
  }, [selectedMaterialId]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProject?.id ?? selectedProjectId;
  }, [selectedProject, selectedProjectId]);

  useEffect(() => {
    return () => {
      revokeMaterialObjectUrls(materials);
    };
  }, [materials]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
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

  useEffect(() => {
    if (!isQuizExpanded) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [isQuizExpanded]);

  useEffect(() => {
    const normalizedProjectUuid = projectUuid.trim();
    if (!normalizedProjectUuid || normalizedProjectUuid === "undefined") {
      setIsLoadingProject(false);
      setToastMessage("Invalid project link. Open the project again from your dashboard.");
      return;
    }

    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      setIsLoadingProject(false);
      setToastMessage("Sign in to load your projects.");
      return;
    }

    const signedInAccessToken = accessToken;
    let isCancelled = false;

    async function loadProjectByUuid() {
      setIsLoadingProject(true);

      try {
        const project = await getProject({
          accessToken: signedInAccessToken,
          projectUuid: normalizedProjectUuid,
        });

        if (isCancelled || !isMountedRef.current) {
          return;
        }
        applyProjectDetail(project, signedInAccessToken);
      } catch (cause) {
        if (!isCancelled && isMountedRef.current) {
          setToastMessage(cause instanceof Error ? cause.message : "Unable to load projects.");
        }
      } finally {
        if (!isCancelled && isMountedRef.current) {
          setIsLoadingProject(false);
        }
      }
    }

    void loadProjectByUuid();

    return () => {
      isCancelled = true;
    };
    // Re-loads when URL UUID changes; other references are stable within each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid]);

  const applyProjectDetail = (project: Project, accessToken: string) => {
    const nextMaterials = project.materials
      .map((record) => createMaterialFromProjectMaterialRecord(record))
      .filter((material): material is Material => Boolean(material));
    const firstMaterial = nextMaterials[0];

    setProjects((currentProjects) => {
      const withoutProject = currentProjects.filter((item) => item.id !== project.id);
      return [project, ...withoutProject].sort((firstProject, secondProject) => {
        const firstTime = Date.parse(firstProject.updated_at ?? firstProject.created_at ?? "");
        const secondTime = Date.parse(secondProject.updated_at ?? secondProject.created_at ?? "");
        return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
      });
    });
    setSelectedProjectId(project.id ?? null);
    setMaterials(nextMaterials);
    setCheckedMaterialIds([]);
    setSelectedMaterialId(firstMaterial?.id ?? null);
    setSelectedPreviewItemId(firstMaterial?.previewItems[0]?.id ?? null);
    setIsQuizExpanded(false);
    setQuizStatus("idle");
    setQuizHistory([]);
    setActiveQuizHistoryId(null);
    setQuizErrorMessage(null);
    setPendingQuizSourceCount(null);
    quizRequestKeyRef.current = "";
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setQuizViewMode("question");

    for (const material of nextMaterials) {
      if (material.databaseId) {
        void syncPreviewManifest(material.id, material.databaseId, accessToken);
      }
    }
  };

  const syncPreviewManifest = async (
    materialId: string,
    databaseId: number,
    accessToken: string,
  ) => {
    for (let attempt = 0; attempt < PREVIEW_POLL_ATTEMPTS; attempt += 1) {
      try {
        const manifest = await getCourseContentPreview(databaseId, accessToken);

        if (!isMountedRef.current) {
          return;
        }

        startTransition(() => {
          setMaterials((currentMaterials) =>
            currentMaterials.map((material) =>
              material.id === materialId
                ? applyPreviewManifestToMaterial(material, manifest)
                : material,
            ),
          );

          if (selectedMaterialIdRef.current === materialId) {
            setSelectedPreviewItemId((currentSelectedPreviewItemId) => {
              const matchingItem = manifest.items.find(
                (previewItem) => previewItem.id === currentSelectedPreviewItemId,
              );

              return matchingItem?.id ?? currentSelectedPreviewItemId;
            });
          }
        });

        if (manifest.preview_status === "ready") {
          if (selectedMaterialIdRef.current === materialId && manifest.items[0]) {
            setSelectedPreviewItemId((currentSelectedPreviewItemId) =>
              manifest.items.some((previewItem) => previewItem.id === currentSelectedPreviewItemId)
                ? currentSelectedPreviewItemId
                : manifest.items[0]?.id ?? null,
            );
          }

          return;
        }

        if (manifest.preview_status === "failed") {
          setToastMessage(
            manifest.preview_error
              ? `${manifest.material_name}: ${manifest.preview_error}`
              : `${manifest.material_name}: preview rendering failed.`,
          );
          return;
        }
      } catch (cause) {
        if (!isMountedRef.current) {
          return;
        }

        setToastMessage(
          cause instanceof Error ? cause.message : "Unable to load rendered preview.",
        );
        return;
      }

      await wait(PREVIEW_POLL_INTERVAL_MS);
    }

    if (isMountedRef.current) {
      setToastMessage("Preview rendering is taking longer than expected.");
    }
  };

  const navigatePreview = (direction: "previous" | "next") => {
    if (!selectedMaterial || !selectedPreviewItem) {
      return;
    }

    const currentIndex = selectedMaterial.previewItems.findIndex(
      (previewItem) => previewItem.id === selectedPreviewItem.id,
    );

    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
    const nextPreviewItem = selectedMaterial.previewItems[nextIndex];

    if (!nextPreviewItem) {
      return;
    }

    setSelectedPreviewItemId(nextPreviewItem.id);
  };

  const handlePreviewKeydown = useEffectEvent((event: KeyboardEvent) => {
    if (!selectedMaterial || selectedMaterial.previewItems.length === 0) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigatePreview("previous");
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigatePreview("next");
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handlePreviewKeydown);

    return () => {
      window.removeEventListener("keydown", handlePreviewKeydown);
    };
  }, []);

  const appendMaterials = async (files: File[]): Promise<AddMaterialsSubmitResult> => {
    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      return {
        success: false,
        errorMessage: "Sign in before uploading materials.",
      };
    }

    const activeProjectId = selectedProjectIdRef.current;
    if (!activeProjectId) {
      return {
        success: false,
        errorMessage: "Project is still loading. Try again in a moment.",
      };
    }

    const acceptedFiles: File[] = [];
    const rejected: Array<{ fileName: string; reason: string }> = [];

    for (const file of files) {
      const validationError = validateUpload(file);

      if (validationError) {
        rejected.push({ fileName: file.name, reason: validationError });
        continue;
      }

      acceptedFiles.push(file);
    }

    if (rejected.length > 0) {
      const rejectedNames = rejected.map((item) => item.fileName).join(", ");
      setToastMessage(`Some files were not added: ${rejectedNames}`);
    }

    if (acceptedFiles.length === 0) {
      return {
        success: false,
        errorMessage:
          rejected[0]?.reason ?? "Add at least one supported file type before uploading.",
      };
    }

    const nextMaterials: Material[] = [];
    const failedUploads: Array<{ fileName: string; reason: string }> = [];
    const previewTargets: Array<{ materialId: string; databaseId: number }> = [];

    for (const file of acceptedFiles) {
      try {
        const record = await uploadCourseContent({
          accessToken,
          file,
          projectId: activeProjectId,
        });
        const material = createMaterialFromCourseContentRecord(file, record);

        if (material) {
          nextMaterials.push(material);
          if (material.databaseId) {
            previewTargets.push({
              materialId: material.id,
              databaseId: material.databaseId,
            });
          }
        } else {
          failedUploads.push({
            fileName: file.name,
            reason: "The upload succeeded, but the response could not be displayed.",
          });
        }
      } catch (cause) {
        failedUploads.push({
          fileName: file.name,
          reason: cause instanceof Error ? cause.message : "Upload failed.",
        });
      }
    }

    if (failedUploads.length > 0) {
      const failedNames = failedUploads.map((item) => item.fileName).join(", ");
      setToastMessage(`Some files failed to upload: ${failedNames}`);
    }

    if (nextMaterials.length === 0) {
      return {
        success: false,
        errorMessage:
          failedUploads[0]?.reason ?? "No files were uploaded to the database.",
      };
    }

    setMaterials((currentMaterials) => {
      const mergedMaterials = [...currentMaterials, ...nextMaterials];

      if (currentMaterials.length === 0 && nextMaterials[0]) {
        const firstPreviewItem = nextMaterials[0].previewItems[0];
        setSelectedMaterialId(nextMaterials[0].id);
        setSelectedPreviewItemId(firstPreviewItem?.id ?? null);
      }

      return mergedMaterials;
    });

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              material_count: project.material_count + nextMaterials.length,
              last_updated: new Date().toISOString(),
            }
          : project,
      ),
    );

    setCheckedMaterialIds((currentCheckedIds) => [
      ...new Set([...currentCheckedIds, ...nextMaterials.map((material) => material.id)]),
    ]);

    setToastMessage(
      `${nextMaterials.length} material${nextMaterials.length > 1 ? "s" : ""} uploaded to database`,
    );

    for (const previewTarget of previewTargets) {
      void syncPreviewManifest(previewTarget.materialId, previewTarget.databaseId, accessToken);
    }

    return { success: true };
  };

  const handleCreateProject = () => {
    router.push("/project");
  };

  const handleAddMaterials = async () => {
    const accessToken = getStoredAccessToken();

    if (!accessToken) {
      setToastMessage("Sign in before uploading materials.");
      return;
    }

    if (!selectedProjectIdRef.current) {
      setToastMessage("Project is still loading. Try again in a moment.");
      return;
    }

    setIsAddMaterialsModalOpen(true);
  };

  const handleAddMaterialsSubmit = ({
    files,
  }: {
    files: File[];
  }): Promise<AddMaterialsSubmitResult> => appendMaterials(files);

  const handleShareProject = () => {
    setToastMessage("Share controls will connect to collaborative project actions later.");
  };

  const handleOpenSettings = () => {
    setToastMessage("Project settings will connect to backend controls later.");
  };

  const handleOpenProfile = () => {
    setToastMessage("Profile actions will connect to account controls later.");
  };

  const handleOpenHelp = () => {
    setToastMessage("Help actions will connect to guidance and support flows later.");
  };

  const handleSelectTool = (tool: ActiveTool) => {
    setActiveTool(tool);

    if (tool === "quiz") {
      void ensureQuizGenerated();
    }
  };

  const ensureQuizGenerated = async (options?: { openWhenReady?: boolean }) => {
    if (quizStatus === "loading") {
      return;
    }

    if (!currentQuizSourceKey) {
      setToastMessage("Check one or more sources before making a quiz.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setToastMessage("Sign in before generating a quiz.");
      return;
    }

    const materialIds = checkedMaterials
      .map((material) => material.databaseId)
      .filter((databaseId): databaseId is number => typeof databaseId === "number");

    if (materialIds.length !== checkedMaterials.length) {
      setToastMessage("Only saved sources can be used for quiz generation.");
      return;
    }

    const requestedSourceKey = `${currentQuizSourceKey}:${Date.now()}`;
    const sourceCount = checkedMaterials.length;
    quizRequestKeyRef.current = requestedSourceKey;
    setQuizStatus("loading");
    setQuizErrorMessage(null);
    setPendingQuizSourceCount(sourceCount);
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setQuizViewMode("question");

    try {
      const generatedQuiz = await generateQuiz({
        accessToken,
        materialIds,
        questionCount: 12,
      });

      if (!isMountedRef.current || quizRequestKeyRef.current !== requestedSourceKey) {
        return;
      }

      const createdAt = Date.now();
      const generatedQuizHistoryItem: GeneratedQuizHistoryItem = {
        createdAt,
        id: `${generatedQuiz.quiz_id}-${createdAt}`,
        quiz: {
          ...generatedQuiz,
          title: normalizeQuizTitle(generatedQuiz.title, checkedMaterials),
        },
      };

      setQuizHistory((currentQuizHistory) => [
        generatedQuizHistoryItem,
        ...currentQuizHistory,
      ]);
      setActiveQuizHistoryId(generatedQuizHistoryItem.id);
      setQuizStatus("ready");
      setPendingQuizSourceCount(null);
      if (options?.openWhenReady) {
        setIsQuizExpanded(true);
      }
      setToastMessage("Quiz ready.");
    } catch (cause) {
      if (!isMountedRef.current || quizRequestKeyRef.current !== requestedSourceKey) {
        return;
      }

      const message = cause instanceof Error ? cause.message : "Unable to generate quiz.";
      setQuizStatus("error");
      setQuizErrorMessage(message);
      setPendingQuizSourceCount(null);
      setToastMessage(message);
    }
  };

  const handleOpenQuiz = (quizHistoryId: string) => {
    const quizHistoryItem = quizHistory.find((item) => item.id === quizHistoryId);

    if (!quizHistoryItem) {
      return;
    }

    setActiveQuizHistoryId(quizHistoryItem.id);
    setQuizStatus("ready");
    setQuizErrorMessage(null);
    setPendingQuizSourceCount(null);
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setQuizViewMode("question");
    setIsQuizExpanded(true);
  };

  const handleNavigateQuiz = (direction: "previous" | "next") => {
    if (!activeQuiz) {
      return;
    }

    setActiveQuizQuestionIndex((currentIndex) => {
      const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
      return Math.min(Math.max(nextIndex, 0), activeQuiz.questions.length - 1);
    });
  };

  const handleSelectQuizAnswer = (questionId: string, optionId: string) => {
    setSelectedQuizAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
  };

  const handleShowQuizResults = () => {
    if (!activeQuiz) {
      return;
    }

    setQuizViewMode("results");
  };

  const handleReviewQuiz = () => {
    if (!activeQuiz) {
      return;
    }

    setQuizViewMode("question");
  };

  const handleResetQuiz = () => {
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setQuizViewMode("question");
  };

  const handleProjectNameChange = (nextProjectName: string) => {
    const normalizedProjectUuid = normalizedRouteProjectUuid;
    if (!normalizedProjectUuid || normalizedProjectUuid === "undefined") {
      setToastMessage("Unable to rename this project because its link is invalid.");
      return;
    }

    if (isLoadingProject) {
      setToastMessage("Project is still loading. Try again.");
      return;
    }

    const activeProject =
      projects.find((project) => project.project_uuid === normalizedProjectUuid) ?? null;
    if (!activeProject) {
      setToastMessage("Project is still loading. Try again.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setToastMessage("Sign in before renaming this project.");
      return;
    }

    const normalizedProjectName = nextProjectName.trim();
    if (!normalizedProjectName) {
      setToastMessage("Project title cannot be empty.");
      return;
    }

    const previousProjectName = activeProject.name;
    if (normalizedProjectName === previousProjectName.trim()) {
      return;
    }

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.project_uuid === normalizedProjectUuid
          ? { ...project, name: normalizedProjectName }
          : project,
      ),
    );

    void (async () => {
      try {
        const updatedProject = await updateProjectTitle({
          accessToken,
          projectUuid: normalizedProjectUuid,
          name: normalizedProjectName,
        });

        if (!isMountedRef.current) {
          return;
        }

        setProjects((currentProjects) =>
          currentProjects.map((project) =>
            project.project_uuid === normalizedProjectUuid
              ? {
                  ...project,
                  name: updatedProject.name,
                  updated_at: updatedProject.updated_at ?? project.updated_at,
                  last_updated: updatedProject.last_updated ?? project.last_updated,
                  material_count: updatedProject.material_count,
                }
              : project,
          ),
        );
      } catch (cause) {
        if (!isMountedRef.current) {
          return;
        }

        setProjects((currentProjects) =>
          currentProjects.map((project) =>
            project.project_uuid === normalizedProjectUuid
              ? { ...project, name: previousProjectName }
              : project,
          ),
        );
        setToastMessage(cause instanceof Error ? cause.message : "Unable to update project title.");
      }
    })();
  };

  const handleOpenRenameMaterial = (materialId: string) => {
    const material = materials.find((item) => item.id === materialId);
    if (!material) {
      setToastMessage("Source not found.");
      return;
    }

    const { baseName } = splitMaterialName(material.name, material.extension);
    setRenamingMaterialId(material.id);
    setRenamingMaterialDraftName(baseName);
    setRenameMaterialErrorMessage(null);
  };

  const handleCloseRenameMaterial = (forceClose = false) => {
    if (isRenamingMaterial && !forceClose) {
      return;
    }

    setRenamingMaterialId(null);
    setRenamingMaterialDraftName("");
    setRenameMaterialErrorMessage(null);
  };

  const handleSaveMaterialRename = async () => {
    const material = renamingMaterial;
    if (!material) {
      return;
    }

    if (typeof material.databaseId !== "number") {
      setRenameMaterialErrorMessage("Only saved sources can be renamed.");
      return;
    }

    const trimmedBaseName = renamingMaterialDraftName.trim();
    if (!trimmedBaseName) {
      setRenameMaterialErrorMessage("Source name is required.");
      return;
    }

    const nextMaterialName = buildLockedMaterialName(trimmedBaseName, material.extension);
    if (nextMaterialName === material.name) {
      handleCloseRenameMaterial(true);
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setRenameMaterialErrorMessage("Sign in before renaming a source.");
      return;
    }

    setIsRenamingMaterial(true);
    setRenameMaterialErrorMessage(null);

    try {
      const updatedRecord = await renameCourseContent({
        accessToken,
        courseContentId: material.databaseId,
        materialName: trimmedBaseName,
      });

      if (!isMountedRef.current) {
        return;
      }

      setMaterials((currentMaterials) =>
        currentMaterials.map((currentMaterial) =>
          currentMaterial.id === material.id
            ? { ...currentMaterial, name: updatedRecord.material_name }
            : currentMaterial,
        ),
      );
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === selectedProjectIdRef.current
            ? { ...project, last_updated: new Date().toISOString() }
            : project,
        ),
      );
      setToastMessage(`Source renamed to "${updatedRecord.material_name}".`);
      handleCloseRenameMaterial(true);
    } catch (cause) {
      if (!isMountedRef.current) {
        return;
      }

      setRenameMaterialErrorMessage(
        cause instanceof Error ? cause.message : "Unable to rename source.",
      );
    } finally {
      if (isMountedRef.current) {
        setIsRenamingMaterial(false);
      }
    }
  };

  const handleOpenDeleteMaterial = (materialId: string) => {
    const material = materials.find((item) => item.id === materialId);
    if (!material) {
      setToastMessage("Source not found.");
      return;
    }

    setDeletingMaterialId(material.id);
    setDeleteMaterialErrorMessage(null);
  };

  const handleCloseDeleteMaterial = (forceClose = false) => {
    if (isDeletingMaterial && !forceClose) {
      return;
    }

    setDeletingMaterialId(null);
    setDeleteMaterialErrorMessage(null);
  };

  const handleConfirmDeleteMaterial = async () => {
    const material = deletingMaterial;
    if (!material) {
      return;
    }

    if (typeof material.databaseId !== "number") {
      setDeleteMaterialErrorMessage("Only saved sources can be deleted.");
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setDeleteMaterialErrorMessage("Sign in before deleting a source.");
      return;
    }

    setIsDeletingMaterial(true);
    setDeleteMaterialErrorMessage(null);

    try {
      await deleteCourseContent({
        accessToken,
        courseContentId: material.databaseId,
      });

      if (!isMountedRef.current) {
        return;
      }

      setMaterials((currentMaterials) => {
        const remainingMaterials = currentMaterials.filter(
          (currentMaterial) => currentMaterial.id !== material.id,
        );

        if (selectedMaterialIdRef.current === material.id) {
          const fallbackMaterial = remainingMaterials[0] ?? null;
          setSelectedMaterialId(fallbackMaterial?.id ?? null);
          setSelectedPreviewItemId(fallbackMaterial?.previewItems[0]?.id ?? null);
        }

        return remainingMaterials;
      });
      setCheckedMaterialIds((currentCheckedIds) =>
        currentCheckedIds.filter((checkedId) => checkedId !== material.id),
      );
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === selectedProjectIdRef.current
            ? {
                ...project,
                material_count: Math.max(project.material_count - 1, 0),
                last_updated: new Date().toISOString(),
              }
            : project,
        ),
      );
      setToastMessage(`Deleted "${material.name}".`);
      handleCloseDeleteMaterial(true);
    } catch (cause) {
      if (!isMountedRef.current) {
        return;
      }

      setDeleteMaterialErrorMessage(
        cause instanceof Error ? cause.message : "Unable to delete source.",
      );
    } finally {
      if (isMountedRef.current) {
        setIsDeletingMaterial(false);
      }
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const result = await appendMaterials(Array.from(event.dataTransfer.files));

    if (!result.success) {
      setToastMessage(result.errorMessage ?? "Unable to upload those materials.");
    }
  };

  const handleSelectMaterial = (materialId: string) => {
    const material = materials.find((item) => item.id === materialId);
    setSelectedMaterialId(materialId);
    setSelectedPreviewItemId(material?.previewItems[0]?.id ?? null);
  };

  const handleSelectPreviewItem = (materialId: string, previewItemId: string) => {
    setSelectedMaterialId(materialId);
    setSelectedPreviewItemId(previewItemId);
  };

  const handleToggleCheckedMaterial = (materialId: string) => {
    setCheckedMaterialIds((currentCheckedIds) =>
      currentCheckedIds.includes(materialId)
        ? currentCheckedIds.filter((checkedId) => checkedId !== materialId)
        : [...currentCheckedIds, materialId],
    );
  };

  const handleApplyRecommendation = (recommendationId: Recommendation["id"]) => {
    setRecommendations((currentRecommendations) =>
      currentRecommendations.map((recommendation) =>
        recommendation.id === recommendationId
          ? { ...recommendation, applied: !recommendation.applied }
          : recommendation,
      ),
    );
  };

  return (
    <main className="min-h-screen overflow-x-auto px-8 pb-7 pt-5">
      <div className="mx-auto w-full min-w-[1480px] max-w-[1852px]">
        <ProjectHeader
          isProjectNameEditable={isProjectNameEditable}
          projectName={projectName}
          onCreateProject={handleCreateProject}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={handleOpenSettings}
          onProjectNameChange={handleProjectNameChange}
          onShareProject={handleShareProject}
        />

        <div
          className="mt-[22px] grid gap-5 transition-[grid-template-columns] duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            gridTemplateColumns: getWorkspaceGridTemplateColumns({
              isLeftPanelCollapsed,
              isQuizExpanded,
            }),
          }}
        >
          <MaterialsSidebar
            checkedMaterialIds={checkedMaterialIds}
            isCollapsed={isLeftPanelCollapsed}
            isDragging={isDragging}
            isLoadingSources={isLoadingProject}
            materials={materials}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onOpenAddMaterials={handleAddMaterials}
            onRequestMaterialDelete={handleOpenDeleteMaterial}
            onRequestMaterialRename={handleOpenRenameMaterial}
            onSelectMaterial={handleSelectMaterial}
            onSelectPreviewItem={handleSelectPreviewItem}
            onToggleCollapsed={() => setIsLeftPanelCollapsed((current) => !current)}
            onToggleMaterialChecked={handleToggleCheckedMaterial}
            selectedMaterialId={selectedMaterialId}
            selectedPreviewItemId={selectedPreviewItemId}
          />

          <PreviewWorkspace
            onApplyRecommendation={handleApplyRecommendation}
            onNavigate={navigatePreview}
            previewItem={selectedPreviewItem}
            recommendations={recommendations}
            selectedMaterial={selectedMaterial}
          />

          <AIToolsSidebar
            activeQuestionIndex={activeQuizQuestionIndex}
            activeTool={activeTool}
            checkedMaterials={checkedMaterials}
            isQuizExpanded={isQuizExpanded}
            onCloseQuiz={() => setIsQuizExpanded(false)}
            onNavigateQuiz={handleNavigateQuiz}
            onOpenHelp={handleOpenHelp}
            onOpenQuiz={handleOpenQuiz}
            onResetQuiz={handleResetQuiz}
            onRetryQuiz={ensureQuizGenerated}
            onReviewQuiz={handleReviewQuiz}
            onSelectQuizAnswer={handleSelectQuizAnswer}
            onSelectTool={handleSelectTool}
            onShowQuizResults={handleShowQuizResults}
            pendingQuizSourceCount={pendingQuizSourceCount}
            quiz={activeQuiz}
            quizErrorMessage={quizErrorMessage}
            quizHistory={quizHistory}
            quizStatus={quizStatus}
            quizViewMode={quizViewMode}
            selectedQuizAnswers={selectedQuizAnswers}
          />
        </div>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed right-7 top-6 z-50 max-w-[360px] rounded-[16px] border border-[color:var(--border-soft)] bg-[rgba(28,25,23,0.94)] px-4 py-3 text-[13px] text-[color:var(--text-primary)] shadow-[0_18px_45px_0_rgba(0,0,0,0.5)] backdrop-blur-[10px]">
          {toastMessage}
        </div>
      ) : null}

      <AddMaterialsModal
        isOpen={isAddMaterialsModalOpen}
        onAddMaterials={handleAddMaterialsSubmit}
        onClose={() => setIsAddMaterialsModalOpen(false)}
      />

      <MaterialRenameModal
        errorMessage={renameMaterialErrorMessage}
        extension={renamingMaterial?.extension ?? null}
        isOpen={renamingMaterial !== null}
        isSaving={isRenamingMaterial}
        name={renamingMaterialDraftName}
        onClose={handleCloseRenameMaterial}
        onNameChange={(nextName) => {
          setRenamingMaterialDraftName(nextName);
          setRenameMaterialErrorMessage(null);
        }}
        onSave={handleSaveMaterialRename}
      />

      <MaterialDeleteModal
        errorMessage={deleteMaterialErrorMessage}
        isDeleting={isDeletingMaterial}
        isOpen={deletingMaterial !== null}
        materialName={deletingMaterial?.name ?? ""}
        onClose={handleCloseDeleteMaterial}
        onConfirmDelete={handleConfirmDeleteMaterial}
      />
    </main>
  );
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function buildQuizSourceKey(materials: Material[]): string {
  return materials
    .map((material) => material.databaseId)
    .filter((databaseId): databaseId is number => typeof databaseId === "number")
    .sort((firstId, secondId) => firstId - secondId)
    .join("|");
}

function getWorkspaceGridTemplateColumns({
  isLeftPanelCollapsed,
  isQuizExpanded,
}: {
  isLeftPanelCollapsed: boolean;
  isQuizExpanded: boolean;
}) {
  const leftColumn = isLeftPanelCollapsed
    ? COLLAPSED_LEFT_GRID_COLUMNS
    : EXPANDED_LEFT_GRID_COLUMNS;
  const studioColumn = isQuizExpanded ? STUDIO_EXPANDED_WIDTH : STUDIO_COLLAPSED_WIDTH;

  return `${leftColumn} minmax(0,1fr) ${studioColumn}`;
}

function normalizeQuizTitle(title: string, materials: Material[]) {
  const normalizedTitle = title.trim();

  if (normalizedTitle) {
    return normalizedTitle;
  }

  const firstMaterial = materials[0];

  if (!firstMaterial) {
    return "Generated Quiz";
  }

  return `${getMaterialBaseName(firstMaterial.name)} Quiz`;
}

function splitMaterialName(
  fileName: string,
  fallbackExtension: Material["extension"],
): { baseName: string; extensionLabel: string } {
  const extensionLabel = `.${fallbackExtension}`;
  const normalizedName = fileName.trim();
  const normalizedLowerName = normalizedName.toLowerCase();

  if (normalizedLowerName.endsWith(extensionLabel)) {
    const baseFromLockedExtension = normalizedName.slice(0, -extensionLabel.length).trim();
    return {
      baseName: baseFromLockedExtension || "material",
      extensionLabel,
    };
  }

  const lastDotIndex = normalizedName.lastIndexOf(".");
  if (lastDotIndex > 0) {
    const baseFromDot = normalizedName.slice(0, lastDotIndex).trim();
    return {
      baseName: baseFromDot || "material",
      extensionLabel,
    };
  }

  return {
    baseName: normalizedName || "material",
    extensionLabel,
  };
}

function buildLockedMaterialName(
  baseName: string,
  extension: Material["extension"],
): string {
  const normalizedBase = baseName.trim().replace(/\.+$/g, "");
  return `${normalizedBase || "material"}.${extension}`;
}

function MaterialRenameModal({
  errorMessage,
  extension,
  isOpen,
  isSaving,
  name,
  onClose,
  onNameChange,
  onSave,
}: {
  errorMessage: string | null;
  extension: Material["extension"] | null;
  isOpen: boolean;
  isSaving: boolean;
  name: string;
  onClose: () => void;
  onNameChange: (nextName: string) => void;
  onSave: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(6,6,5,0.72)] px-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[420px] rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(160deg,rgba(32,34,30,0.98)_0%,rgba(17,18,15,0.94)_100%)] p-6 shadow-[0_30px_65px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-source-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="rename-source-modal-title"
              className="text-[19px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]"
            >
              Rename source
            </h3>
            <p className="mt-1 text-[12.5px] text-[color:var(--text-muted)]">
              File extension is locked.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-8 rounded-[10px] border border-[rgba(255,255,255,0.12)] px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close rename source dialog"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            className="h-11 flex-1 rounded-[12px] border border-[rgba(184,219,128,0.22)] bg-[rgba(255,255,255,0.05)] px-3 text-[14px] font-semibold text-[color:var(--text-primary)] outline-none transition focus:border-[rgba(184,219,128,0.46)] focus:ring-2 focus:ring-[rgba(184,219,128,0.2)]"
            placeholder="Source name"
            disabled={isSaving}
            aria-label="Source name"
            autoFocus
          />
          <div className="flex h-11 min-w-[74px] items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-3 text-[12px] font-semibold text-[color:var(--text-muted)]">
            {extension ? `.${extension}` : ""}
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-3 text-[12.5px] text-[#ffc8d3]">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-[12px] border border-[rgba(255,255,255,0.14)] px-4 text-[12.8px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-10 rounded-[12px] border border-[rgba(184,219,128,0.35)] bg-[rgba(184,219,128,0.22)] px-4 text-[12.8px] font-semibold text-[color:var(--accent-green)] transition hover:bg-[rgba(184,219,128,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save name"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialDeleteModal({
  errorMessage,
  isDeleting,
  isOpen,
  materialName,
  onClose,
  onConfirmDelete,
}: {
  errorMessage: string | null;
  isDeleting: boolean;
  isOpen: boolean;
  materialName: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(6,6,5,0.72)] px-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[430px] rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(160deg,rgba(32,34,30,0.98)_0%,rgba(17,18,15,0.94)_100%)] p-6 shadow-[0_30px_65px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-source-modal-title"
      >
        <h3
          id="delete-source-modal-title"
          className="text-[19px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]"
        >
          Delete source
        </h3>

        <p className="mt-3 text-[13px] leading-6 text-[color:var(--text-secondary)]">
          Delete{" "}
          <span className="font-semibold text-[color:var(--text-primary)]">
            {materialName.trim() || "this source"}
          </span>
          ? This removes uploaded content and generated previews.
        </p>

        {errorMessage ? (
          <p className="mt-3 text-[12.5px] text-[#ffc8d3]">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-10 rounded-[12px] border border-[rgba(255,255,255,0.14)] px-4 text-[12.8px] font-semibold text-[color:var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="h-10 rounded-[12px] border border-[rgba(255,170,184,0.38)] bg-[rgba(255,170,184,0.2)] px-4 text-[12.8px] font-semibold text-[#ffc8d3] transition hover:bg-[rgba(255,170,184,0.27)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete source"}
          </button>
        </div>
      </div>
    </div>
  );
}
