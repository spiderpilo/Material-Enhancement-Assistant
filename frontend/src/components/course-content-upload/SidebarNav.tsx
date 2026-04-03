import type { ComponentType, SVGProps } from "react";

import {
  BrandSparkIcon,
  ClipboardIcon,
  FolderStackIcon,
  HomeIcon,
  SettingsIcon,
} from "@/components/course-content-upload/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  icon: IconType;
  isActive?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: HomeIcon },
  { label: "Course Content", icon: FolderStackIcon, isActive: true },
  { label: "Review Queue", icon: ClipboardIcon },
  { label: "Settings", icon: SettingsIcon },
];

export function SidebarNav() {
  return (
    <aside className="w-full shrink-0 rounded-[30px] border border-[color:var(--line)] bg-[color:var(--sidebar-surface)] p-5 shadow-[var(--shadow-soft)] lg:flex lg:w-[280px] lg:flex-col lg:p-6">
      <div className="flex items-center gap-4 rounded-[24px] border border-white/70 bg-white/80 p-4 backdrop-blur">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]">
          <BrandSparkIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-strong)]">
            Material Assistant
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            Sisterhood LMS
          </p>
        </div>
      </div>

      <nav aria-label="Primary" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {navItems.map(({ label, icon: Icon, isActive }) => (
            <li key={label}>
              <a
                href="#"
                aria-current={isActive ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "border-[color:var(--line-strong)] bg-white text-[color:var(--foreground)] shadow-[var(--shadow-inset)]"
                    : "border-transparent bg-transparent text-[color:var(--muted-strong)] hover:border-[color:var(--line)] hover:bg-white/70 hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                    isActive
                      ? "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                      : "border-[color:var(--line)] bg-white/75 text-[color:var(--muted-strong)] group-hover:border-[color:var(--line-strong)]",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="truncate">{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 rounded-[26px] border border-[color:var(--line)] bg-white/90 p-4 shadow-[var(--shadow-soft)] lg:mt-auto">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
          Professor Profile
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e6c9b1,#c78155)] text-base font-semibold text-white">
            AC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
              Prof. Amelia Carter
            </p>
            <p className="truncate text-sm text-[color:var(--muted)]">
              Curriculum Review Lead
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
