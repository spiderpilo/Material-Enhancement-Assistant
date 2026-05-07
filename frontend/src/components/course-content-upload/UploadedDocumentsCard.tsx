import { EmptyDocumentsIcon } from "@/components/course-content-upload/icons";
import {
  type CourseContentRecord,
  formatCourseContentSize,
} from "@/lib/api/course-content";

type UploadedDocumentsCardProps = {
  items?: CourseContentRecord[];
  countLabel?: string;
};

export function UploadedDocumentsCard({
  items,
  countLabel,
}: UploadedDocumentsCardProps) {
  const hasItems = Boolean(items?.length);

  return (
    <section className="flex min-h-[320px] flex-col rounded-[24px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-6 shadow-[var(--shadow-card)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
            Uploaded Documents
          </h2>
        </div>
        {countLabel ? (
          <span className="inline-flex items-center rounded-full bg-[color:var(--secondary-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--secondary-text)]">
            {countLabel}
          </span>
        ) : null}
      </div>

      {hasItems ? (
        <ul className="mt-6 space-y-3">
          {items?.map((item) => (
            <li
              key={item.id}
              className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--surface-subtle)] px-4 py-3"
            >
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {item.material_name}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {formatCourseContentSize(item.data_size)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-[color:var(--line-strong)] bg-[color:var(--surface-subtle)] p-8">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--secondary-surface)] text-[color:var(--secondary-text)] shadow-[var(--shadow-soft)]">
              <EmptyDocumentsIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-[family:var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
              No uploaded documents yet
            </h3>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted-strong)]">
              Uploaded files will appear here after materials are added through
              the uploader above.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
