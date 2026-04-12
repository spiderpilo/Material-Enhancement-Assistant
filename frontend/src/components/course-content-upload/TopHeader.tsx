import type { ReactNode } from "react";

import {
  BellIcon,
  GridIcon,
  SearchIcon,
} from "@/components/course-content-upload/icons";

type TopHeaderProps = {
  title: string;
  actions?: ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
};

export function TopHeader({
  title,
  actions,
  searchPlaceholder = "Search archive...",
  showSearch = true,
}: TopHeaderProps) {
  return (
    <header className="border-b border-[color:var(--line)] bg-[rgba(255,253,249,0.76)] backdrop-blur-md">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
        <div className="min-w-0">
          <h2 className="truncate font-[family:var(--font-display)] text-[1.75rem] font-semibold tracking-[-0.04em] text-[color:var(--accent)]">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {showSearch ? (
            <label className="relative hidden min-w-0 sm:block sm:w-[256px]">
              <span className="sr-only">Search archive</span>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-full border border-transparent bg-[rgba(255,253,249,0.85)] pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--line-strong)] focus:bg-[color:var(--surface-strong)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              />
            </label>
          ) : null}

          {actions}

          <button
            type="button"
            aria-label="Open notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-strong)] transition hover:bg-[color:var(--secondary-soft)] hover:text-[color:var(--secondary-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          >
            <BellIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Open utility menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-strong)] transition hover:bg-[color:var(--secondary-soft)] hover:text-[color:var(--secondary-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          >
            <GridIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
