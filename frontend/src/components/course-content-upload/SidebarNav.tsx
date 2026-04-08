import type { ComponentType, SVGProps } from "react";

import {
  BellIcon,
  BrandMarkIcon,
  ExportArrowIcon,
  GridIcon,
  ReviewBubbleIcon,
  SettingsIcon,
  UploadCloudIcon,
} from "@/components/course-content-upload/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  icon: IconType;
  isActive?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: GridIcon },
  { label: "Uploads", icon: UploadCloudIcon, isActive: true },
  { label: "Review Queue", icon: ReviewBubbleIcon },
  { label: "Exports", icon: ExportArrowIcon },
  { label: "Settings", icon: SettingsIcon },
];

export function SidebarNav() {
  return (
    <aside className="shrink-0 border-b border-(--line) bg-(--surface-strong) lg:min-h-screen lg:w-16 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:h-full lg:flex-col lg:justify-start lg:px-0 lg:py-0">
        <div className="flex items-center gap-3 lg:w-full lg:flex-col lg:gap-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--surface) text-(--accent) lg:h-16 lg:w-full lg:rounded-none lg:border-b lg:border-(--line) lg:bg-transparent">
            <BrandMarkIcon className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground lg:hidden">
            Curriculum Updater
          </p>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 items-center gap-2 overflow-x-auto lg:w-full lg:flex-col lg:gap-5 lg:overflow-visible lg:px-0 lg:py-6"
        >
          {navItems.map(({ label, icon: Icon, isActive }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-(--accent-soft) focus:ring-offset-2 focus:ring-offset-(--surface-strong) lg:h-10 lg:w-10",
                isActive
                  ? "border-(--accent-soft) bg-(--accent-soft) text-(--accent)"
                  : "border-transparent text-(--muted-strong) hover:border-(--line) hover:bg-(--surface) hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 lg:mb-3 lg:flex-col">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full text-(--muted-strong) transition hover:bg-(--surface) hover:text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-soft) focus:ring-offset-2 focus:ring-offset-(--surface-strong)"
          >
            <BellIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Professor profile"
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-(--line) bg-(--accent) text-xs font-semibold text-white shadow-(--shadow-soft) transition hover:border-(--line-strong) focus:outline-none focus:ring-2 focus:ring-(--accent-soft) focus:ring-offset-2 focus:ring-offset-(--surface-strong)"
          >
            DS
          </button>
        </div>
      </div>
    </aside>
  );
}
