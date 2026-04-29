export const MAX_COURSE_CONTENT_UPLOAD_BYTES = 50 * 1024 * 1024;
export const SUPPORTED_COURSE_CONTENT_EXTENSIONS = ["pdf", "docx", "pptx"] as const;
export const SUPPORTED_COURSE_CONTENT_ACCEPT = ".pdf,.docx,.pptx";

export type SupportedCourseContentExtension =
  (typeof SUPPORTED_COURSE_CONTENT_EXTENSIONS)[number];

export type CourseContentPreviewStatus = "pending" | "ready" | "failed";
export type CourseContentSourceType = SupportedCourseContentExtension;

export type CourseContentRecord = {
  id: number;
  material_name: string;
  access_url: string;
  data_size: number;
  source_type?: CourseContentSourceType | null;
  preview_status?: CourseContentPreviewStatus;
  preview_count?: number;
};

export type CourseContentPreviewItem = {
  id: string;
  index: number;
  kind: "page" | "slide";
  label: string;
  title: string;
  subtitle: string;
  image_url: string;
  width: number;
  height: number;
};

export type CourseContentPreviewManifest = {
  course_content_id: number;
  material_name: string;
  source_type: CourseContentSourceType;
  preview_status: CourseContentPreviewStatus;
  preview_count: number;
  access_url: string;
  preview_error?: string | null;
  items: CourseContentPreviewItem[];
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const SUPPORTED_EXTENSION_SET = new Set<string>(SUPPORTED_COURSE_CONTENT_EXTENSIONS);

export async function uploadCourseContent(file: File): Promise<CourseContentRecord> {
  const validationError = getCourseContentFileValidationError(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/upload-doc`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as
    | CourseContentRecord
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to upload file.",
    );
  }

  return payload as CourseContentRecord;
}

export async function getCourseContentPreview(
  courseContentId: number,
): Promise<CourseContentPreviewManifest> {
  const response = await fetch(`${getApiBaseUrl()}/course-contents/${courseContentId}/preview`, {
    method: "GET",
  });

  const payload = (await response.json().catch(() => ({}))) as
    | CourseContentPreviewManifest
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to load preview.",
    );
  }

  return payload as CourseContentPreviewManifest;
}

export function getCourseContentFileValidationError(file: File): string | null {
  const extension = getCourseContentExtension(file.name);

  if (!extension || !SUPPORTED_EXTENSION_SET.has(extension)) {
    return "Only PDF, DOCX, and PPTX files are supported.";
  }

  if (file.size === 0) {
    return "Uploaded file is empty.";
  }

  if (file.size > MAX_COURSE_CONTENT_UPLOAD_BYTES) {
    return "Uploaded file is too large. Max file size is 50MB.";
  }

  return null;
}

export function formatCourseContentSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function getCourseContentExtension(
  fileName: string,
): SupportedCourseContentExtension | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1];

  if (!extension || !SUPPORTED_EXTENSION_SET.has(extension)) {
    return null;
  }

  return extension as SupportedCourseContentExtension;
}

function getApiBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    DEFAULT_API_BASE_URL;

  return configuredUrl.replace(/\/+$/, "");
}
