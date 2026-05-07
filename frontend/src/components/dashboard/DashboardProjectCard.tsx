import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, SVGProps } from "react";

import {
  AddIcon,
  EditIcon,
  FileIcon,
  OverflowVerticalIcon,
  TrashIcon,
} from "@/components/material-enhancement/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const displayFontStyle: CSSProperties = {
  fontFamily: '"Plus Jakarta Sans", Inter, "Segoe UI", sans-serif',
};

const accentFontStyle: CSSProperties = {
  fontFamily: 'Manrope, Inter, "Segoe UI", sans-serif',
};

export type DashboardProjectCardData = {
  href: string;
  icon: IconType;
  id: string;
  sourceCountLabel: string;
  title: string;
  updatedLabel: string;
};

type DashboardProjectCardProps = {
  project: DashboardProjectCardData;
  onDelete: (projectId: string) => void;
  onEditTitle: (projectId: string) => void;
};

type DashboardCreateProjectCardProps = {
  onClick: () => void;
};

export function DashboardCreateProjectCard({
  onClick,
}: DashboardCreateProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-create-card group relative flex h-[280px] w-full justify-self-start rounded-[12px] border border-dashed border-[rgba(255,255,255,0.14)] px-[26px] pb-[60.415px] pt-[59.61px] text-center transition duration-300 hover:-translate-y-[6px] hover:scale-[1.012] hover:border-[rgba(197,225,165,0.22)] hover:shadow-[0_34px_70px_rgba(0,0,0,0.3),0_0_0_1px_rgba(197,225,165,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.22)] active:translate-y-[1px] active:scale-[0.995] xl:w-[289px]"
      aria-label="Create a new project"
    >
      <div className="relative flex w-full flex-col items-center justify-center">
        <span className="dashboard-glass-orb mb-[18.805px] flex h-16 w-16 items-center justify-center rounded-full text-[#d9efba] transition duration-300 group-hover:-translate-y-1 group-hover:scale-[1.06] group-hover:text-[#eff8dd] group-hover:shadow-[0_22px_36px_rgba(52,103,57,0.22)]">
          <AddIcon className="h-[18.667px] w-[18.667px] transition duration-300 group-hover:rotate-90 group-hover:scale-110" />
        </span>

        <span
          className="text-[28px] font-semibold leading-[36.4px] tracking-[-0.01em] text-[#eef0e7] transition duration-300 group-hover:text-white group-hover:[text-shadow:0_10px_20px_rgba(255,255,255,0.08)]"
          style={displayFontStyle}
        >
          Create new
          <br />
          project
        </span>
      </div>
    </button>
  );
}

export function DashboardProjectCard({
  project,
  onDelete,
  onEditTitle,
}: DashboardProjectCardProps) {
  const Icon = project.icon;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuContainerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="relative w-full xl:w-[329px]">
      <Link
        href={project.href}
        className="dashboard-project-card group relative flex h-[280px] w-full flex-col rounded-[12px] p-[25px] transition duration-300 hover:-translate-y-[6px] hover:scale-[1.01] hover:border-[rgba(197,225,165,0.18)] hover:shadow-[0_34px_72px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.2)] active:translate-y-[1px] active:scale-[0.995]"
      >
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <div className="h-20">
              <span className="dashboard-glass-orb flex h-14 w-14 items-center justify-center rounded-[14px] text-[#c8dfaa] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-4deg] group-hover:text-[#eef8dc] group-hover:shadow-[0_18px_30px_rgba(52,103,57,0.2)]">
                <Icon className="h-[22px] w-[22px]" />
              </span>
            </div>

            <div className="pb-3">
              <h2
                className="max-w-[12ch] overflow-hidden text-[28px] font-semibold leading-[36.4px] tracking-[-0.01em] text-[#eff0e8] transition duration-300 group-hover:text-white group-hover:[text-shadow:0_12px_22px_rgba(255,255,255,0.08)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                style={displayFontStyle}
              >
                {project.title}
              </h2>
            </div>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.06)] pt-[17px] transition duration-300 group-hover:border-[rgba(255,255,255,0.1)]">
            <div className="flex items-end justify-between gap-4">
              <p className="max-w-[118px] text-[14px] leading-[21px] text-[#cfd3c3] transition duration-300 group-hover:text-[#e2e5da]">
                {project.updatedLabel}
              </p>

              <span className="dashboard-glass-pill inline-flex shrink-0 items-center gap-[6px] rounded-full px-3 py-1 text-[#d6ebbb] transition duration-300 group-hover:-translate-y-0.5 group-hover:text-[#eff8dd] group-hover:shadow-[0_16px_28px_rgba(52,103,57,0.16)]">
                <FileIcon className="h-[11.667px] w-[11.667px] shrink-0" />
                <span
                  className="whitespace-nowrap text-[11px] font-bold uppercase leading-[14.4px] tracking-[0.1em]"
                  style={accentFontStyle}
                >
                  {project.sourceCountLabel}
                </span>
              </span>
            </div>
          </div>
        </div>
      </Link>

      <div ref={menuContainerRef} className="absolute right-4 top-4 z-20">
        <button
          type="button"
          aria-label={`Open actions for ${project.title}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsMenuOpen((currentValue) => !currentValue);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_100%),linear-gradient(145deg,rgba(33,35,30,0.9)_0%,rgba(20,23,18,0.84)_100%)] text-[#d3d8c8] shadow-[0_14px_28px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-[18px] transition hover:-translate-y-0.5 hover:border-[rgba(197,225,165,0.26)] hover:text-[#eff8dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.2)]"
        >
          <OverflowVerticalIcon className="h-[16px] w-[16px]" />
        </button>

        {isMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-[170px] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0.05)_100%),linear-gradient(145deg,rgba(26,29,23,0.96)_0%,rgba(16,18,14,0.92)_100%)] p-1.5 shadow-[0_24px_52px_rgba(0,0,0,0.4)] backdrop-blur-[20px]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onEditTitle(project.id);
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#e7ebdf] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            >
              <EditIcon className="h-4 w-4 shrink-0" />
              <span>Edit title</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                onDelete(project.id);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#f2b9c6] transition hover:bg-[rgba(242,185,198,0.16)] hover:text-[#ffd8e2]"
            >
              <TrashIcon className="h-4 w-4 shrink-0" />
              <span>Delete</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DashboardProjectSkeletonCard() {
  return (
    <div className="dashboard-skeleton-card flex h-[280px] w-full animate-pulse flex-col justify-between rounded-[12px] p-[25px] xl:w-[329px]">
      <div className="flex flex-col gap-6">
        <div className="h-14 w-14 rounded-[14px] bg-[rgba(255,255,255,0.08)]" />
        <div className="space-y-3">
          <div className="h-8 w-36 rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="h-8 w-28 rounded-full bg-[rgba(255,255,255,0.04)]" />
        </div>
      </div>

      <div className="border-t border-[rgba(255,255,255,0.05)] pt-[17px]">
        <div className="flex items-center justify-between gap-4">
          <div className="h-5 w-28 rounded-full bg-[rgba(255,255,255,0.05)]" />
          <div className="h-7 w-24 rounded-full bg-[rgba(255,255,255,0.05)]" />
        </div>
      </div>
    </div>
  );
}
