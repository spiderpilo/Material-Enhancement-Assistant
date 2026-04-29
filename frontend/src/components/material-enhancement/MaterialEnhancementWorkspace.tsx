"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { DragEvent } from "react";

import {
  AddMaterialsModal,
  type AddMaterialsSubmitResult,
} from "@/components/material-enhancement/AddMaterialsModal";
import { AIToolsSidebar } from "@/components/material-enhancement/AIToolsSidebar";
import {
  CreateProjectModal,
  type CreateProjectSubmitResult,
} from "@/components/material-enhancement/CreateProjectModal";
import { MaterialsSidebar } from "@/components/material-enhancement/MaterialsSidebar";
import { PreviewWorkspace } from "@/components/material-enhancement/PreviewWorkspace";
import { ProjectHeader } from "@/components/material-enhancement/ProjectHeader";
import type {
  ActiveTool,
  Material,
  Recommendation,
} from "@/lib/material-enhancement/workspace";
import {
  createMaterialFromCourseContentRecord,
  generateRecommendations,
  getSelectedMaterial,
  getSelectedPreviewItem,
  revokeMaterialObjectUrls,
  validateUpload,
} from "@/lib/material-enhancement/workspace";
import { uploadCourseContent } from "@/lib/api/course-content";

const EXPANDED_GRID_COLUMNS = "320px minmax(0,1fr) 320px";
const COLLAPSED_GRID_COLUMNS = "84px minmax(0,1fr) 320px";

export function MaterialEnhancementWorkspace() {
  const [projectName, setProjectName] = useState("");
  const [isAddMaterialsModalOpen, setIsAddMaterialsModalOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [checkedMaterialIds, setCheckedMaterialIds] = useState<string[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedPreviewItemId, setSelectedPreviewItemId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>("summary");
  const [recommendations, setRecommendations] = useState<Recommendation[]>(
    generateRecommendations(null),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedMaterial = getSelectedMaterial(materials, selectedMaterialId);
  const selectedPreviewItem = getSelectedPreviewItem(
    selectedMaterial,
    selectedPreviewItemId,
  );
  const checkedMaterials = materials.filter((material) =>
    checkedMaterialIds.includes(material.id),
  );

  useEffect(() => {
    setRecommendations(generateRecommendations(selectedMaterial));
  }, [selectedMaterial]);

  useEffect(() => {
    return () => {
      revokeMaterialObjectUrls(materials);
    };
  }, [materials]);

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

    for (const file of acceptedFiles) {
      try {
        const record = await uploadCourseContent(file);
        const material = createMaterialFromCourseContentRecord(file, record);

        if (material) {
          nextMaterials.push(material);
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

    setCheckedMaterialIds((currentCheckedIds) => [
      ...new Set([...currentCheckedIds, ...nextMaterials.map((material) => material.id)]),
    ]);

    setToastMessage(
      `${nextMaterials.length} material${nextMaterials.length > 1 ? "s" : ""} uploaded to database`,
    );

    return { success: true };
  };

  const handleCreateProject = () => {
    setIsCreateProjectModalOpen(true);
  };

  const handleCreateProjectSubmit = ({
    projectName: nextProjectName,
  }: {
    projectName: string;
  }): CreateProjectSubmitResult => {
    setProjectName(nextProjectName);
    setToastMessage(`Project name updated to "${nextProjectName}".`);
    return { success: true };
  };

  const handleAddMaterials = () => {
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
          onProjectNameChange={setProjectName}
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
            onSelectTool={setActiveTool}
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

      <CreateProjectModal
        key={projectName}
        initialProjectName={projectName}
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreateProject={handleCreateProjectSubmit}
      />
    </main>
  );
}
