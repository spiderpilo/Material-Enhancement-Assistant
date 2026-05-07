"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AddIcon, CloseIcon } from "./icons";

export type CreateProjectSubmitResult = {
  success: boolean;
  errorMessage?: string;
};

type CreateProjectModalProps = {
  initialProjectName: string;
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (args: { projectName: string }) => CreateProjectSubmitResult | Promise<CreateProjectSubmitResult>;
};

export function CreateProjectModal({
  initialProjectName,
  isOpen,
  onClose,
  onCreateProject,
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState(initialProjectName);
  const [hasTouchedProjectName, setHasTouchedProjectName] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  const trimmedProjectName = projectName.trim();
  const showProjectNameError = hasTouchedProjectName && trimmedProjectName.length === 0;

  const resetModalState = useCallback(() => {
    setProjectName(initialProjectName);
    setHasTouchedProjectName(false);
    setIsSubmitting(false);
    setSubmitError(null);
  }, [initialProjectName]);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [onClose, resetModalState]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

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

  const handleSubmit = async () => {
    if (trimmedProjectName.length === 0) {
      setHasTouchedProjectName(true);
      projectNameInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await onCreateProject({ projectName: trimmedProjectName });
    setIsSubmitting(false);

    if (!result.success) {
      setSubmitError(result.errorMessage ?? "Unable to save this project name.");
      return;
    }

    handleClose();
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
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-modal-title"
        aria-describedby="create-project-modal-subtitle"
        className="animate-modal-panel relative w-full max-w-[620px] overflow-hidden rounded-[32px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(33,33,39,0.94)_0%,rgba(18,18,22,0.98)_100%)] px-9 pb-9 pt-8 shadow-[0_40px_120px_rgba(0,0,0,0.58)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_240px_at_50%_-10%,rgba(255,255,255,0.08),transparent_72%),radial-gradient(340px_220px_at_78%_84%,rgba(184,219,128,0.08),transparent_72%),radial-gradient(280px_200px_at_14%_8%,rgba(243,158,182,0.07),transparent_72%)]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[31px] border border-[rgba(255,255,255,0.04)]" />

        <div className="relative flex items-start justify-between gap-6">
          <div>
            <h2
              id="create-project-modal-title"
              className="text-[21px] font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]"
            >
              Create Project
            </h2>
            <p
              id="create-project-modal-subtitle"
              className="mt-3 max-w-[420px] text-[13px] leading-[22px] text-[color:var(--text-muted)]"
            >
              Set the project name shown in the header. Materials stay untouched.
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

        <div className="relative mt-8">
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
          {submitError ? (
            <p className="mt-2 text-[12px] text-[rgba(243,158,182,0.92)]">{submitError}</p>
          ) : null}
        </div>

        <div className="relative mt-8 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-6 text-[15px] font-medium text-[color:var(--text-secondary)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.18)]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex h-12 min-w-[180px] items-center justify-center gap-3 rounded-full bg-[linear-gradient(180deg,#DDF598_0%,#D0F07E_100%)] px-6 text-[16px] font-semibold tracking-[-0.03em] text-[#10120E] shadow-[0_22px_42px_rgba(143,173,73,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.28)]"
          >
            <AddIcon className="h-[18px] w-[18px]" />
            {isSubmitting ? "Saving..." : "Save Project"}
          </button>
        </div>
      </section>
    </div>
  );
}
