"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";

import { SUPPORTED_FILE_TYPE_LABEL } from "@/lib/material-enhancement/workspace";

import {
  AddIcon,
  CloseIcon,
  ShieldCheckIcon,
  UploadCloudIcon,
} from "./icons";

export type CreateProjectSubmitResult = {
  success: boolean;
  errorMessage?: string;
};

type CreateProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (args: {
    files: File[];
    projectName: string;
  }) => CreateProjectSubmitResult;
};

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreateProject,
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [hasTouchedProjectName, setHasTouchedProjectName] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const trimmedProjectName = projectName.trim();
  const hasStagedFiles = pendingFiles.length > 0;
  const showProjectNameError = hasTouchedProjectName && trimmedProjectName.length === 0;
  const primaryActsAsBrowse = !hasStagedFiles;
  const primaryDisabled = !primaryActsAsBrowse && trimmedProjectName.length === 0;

  const resetModalState = useCallback(() => {
    setProjectName("");
    setPendingFiles([]);
    setIsDragActive(false);
    setHasTouchedProjectName(false);
    setSubmitError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [onClose, resetModalState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    document.body.style.overflow = "hidden";
    projectNameInputRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusedElement?.focus();
    };
  }, [handleClose, isOpen]);

  if (!isOpen) {
    return null;
  }

  const stageFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setPendingFiles((currentFiles) => mergePendingFiles(currentFiles, files));
    setSubmitError(null);
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    stageFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    stageFiles(Array.from(event.dataTransfer.files));
  };

  const handlePrimaryAction = () => {
    if (!hasStagedFiles) {
      fileInputRef.current?.click();
      return;
    }

    if (trimmedProjectName.length === 0) {
      setHasTouchedProjectName(true);
      projectNameInputRef.current?.focus();
      return;
    }

    const result = onCreateProject({
      files: pendingFiles,
      projectName: trimmedProjectName,
    });

    if (!result.success) {
      setSubmitError(result.errorMessage ?? "Unable to create a project with those files.");
      return;
    }

    handleClose();
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className="animate-modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-[linear-gradient(180deg,rgba(3,4,7,0.68)_0%,rgba(8,9,13,0.76)_100%)] px-6 py-8 backdrop-blur-[20px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="flex w-full max-w-[908px] flex-col items-center gap-5">
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-modal-title"
          aria-describedby="create-project-modal-subtitle"
          className="animate-modal-panel relative w-full overflow-hidden rounded-[36px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(33,33,39,0.94)_0%,rgba(18,18,22,0.98)_100%)] px-11 pb-11 pt-10 shadow-[0_40px_120px_rgba(0,0,0,0.58)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_260px_at_50%_-10%,rgba(255,255,255,0.08),transparent_72%),radial-gradient(360px_260px_at_74%_86%,rgba(184,219,128,0.08),transparent_72%),radial-gradient(320px_220px_at_16%_8%,rgba(243,158,182,0.07),transparent_72%),radial-gradient(260px_180px_at_92%_14%,rgba(5,51,156,0.08),transparent_75%)]" />
          <div className="pointer-events-none absolute inset-[1px] rounded-[35px] border border-[rgba(255,255,255,0.04)]" />

          <div className="relative flex items-start justify-between gap-6">
            <div>
              <h2
                id="create-project-modal-title"
                className="text-[21px] font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]"
              >
                Material Enhancement Assistant
              </h2>
              <p
                id="create-project-modal-subtitle"
                className="mt-3 text-[13px] leading-[22px] text-[color:var(--text-muted)]"
              >
                Add files to enhance and organize your course content
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] text-[rgba(214,211,209,0.72)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.22)]"
              aria-label="Close create project dialog"
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="relative mt-7">
            <label
              htmlFor="create-project-name"
              className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]"
            >
              Project name
            </label>
            <input
              id="create-project-name"
              ref={projectNameInputRef}
              type="text"
              value={projectName}
              onBlur={() => setHasTouchedProjectName(true)}
              onChange={(event) => {
                setProjectName(event.target.value);
                setSubmitError(null);
              }}
              placeholder="Enter project name"
              aria-invalid={showProjectNameError}
              className={[
                "mt-3 h-12 w-full rounded-[16px] border bg-[rgba(255,255,255,0.05)] px-4 text-[14px] text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition duration-200 placeholder:text-[rgba(168,162,158,0.75)]",
                showProjectNameError
                  ? "border-[rgba(243,158,182,0.4)] focus:border-[rgba(243,158,182,0.48)] focus:ring-2 focus:ring-[rgba(243,158,182,0.18)]"
                  : "border-[rgba(255,255,255,0.08)] focus:border-[rgba(184,219,128,0.36)] focus:ring-2 focus:ring-[rgba(184,219,128,0.16)]",
              ].join(" ")}
            />
            {showProjectNameError ? (
              <p className="mt-2 text-[12px] text-[rgba(243,158,182,0.92)]">
                Project name is required.
              </p>
            ) : null}
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={handleDropzoneKeyDown}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={[
              "relative mt-8 flex min-h-[304px] flex-col items-center justify-center rounded-[28px] border-[2px] border-dashed px-8 text-center transition duration-200",
              isDragActive
                ? "border-[rgba(184,219,128,0.4)] bg-[rgba(184,219,128,0.08)] shadow-[0_0_0_1px_rgba(184,219,128,0.18),0_24px_60px_rgba(0,0,0,0.3)]"
                : "border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(184,219,128,0.26)] hover:bg-[rgba(255,255,255,0.1)] hover:shadow-[0_0_0_1px_rgba(184,219,128,0.1),0_18px_40px_rgba(0,0,0,0.24)]",
            ].join(" ")}
            aria-label="Drag and drop files here or browse from device"
          >
            <div className="pointer-events-none absolute inset-6 rounded-[22px] border border-dashed border-[rgba(255,255,255,0.04)]" />
            <div className="relative flex h-[94px] w-[94px] items-center justify-center rounded-[24px] border border-[rgba(184,219,128,0.22)] bg-[linear-gradient(180deg,rgba(35,40,28,0.78)_0%,rgba(23,25,21,0.92)_100%)] text-[color:var(--accent-green)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.26)] transition duration-200 group-hover:brightness-[1.06]">
              <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_50%_18%,rgba(184,219,128,0.18),transparent_62%)]" />
              <UploadCloudIcon className="relative h-11 w-11" />
            </div>

            <p className="mt-10 text-[18px] font-medium tracking-[-0.03em] text-[color:var(--text-primary)]">
              Drag and drop your files here
            </p>
            <p className="mt-4 text-[13px] text-[color:var(--text-subtle)]">
              DOCX, PDF, PPT, PPTX, images
            </p>

            {hasStagedFiles ? (
              <div className="mt-7 flex max-w-[540px] flex-wrap justify-center gap-2">
                {pendingFiles.slice(0, 4).map((file) => (
                  <span
                    key={createFileFingerprint(file)}
                    className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]"
                  >
                    {file.name}
                  </span>
                ))}
                {pendingFiles.length > 4 ? (
                  <span className="inline-flex items-center rounded-full border border-[rgba(184,219,128,0.14)] bg-[rgba(184,219,128,0.1)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--accent-green)]">
                    +{pendingFiles.length - 4} more
                  </span>
                ) : null}
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_FILE_TYPE_LABEL}
              className="sr-only"
              onChange={handleFileSelection}
            />
          </div>

          {submitError ? (
            <p className="relative mt-4 text-[12px] text-[rgba(243,158,182,0.92)]">
              {submitError}
            </p>
          ) : hasStagedFiles ? (
            <p className="relative mt-4 text-[12px] text-[color:var(--accent-green)]">
              {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} staged for this project.
            </p>
          ) : null}

          <div className="relative mt-10 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              className={[
                "inline-flex h-[64px] min-w-[238px] items-center justify-center gap-3 rounded-full px-8 text-[18px] font-semibold tracking-[-0.03em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.28)]",
                primaryDisabled
                  ? "bg-[rgba(184,219,128,0.36)] text-[rgba(17,19,16,0.66)]"
                  : "bg-[linear-gradient(180deg,#DDF598_0%,#D0F07E_100%)] text-[#10120E] shadow-[0_22px_42px_rgba(143,173,73,0.18)] hover:-translate-y-0.5 hover:brightness-[1.04]",
              ].join(" ")}
            >
              <AddIcon className="h-[22px] w-[22px]" />
              Upload Files
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-[64px] min-w-[270px] items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-8 text-[17px] font-medium tracking-[-0.02em] text-[color:var(--text-secondary)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.18)]"
            >
              Browse from device
            </button>
          </div>
        </section>

        <div
          id="create-project-modal-security"
          className="flex items-center gap-2 text-[12px] text-[rgba(120,113,108,0.94)]"
        >
          <ShieldCheckIcon className="h-[15px] w-[15px]" />
          <span>Files are processed securely and kept private to your courses</span>
        </div>
      </div>
    </div>
  );
}

function mergePendingFiles(currentFiles: File[], nextFiles: File[]) {
  const byFingerprint = new Map<string, File>();

  for (const file of [...currentFiles, ...nextFiles]) {
    byFingerprint.set(createFileFingerprint(file), file);
  }

  return Array.from(byFingerprint.values());
}

function createFileFingerprint(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
