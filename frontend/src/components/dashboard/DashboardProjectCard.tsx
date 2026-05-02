import Link from "next/link";
import type { ComponentType, CSSProperties, SVGProps } from "react";

import { AddIcon, FileIcon } from "@/components/material-enhancement/icons";

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
}: DashboardProjectCardProps) {
  const Icon = project.icon;

  return (
    <Link
      href={project.href}
      className="dashboard-project-card group relative flex h-[280px] w-full flex-col rounded-[12px] p-[25px] transition duration-300 hover:-translate-y-[6px] hover:scale-[1.01] hover:border-[rgba(197,225,165,0.18)] hover:shadow-[0_34px_72px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(197,225,165,0.2)] active:translate-y-[1px] active:scale-[0.995] xl:w-[329px]"
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
