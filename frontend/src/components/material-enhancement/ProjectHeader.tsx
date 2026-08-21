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
import Link from "next/link";

type ProjectHeaderProps = {
  isProjectNameEditable?: boolean;
  projectName: string;
  onCreateProject: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onProjectNameChange: (nextProjectName: string) => void;
  onShareProject: () => void;
};

export function ProjectHeader({
  isProjectNameEditable = true,
  projectName,
  onCreateProject,
  onOpenProfile,
  onOpenSettings,
  onProjectNameChange,
  onShareProject,
}: ProjectHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 xl:gap-5 2xl:gap-6">
      <div className="flex min-w-0 items-center gap-2.5 xl:gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.03)] 2xl:h-8 2xl:w-8">
          <Link
            aria-label="Open dashboard"
            href="/dashboard"
            className="p-0"
          >
            <ProjectLogoIcon className="h-9 w-9 2xl:h-10 2xl:w-10" />
          </Link>
        </div>

        <EditableProjectTitle
          isEditable={isProjectNameEditable}
          projectName={projectName}
          onProjectNameChange={onProjectNameChange}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 xl:gap-2.5 2xl:gap-3">
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-[rgba(243,158,182,0.18)] bg-[#FFAAB8] px-3.5 text-[12px] font-bold text-[#1c1917] shadow-[0_18px_32px_rgba(0,0,0,0.24)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(243,158,182,0.55)] xl:px-4 2xl:h-10 2xl:gap-2 2xl:text-[12.8px]"
        >
          <AddIcon className="h-4 w-4" />
          Create Project
        </button>

        <HeaderUtilityButton ariaLabel="Share project" onClick={onShareProject}>
          <ShareIcon className="h-6 w-6 2xl:h-[30px] 2xl:w-[30px]" />
        </HeaderUtilityButton>
        <HeaderUtilityButton ariaLabel="Open project settings" onClick={onOpenSettings}>
          <SettingsIcon className="h-[22px] w-[22px] 2xl:h-[26px] 2xl:w-[26px]" />
        </HeaderUtilityButton>
        <HeaderUtilityButton ariaLabel="Open profile" onClick={onOpenProfile}>
          <UserIcon className="h-6 w-6 2xl:h-[30px] 2xl:w-[30px]" />
        </HeaderUtilityButton>
      </div>
    </header>
  );
}

function EditableProjectTitle({
  isEditable,
  projectName,
  onProjectNameChange,
}: {
  isEditable: boolean;
  projectName: string;
  onProjectNameChange: (nextProjectName: string) => void;
}) {
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const [isEditing, setIsEditing] = useState(false);
  const cancelBlurRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedProjectName = projectName.trim();
  const displayProjectName = trimmedProjectName || "Untitled project";

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
      setDraftProjectName(projectName);
      return;
    }

    if (nextProjectName !== trimmedProjectName) {
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
        className="h-9 w-[min(40vw,520px)] max-w-full rounded-[12px] border border-[rgba(184,219,128,0.22)] bg-[rgba(255,255,255,0.05)] px-4 text-[14px] font-semibold tracking-[-0.03em] text-[rgba(127,183,126,0.92)] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] outline-none placeholder:text-[rgba(127,183,126,0.5)] focus:border-[rgba(184,219,128,0.4)] focus:ring-2 focus:ring-[rgba(184,219,128,0.18)] 2xl:h-10 2xl:w-[min(44vw,640px)] 2xl:text-[15px]"
        placeholder="Project name"
        aria-label="Project name"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!isEditable}
      onClick={() => {
        setDraftProjectName(trimmedProjectName);
        setIsEditing(true);
      }}
      className="group flex min-w-0 items-center gap-2 rounded-[12px] px-1.5 py-1.5 text-left transition hover:bg-[rgba(255,255,255,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.2)] disabled:cursor-not-allowed disabled:opacity-80 2xl:px-2 2xl:py-2"
      aria-label="Edit project title"
    >
      <span
        className="truncate text-[clamp(20px,1.7vw,24px)] font-semibold tracking-[-0.03em] text-[rgba(127,183,126,0.92)] 2xl:text-[25px]"
      >
        {displayProjectName}
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
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[color:var(--accent-cream)] transition hover:bg-[rgba(255,255,255,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,246,211,0.22)] 2xl:h-10 2xl:w-10"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
