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
  QuizPanel,
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
  getSelectedMaterial,
  getSelectedPreviewItem,
  revokeMaterialObjectUrls,
  validateUpload,
} from "@/lib/material-enhancement/workspace";
import { getStoredAccessToken } from "@/lib/api/auth";
import { getCourseContentPreview, uploadCourseContent } from "@/lib/api/course-content";
import {
  getProject,
  type Project,
  updateProjectTitle,
} from "@/lib/api/projects";

const EXPANDED_GRID_COLUMNS = "320px minmax(0,1fr) 320px";
const COLLAPSED_GRID_COLUMNS = "84px minmax(0,1fr) 320px";
const PREVIEW_POLL_INTERVAL_MS = 1400;
const PREVIEW_POLL_ATTEMPTS = 40;

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
  const [quizData, setQuizData] = useState<GeneratedQuiz | null>(null);
  const [quizErrorMessage, setQuizErrorMessage] = useState<string | null>(null);
  const [quizSourceKey, setQuizSourceKey] = useState("");
  const [activeQuizQuestionIndex, setActiveQuizQuestionIndex] = useState(0);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, string>>({});
  const [revealedQuizFeedback, setRevealedQuizFeedback] = useState<Record<string, boolean>>({});
  const [quizViewMode, setQuizViewMode] = useState<QuizViewMode>("question");
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    generateRecommendations(null),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
  const selectedMaterial = getSelectedMaterial(materials, selectedMaterialId);
  const selectedPreviewItem = getSelectedPreviewItem(
    selectedMaterial,
    selectedPreviewItemId,
  );
  const checkedMaterials = materials.filter((material) =>
    checkedMaterialIds.includes(material.id),
  );
  const currentQuizSourceKey = buildQuizSourceKey(checkedMaterials);

  useEffect(() => {
    setRecommendations(generateRecommendations(selectedMaterial));
  }, [selectedMaterial]);

  useEffect(() => {
    if (!quizSourceKey) {
      return;
    }

    if (quizSourceKey === currentQuizSourceKey) {
      return;
    }

    setIsQuizExpanded(false);
    setQuizStatus("idle");
    setQuizData(null);
    setQuizErrorMessage(null);
    setQuizSourceKey("");
    quizRequestKeyRef.current = "";
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setRevealedQuizFeedback({});
    setQuizViewMode("question");
  }, [currentQuizSourceKey, quizSourceKey]);

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
    const normalizedProjectUuid = projectUuid.trim();
    if (!normalizedProjectUuid || normalizedProjectUuid === "undefined") {
      setToastMessage("Invalid project link. Open the project again from your dashboard.");
      return;
    }

    const accessToken = getStoredAccessToken();

    if (!accessToken) {
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

    if (quizData && quizSourceKey === currentQuizSourceKey) {
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

    const requestedSourceKey = currentQuizSourceKey;
    quizRequestKeyRef.current = requestedSourceKey;
    setQuizStatus("loading");
    setQuizData(null);
    setQuizErrorMessage(null);
    setQuizSourceKey(requestedSourceKey);
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setRevealedQuizFeedback({});
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

      setQuizData(generatedQuiz);
      setQuizStatus("ready");
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
      setToastMessage(message);
    }
  };

  const handleOpenQuiz = () => {
    if (quizData && quizSourceKey === currentQuizSourceKey) {
      setIsQuizExpanded(true);
      return;
    }

    void ensureQuizGenerated({ openWhenReady: true });
  };

  const handleNavigateQuiz = (direction: "previous" | "next") => {
    if (!quizData) {
      return;
    }

    setActiveQuizQuestionIndex((currentIndex) => {
      const nextIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
      return Math.min(Math.max(nextIndex, 0), quizData.questions.length - 1);
    });
  };

  const handleSelectQuizAnswer = (questionId: string, optionId: string) => {
    setSelectedQuizAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
    setRevealedQuizFeedback((currentFeedback) => ({
      ...currentFeedback,
      [questionId]: true,
    }));
  };

  const handleShowQuizResults = () => {
    if (!quizData) {
      return;
    }

    setQuizViewMode("results");
  };

  const handleReviewQuiz = () => {
    if (!quizData) {
      return;
    }

    setQuizViewMode("question");
  };

  const handleResetQuiz = () => {
    setActiveQuizQuestionIndex(0);
    setSelectedQuizAnswers({});
    setRevealedQuizFeedback({});
    setQuizViewMode("question");
  };

  const handleProjectNameChange = (nextProjectName: string) => {
    const activeProject = selectedProject;
    if (!activeProject) {
      setToastMessage("Select a project before renaming it.");
      return;
    }

    const normalizedProjectUuid = activeProject.project_uuid.trim();
    if (!normalizedProjectUuid || normalizedProjectUuid === "undefined") {
      setToastMessage("Unable to rename this project because its link is invalid.");
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
    if (normalizedProjectName === previousProjectName) {
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
          projectName={projectName}
          onCreateProject={handleCreateProject}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={handleOpenSettings}
          onProjectNameChange={handleProjectNameChange}
          onShareProject={handleShareProject}
        />

        <div
          className="mt-[22px] grid gap-5 transition-[grid-template-columns] duration-300 ease-out"
          style={{
            gridTemplateColumns: isLeftPanelCollapsed
              ? COLLAPSED_GRID_COLUMNS
              : EXPANDED_GRID_COLUMNS,
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
            onSelectMaterial={handleSelectMaterial}
            onSelectPreviewItem={handleSelectPreviewItem}
            onToggleCollapsed={() => setIsLeftPanelCollapsed((current) => !current)}
            onToggleMaterialChecked={handleToggleCheckedMaterial}
            selectedMaterialId={selectedMaterialId}
            selectedPreviewItemId={selectedPreviewItemId}
          />

          {isQuizExpanded ? (
            <div className="col-span-2">
              <QuizPanel
                activeQuestionIndex={activeQuizQuestionIndex}
                checkedMaterials={checkedMaterials}
                errorMessage={quizErrorMessage}
                onClose={() => setIsQuizExpanded(false)}
                onNavigate={handleNavigateQuiz}
                onReset={handleResetQuiz}
                onRetry={ensureQuizGenerated}
                onReview={handleReviewQuiz}
                onSelectAnswer={handleSelectQuizAnswer}
                onShowResults={handleShowQuizResults}
                quiz={quizData}
                revealedFeedback={revealedQuizFeedback}
                selectedAnswers={selectedQuizAnswers}
                status={quizStatus}
                viewMode={quizViewMode}
              />
            </div>
          ) : (
            <>
              <PreviewWorkspace
                onApplyRecommendation={handleApplyRecommendation}
                onNavigate={navigatePreview}
                previewItem={selectedPreviewItem}
                recommendations={recommendations}
                selectedMaterial={selectedMaterial}
              />

              <AIToolsSidebar
                activeTool={activeTool}
                checkedMaterials={checkedMaterials}
                onOpenHelp={handleOpenHelp}
                onOpenQuiz={handleOpenQuiz}
                onSelectTool={handleSelectTool}
                quiz={quizData}
                quizErrorMessage={quizErrorMessage}
                quizStatus={quizStatus}
              />
            </>
          )}
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
