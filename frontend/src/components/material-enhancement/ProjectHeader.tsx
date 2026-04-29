"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import {
  AddIcon,
  EditIcon,
  ProjectLogoIcon,
  SettingsIcon,
  ShareIcon,
  UserIcon,
} from "./icons";

type ProjectHeaderProps = {
  projectName: string;
  onCreateProject: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onProjectNameChange: (nextProjectName: string) => void;
  onShareProject: () => void;
};

export function ProjectHeader({
  projectName,
  onCreateProject,
  onOpenProfile,
  onOpenSettings,
  onProjectNameChange,
  onShareProject,
}: ProjectHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)]">
          <ProjectLogoIcon className="h-10 w-10" />
        </div>

        <EditableProjectTitle
          projectName={projectName}
          onProjectNameChange={onProjectNameChange}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[rgba(243,158,182,0.18)] bg-[#FFAAB8] px-4 text-[12.8px] font-bold text-[#1c1917] shadow-[0_18px_32px_rgba(0,0,0,0.24)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(243,158,182,0.55)]"
        >
          <AddIcon className="h-4 w-4" />
          Create Project
        </button>

        <HeaderUtilityButton ariaLabel="Share project" onClick={onShareProject}>
          <ShareIcon className="h-[30px] w-[30px]" />
        </HeaderUtilityButton>
        <HeaderUtilityButton ariaLabel="Open project settings" onClick={onOpenSettings}>
          <SettingsIcon className="h-[26px] w-[26px]" />
        </HeaderUtilityButton>
        <HeaderUtilityButton ariaLabel="Open profile" onClick={onOpenProfile}>
          <UserIcon className="h-[30px] w-[30px]" />
        </HeaderUtilityButton>
      </div>
    </header>
  );
}

function EditableProjectTitle({
  projectName,
  onProjectNameChange,
}: {
  projectName: string;
  onProjectNameChange: (nextProjectName: string) => void;
}) {
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [isEditing, setIsEditing] = useState(false);
  const cancelBlurRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProjectName = projectName.trim().length > 0;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const saveProjectName = () => {
    const nextProjectName = draftProjectName.trim();
    setIsEditing(false);

    if (!nextProjectName) {
      if (!hasProjectName) {
        setDraftProjectName("");
        return;
      }

      setDraftProjectName(projectName);
      return;
    }

    if (nextProjectName !== projectName) {
      onProjectNameChange(nextProjectName);
    }
  };

  const cancelEditing = () => {
    cancelBlurRef.current = true;
    setDraftProjectName(projectName);
    setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveProjectName();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draftProjectName}
        onBlur={() => {
          if (cancelBlurRef.current) {
            cancelBlurRef.current = false;
            return;
          }

          saveProjectName();
        }}
        onChange={(event) => setDraftProjectName(event.target.value)}
        onKeyDown={handleKeyDown}
        className="h-10 w-[min(44vw,640px)] rounded-[12px] border border-[rgba(184,219,128,0.22)] bg-[rgba(255,255,255,0.05)] px-4 text-[15px] font-semibold tracking-[-0.03em] text-[rgba(127,183,126,0.92)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] outline-none placeholder:text-[rgba(127,183,126,0.5)] focus:border-[rgba(184,219,128,0.4)] focus:ring-2 focus:ring-[rgba(184,219,128,0.18)]"
        placeholder="Project name"
        aria-label="Project name"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraftProjectName(projectName);
        setIsEditing(true);
      }}
      className="group flex min-w-0 items-center gap-2 rounded-[12px] px-2 py-2 text-left transition hover:bg-[rgba(255,255,255,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.2)]"
      aria-label="Edit project title"
    >
      <span
        className={[
          "truncate text-[25px] font-semibold tracking-[-0.03em]",
          hasProjectName
            ? "text-[rgba(127,183,126,0.92)]"
            : "text-[rgba(127,183,126,0.54)]",
        ].join(" ")}
      >
        {hasProjectName ? projectName : "Project Name"}
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-transparent text-[rgba(214,211,209,0.54)] transition group-hover:border-[rgba(255,255,255,0.08)] group-hover:bg-[rgba(255,255,255,0.03)] group-hover:text-[color:var(--text-secondary)]">
        <EditIcon className="h-[18px] w-[18px]" />
      </span>
    </button>
  );
}

function HeaderUtilityButton({
  ariaLabel,
  children,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[color:var(--accent-cream)] transition hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.22)]"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
