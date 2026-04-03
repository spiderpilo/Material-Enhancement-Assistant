import { BellIcon, GridIcon, SearchIcon } from "@/components/course-content-upload/icons";

export function TopHeader() {
  return (
    <header className="relative flex flex-col gap-4 border-b border-[color:var(--line)] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--muted)]">
          Professor Workspace
        </p>
        <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          Course Content
        </h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 sm:w-[320px] lg:w-[360px]">
          <span className="sr-only">Search course content</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            type="search"
            placeholder="Search your uploads"
            className="h-12 w-full rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--line-strong)] focus:bg-white focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
        </label>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            aria-label="Open notifications"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted-strong)] transition hover:border-[color:var(--line-strong)] hover:bg-white"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Open quick tools"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--surface-muted)] text-[color:var(--muted-strong)] transition hover:border-[color:var(--line-strong)] hover:bg-white"
          >
            <GridIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Open profile menu"
            className="flex items-center gap-3 rounded-full border border-[color:var(--line)] bg-white px-3 py-2 shadow-[var(--shadow-inset)] transition hover:border-[color:var(--line-strong)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ecc7ab,#cb7d4f)] text-xs font-semibold text-white">
              AC
            </span>
            <span className="hidden text-sm font-medium text-[color:var(--foreground)] sm:inline">
              Amelia
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
