"use client";

import { useState } from "react";

import { FloatingHelpButton } from "@/components/course-content-upload/FloatingHelpButton";
import { MetadataPanel } from "@/components/course-content-upload/MetadataPanel";
import { SidebarNav } from "@/components/course-content-upload/SidebarNav";
import { TopHeader } from "@/components/course-content-upload/TopHeader";
import { UploadDropzone } from "@/components/course-content-upload/UploadDropzone";
import { UploadedDocumentsCard } from "@/components/course-content-upload/UploadedDocumentsCard";
import { StartAnalysisIcon } from "@/components/course-content-upload/icons";
import type {
  CourseContentRecord,
  UploadListItem,
} from "@/components/course-content-upload/upload-types";

const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "pptx"]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

function buildUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getApiBaseUrl() {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  return configuredBaseUrl.replace(/\/+$/, "");
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) ?? "" : "";
}

function validateFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return "Only PDF, DOCX, and PPTX files are supported.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "File exceeds the 50MB upload limit.";
  }

  return null;
}

function parseRecordResponse(responseText: string): CourseContentRecord {
  const parsed = JSON.parse(responseText) as Partial<CourseContentRecord>;

  if (
    typeof parsed.id !== "number" ||
    typeof parsed.material_name !== "string" ||
    typeof parsed.access_url !== "string" ||
    typeof parsed.data_size !== "number"
  ) {
    throw new Error("Backend returned an unexpected upload response.");
  }

  return {
    id: parsed.id,
    material_name: parsed.material_name,
    access_url: parsed.access_url,
    data_size: parsed.data_size,
  };
}

function getRequestErrorMessage(request: XMLHttpRequest) {
  const fallbackMessage = request.status
    ? `Upload failed with status ${request.status}.`
    : "Upload failed. Check that the backend is running and try again.";

  if (!request.responseText) {
    return fallbackMessage;
  }

  try {
    const payload = JSON.parse(request.responseText) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }
  } catch {
    const trimmedResponse = request.responseText.trim();
    if (trimmedResponse) {
      return trimmedResponse;
    }
  }

  return fallbackMessage;
}

export function UploadWorkspace() {
  const [items, setItems] = useState<UploadListItem[]>([]);

  function patchUploadItem(
    itemId: string,
    patch: Partial<UploadListItem>,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
  }

  function startUpload(itemId: string, file: File) {
    const request = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file);
    patchUploadItem(itemId, {
      status: "uploading",
      progress: 0,
      errorMessage: undefined,
    });

    request.upload.addEventListener("loadstart", () => {
      patchUploadItem(itemId, {
        status: "uploading",
        progress: 0,
        errorMessage: undefined,
      });
    });

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || event.total === 0) {
        return;
      }

      patchUploadItem(itemId, {
        status: "uploading",
        progress: Math.round((event.loaded / event.total) * 100),
      });
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          const record = parseRecordResponse(request.responseText);

          patchUploadItem(itemId, {
            status: "success",
            progress: 100,
            errorMessage: undefined,
            record,
          });
        } catch (error) {
          patchUploadItem(itemId, {
            status: "error",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Upload succeeded but the response could not be read.",
          });
        }

        return;
      }

      patchUploadItem(itemId, {
        status: "error",
        errorMessage: getRequestErrorMessage(request),
      });
    });

    request.addEventListener("error", () => {
      patchUploadItem(itemId, {
        status: "error",
        errorMessage: getRequestErrorMessage(request),
      });
    });

    request.addEventListener("abort", () => {
      patchUploadItem(itemId, {
        status: "error",
        errorMessage: "Upload was canceled before completion.",
      });
    });

    request.open("POST", `${getApiBaseUrl()}/upload-doc`);
    request.send(formData);
  }

  function handleFilesSelected(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const nextEntries = files.map((file) => {
      const validationError = validateFile(file);
      const id = buildUploadId();

      return {
        file,
        item: {
          id,
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          status: validationError ? "error" : "queued",
          errorMessage: validationError ?? undefined,
        } satisfies UploadListItem,
      };
    });

    setItems((currentItems) => [
      ...nextEntries.map((entry) => entry.item),
      ...currentItems,
    ]);

    nextEntries.forEach(({ file, item }) => {
      if (item.status === "error") {
        return;
      }

      startUpload(item.id, file);
    });
  }

  const processingCount = items.filter(
    (item) => item.status === "queued" || item.status === "uploading",
  ).length;
  const successCount = items.filter((item) => item.status === "success").length;
  const errorCount = items.filter((item) => item.status === "error").length;

  let countLabel: string | undefined;
  if (processingCount > 0) {
    countLabel = `${processingCount} file${processingCount === 1 ? "" : "s"} processing`;
  } else if (successCount > 0 && errorCount > 0) {
    countLabel = `${successCount} uploaded, ${errorCount} failed`;
  } else if (successCount > 0) {
    countLabel = `${successCount} file${successCount === 1 ? "" : "s"} uploaded`;
  } else if (errorCount > 0) {
    countLabel = `${errorCount} file${errorCount === 1 ? "" : "s"} need attention`;
  }

  let statusText = "No files selected yet.";
  if (processingCount > 0) {
    statusText = `${processingCount} upload${processingCount === 1 ? "" : "s"} in progress.`;
  } else if (successCount > 0 && errorCount > 0) {
    statusText = `${successCount} upload${successCount === 1 ? "" : "s"} completed and ${errorCount} failed.`;
  } else if (successCount > 0) {
    statusText = `${successCount} file${successCount === 1 ? "" : "s"} uploaded successfully.`;
  } else if (errorCount > 0) {
    statusText = `${errorCount} file${errorCount === 1 ? "" : "s"} need attention before retrying.`;
  } else if (items.length > 0) {
    statusText = `${items.length} file${items.length === 1 ? "" : "s"} added. Uploads start automatically.`;
  }

  return (
    <main className="flex-1 bg-background">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <SidebarNav />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />

          <div className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
              <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <h1 className="font-(--font-display) text-[2.5rem] tracking-[-0.05em] text-foreground sm:text-[3rem] sm:leading-[1.1]">
                    Course Content Upload
                  </h1>
                  <p className="mt-2 max-w-xl text-base leading-8 text-(--muted-strong)">
                    Add your lecture slides, readings, and notes to begin
                    automated synthesis.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-(--accent) px-7 py-3 text-base font-semibold text-white shadow-(--shadow-button) transition hover:bg-(--accent-strong) focus:outline-none focus:ring-4 focus:ring-(--accent-soft)"
                >
                  <StartAnalysisIcon className="h-4.5 w-4.5" />
                  Start Analysis
                </button>
              </section>

              <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_362px] xl:items-start">
                <div className="space-y-8">
                  <UploadDropzone
                    onFilesSelected={handleFilesSelected}
                    statusText={statusText}
                  />
                  <UploadedDocumentsCard
                    items={items}
                    countLabel={countLabel}
                  />
                </div>
                <MetadataPanel />
              </section>
            </div>
          </div>
        </div>
      </div>

      <FloatingHelpButton />
    </main>
  );
}
