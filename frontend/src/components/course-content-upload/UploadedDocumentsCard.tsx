import { EmptyDocumentsIcon } from "@/components/course-content-upload/icons";
import type { UploadListItem, UploadStatus } from "@/components/course-content-upload/upload-types";

type UploadedDocumentsCardProps = {
  items?: UploadListItem[];
  countLabel?: string;
};

const statusLabels: Record<UploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  success: "Complete",
  error: "Error",
};

const statusAccentClasses: Record<UploadStatus, string> = {
  queued: "bg-[#ece7dd] text-[color:var(--muted-strong)]",
  uploading: "bg-[rgba(196,166,106,0.2)] text-[color:var(--warning-text)]",
  success: "bg-[rgba(74,124,89,0.14)] text-[color:var(--accent)]",
  error: "bg-[rgba(185,77,67,0.14)] text-[#9d4037]",
};

const progressBarClasses: Record<UploadStatus, string> = {
  queued: "bg-[#b7aea1]",
  uploading: "bg-[color:var(--accent)]",
  success: "bg-[color:var(--accent)]",
  error: "bg-[#b94d43]",
};

function formatFileSize(fileSize: number) {
  if (fileSize >= 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (fileSize >= 1024) {
    return `${Math.round(fileSize / 1024)} KB`;
  }

  return `${fileSize} B`;
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.at(-1)?.toUpperCase() ?? "FILE" : "FILE";
}

export function UploadedDocumentsCard({
  items,
  countLabel,
}: UploadedDocumentsCardProps) {
  const hasItems = Boolean(items?.length);

  return (
    <section className="flex min-h-80 flex-col rounded-3xl bg-(--surface-strong) p-6 shadow-(--shadow-card) sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-[1.75rem] tracking-[-0.04em] text-foreground">
            Uploaded Documents
          </h2>
        </div>
        {countLabel ? (
          <span className="inline-flex items-center rounded-full bg-[rgba(196,166,106,0.22)] px-3 py-1 text-xs font-semibold text-(--warning-text)">
            {countLabel}
          </span>
        ) : null}
      </div>

      {hasItems ? (
        <ul className="mt-6 space-y-3">
          {items?.map((item) => {
            const showProgress = item.status !== "success";

            return (
              <li
                key={item.id}
                className={[
                  "rounded-[18px] border bg-(--surface-subtle) px-4 py-4 shadow-(--shadow-soft)",
                  item.status === "error"
                    ? "border-[rgba(185,77,67,0.28)]"
                    : "border-(--line)",
                ].join(" ")}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xs font-bold tracking-[0.12em]",
                      item.status === "error"
                        ? "bg-[rgba(185,77,67,0.12)] text-[#9d4037]"
                        : "bg-(--accent-soft) text-(--accent)",
                    ].join(" ")}
                  >
                    {getFileExtension(item.fileName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {item.fileName}
                        </p>
                        <p className="mt-1 text-sm text-(--muted)">
                          {item.status === "error"
                            ? item.errorMessage ?? "Upload failed."
                            : `${statusLabels[item.status]} • ${formatFileSize(item.fileSize)}`}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">
                          {item.status === "error"
                            ? "Needs attention"
                            : formatFileSize(item.fileSize)}
                        </p>
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
                            statusAccentClasses[item.status],
                          ].join(" ")}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </div>
                    </div>

                    {showProgress ? (
                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-[#ddd7cc]">
                          <div
                            className={[
                              "h-full rounded-full transition-[width] duration-300 ease-out",
                              progressBarClasses[item.status],
                            ].join(" ")}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em]">
                          <span className="text-(--muted)">
                            {item.status === "error"
                              ? "Upload failed"
                              : item.status === "queued"
                                ? "Waiting to upload"
                                : "Uploading now"}
                          </span>
                          <span
                            className={
                              item.status === "error"
                                ? "text-[#9d4037]"
                                : "text-(--muted-strong)"
                            }
                          >
                            {item.progress}%
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 flex flex-1 items-center justify-center rounded-[20px] border border-dashed border-(--line-strong) bg-(--surface-subtle) p-8">
          <div className="mx-auto flex max-w-sm flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-(--muted) shadow-(--shadow-soft)">
              <EmptyDocumentsIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-foreground">
              No uploaded documents yet
            </h3>
            <p className="mt-3 text-sm leading-7 text-(--muted-strong)">
              Uploaded files will appear here after materials are added through
              the uploader above.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
