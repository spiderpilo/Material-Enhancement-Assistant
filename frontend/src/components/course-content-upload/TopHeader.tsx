import { BellIcon, GridIcon, SearchIcon } from "@/components/course-content-upload/icons";

export function TopHeader() {
  return (
    <header className="border-b border-(--line) bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
        <div className="min-w-0">
          <h2 className="truncate text-[1.75rem] font-semibold tracking-[-0.04em] text-(--accent)">
            Upload Materials
          </h2>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <label className="relative hidden min-w-0 sm:block sm:w-[256px]">
            <span className="sr-only">Search archive</span>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)" />
            <input
              type="search"
              placeholder="Search archive..."
              className="h-9 w-full rounded-full border border-transparent bg-(--surface-subtle) pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-(--muted) focus:border-(--line-strong) focus:bg-white focus:ring-2 focus:ring-(--accent-soft)"
            />
          </label>

          <button
            type="button"
            aria-label="Open notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full text-(--muted-strong) transition hover:bg-(--surface-subtle) hover:text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          >
            <BellIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Open utility menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-(--muted-strong) transition hover:bg-(--surface-subtle) hover:text-foreground focus:outline-none focus:ring-2 focus:ring-(--accent-soft)"
          >
            <GridIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
