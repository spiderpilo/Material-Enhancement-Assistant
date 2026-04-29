import {
  type CourseContentRecord,
  type CourseContentPreviewManifest,
  type CourseContentPreviewStatus,
  SUPPORTED_COURSE_CONTENT_ACCEPT,
  formatCourseContentSize,
  getCourseContentExtension,
  getCourseContentFileValidationError,
} from "@/lib/api/course-content";

export const ACCEPTED_FILE_EXTENSIONS = [
  "pdf",
  "docx",
  "pptx",
] as const;

export type AcceptedExtension = (typeof ACCEPTED_FILE_EXTENSIONS)[number];
export type MaterialKind = "pdf" | "doc" | "ppt" | "image";
export type PreviewKind = "page" | "slide" | "section" | "image";
export type ActiveTool = "summary" | "mindmap" | "quiz" | "flashcards";
export type RecommendationId = "clarity" | "visuals" | "interaction";
export type AccentTone = "green" | "pink" | "cream";
export type PlaceholderLayout = "diagram" | "document" | "outline" | "image";

export type PreviewItem = {
  id: string;
  index: number;
  kind: PreviewKind;
  label: string;
  title: string;
  subtitle: string;
  placeholderLayout: PlaceholderLayout;
  imageUrl?: string;
};

export type Material = {
  id: string;
  name: string;
  extension: AcceptedExtension;
  kind: MaterialKind;
  size: number;
  mimeType: string;
  uploadedAt: number;
  accessUrl?: string;
  databaseId?: number;
  previewError?: string;
  previewStatus: CourseContentPreviewStatus;
  previewItems: PreviewItem[];
};

export type Recommendation = {
  id: RecommendationId;
  title: string;
  label: string;
  description: string;
  accent: AccentTone;
  applied: boolean;
  disabled: boolean;
};

type DetectedFileType = {
  extension: AcceptedExtension;
  kind: MaterialKind;
};

type UploadResult = {
  materials: Material[];
  rejected: Array<{ fileName: string; reason: string }>;
};

const ACCEPTED_EXTENSION_SET = new Set<string>(ACCEPTED_FILE_EXTENSIONS);

const FILE_TYPE_BY_EXTENSION: Record<AcceptedExtension, MaterialKind> = {
  pdf: "pdf",
  docx: "doc",
  pptx: "ppt",
};

const PENDING_PREVIEW_COPY: Record<
  Exclude<MaterialKind, "image">,
  { label: string; title: string; subtitle: string; placeholderLayout: PlaceholderLayout }
> = {
  pdf: {
    label: "Page 1",
    title: "Rendering preview",
    subtitle: "Preparing page render for the preview workspace.",
    placeholderLayout: "document",
  },
  ppt: {
    label: "Slide 1",
    title: "Rendering preview",
    subtitle: "Preparing slide render for the preview workspace.",
    placeholderLayout: "diagram",
  },
  doc: {
    label: "Page 1",
    title: "Rendering preview",
    subtitle: "Preparing document pages for the preview workspace.",
    placeholderLayout: "document",
  },
};

const RECOMMENDATION_TEXT: Record<
  MaterialKind | "empty",
  Record<RecommendationId, string>
> = {
  empty: {
    clarity:
      "Upload a slide deck or document to unlock clarity suggestions.",
    visuals:
      "Visual refinement prompts will appear here once we have material to inspect.",
    interaction:
      "Interaction ideas activate after a material is uploaded and selected.",
  },
  pdf: {
    clarity:
      "Surface the main takeaway earlier and shorten dense blocks so readers can scan each page more confidently.",
    visuals:
      "Introduce clearer hierarchy between heading, body text, and supporting callouts to reduce page fatigue.",
    interaction:
      "Add one reflective prompt per page to encourage pause-and-respond moments during review or class discussion.",
  },
  doc: {
    clarity:
      "Break longer passages into smaller sections and pull key definitions into more visible supporting lines.",
    visuals:
      "Increase contrast between section headings and body copy so the document structure is easier to follow at a glance.",
    interaction:
      "Turn one core concept into a check-in question or short recap prompt to support active reading.",
  },
  ppt: {
    clarity:
      "Tighten slide headings and replace speaker-facing phrasing with learner-facing language where possible.",
    visuals:
      "Strengthen slide rhythm by giving titles, diagrams, and supporting labels more obvious visual separation.",
    interaction:
      "Pair one slide with a brief audience prompt so the deck invites reflection instead of only passive viewing.",
  },
  image: {
    clarity:
      "Add a concise framing caption so the instructional takeaway of the image is unmistakable before discussion begins.",
    visuals:
      "Consider guiding attention with surrounding labels or callouts if the image contains multiple competing focal points.",
    interaction:
      "Use the image as a launch point for a compare-or-predict prompt so viewers actively interpret what they see.",
  },
};

export function detectFileType(file: File): DetectedFileType | null {
  const extension = getCourseContentExtension(file.name);

  if (!extension || !ACCEPTED_EXTENSION_SET.has(extension)) {
    return null;
  }

  const acceptedExtension = extension as AcceptedExtension;

  return {
    extension: acceptedExtension,
    kind: FILE_TYPE_BY_EXTENSION[acceptedExtension],
  };
}

export function validateUpload(file: File): string | null {
  const uploadError = getCourseContentFileValidationError(file);

  if (uploadError) {
    return uploadError;
  }

  return null;
}

export function processUploadFiles(files: File[]): UploadResult {
  const materials: Material[] = [];
  const rejected: UploadResult["rejected"] = [];

  for (const file of files) {
    const validationError = validateUpload(file);

    if (validationError) {
      rejected.push({ fileName: file.name, reason: validationError });
      continue;
    }

    const detectedType = detectFileType(file);

    if (!detectedType) {
      rejected.push({
        fileName: file.name,
        reason: "We could not determine the file type.",
      });
      continue;
    }

    materials.push({
      id: createId("material"),
      name: file.name,
      extension: detectedType.extension,
      kind: detectedType.kind,
      size: file.size,
      mimeType: file.type,
      uploadedAt: Date.now(),
      previewError: undefined,
      previewStatus: "pending",
      previewItems: generatePreviewItems(file, detectedType),
    });
  }

  return { materials, rejected };
}

export function createMaterialFromCourseContentRecord(
  file: File,
  record: CourseContentRecord,
): Material | null {
  const validationError = validateUpload(file);

  if (validationError) {
    return null;
  }

  const detectedType = detectFileType(file);

  if (!detectedType) {
    return null;
  }

  return {
    id: `course-content-${record.id}`,
    name: record.material_name,
    extension: detectedType.extension,
    kind: detectedType.kind,
    size: record.data_size,
    mimeType: file.type,
    uploadedAt: Date.now(),
    accessUrl: record.access_url,
    databaseId: record.id,
    previewError: undefined,
    previewStatus: record.preview_status ?? "pending",
    previewItems: generatePreviewItems(file, detectedType),
  };
}

export function generatePreviewItems(
  file: File,
  detectedType: DetectedFileType,
): PreviewItem[] {
  if (detectedType.kind === "image") {
    return [
      {
        id: createId("preview"),
        index: 0,
        kind: "image",
        label: "Image",
        title: "Original image",
        subtitle: "Uploaded image preview",
        placeholderLayout: "image",
        imageUrl: URL.createObjectURL(file),
      },
    ];
  }

  const itemKind =
    detectedType.kind === "pdf"
      ? "page"
      : detectedType.kind === "ppt"
        ? "slide"
        : "page";
  const item = PENDING_PREVIEW_COPY[detectedType.kind];

  return [{
    id: createId("preview"),
    index: 0,
    kind: itemKind,
    label: item.label,
    title: item.title,
    subtitle: item.subtitle,
    placeholderLayout: item.placeholderLayout,
  }];
}

export function applyPreviewManifestToMaterial(
  material: Material,
  manifest: CourseContentPreviewManifest,
): Material {
  if (material.kind === "image") {
    return material;
  }

  const previewItems =
    manifest.items.length > 0
      ? manifest.items.map((item) => {
          const placeholderLayout: PlaceholderLayout =
            item.kind === "slide" ? "diagram" : "document";

          return {
            id: item.id,
            index: item.index,
            kind: item.kind,
            label: item.label,
            title: item.title,
            subtitle: item.subtitle,
            placeholderLayout,
            imageUrl: item.image_url,
          };
        })
      : createStatusPlaceholderItems(
          material.kind,
          manifest.preview_status,
          manifest.preview_error,
          material.previewItems[0]?.id,
        );

  return {
    ...material,
    accessUrl: manifest.access_url,
    previewError: manifest.preview_error ?? undefined,
    previewStatus: manifest.preview_status,
    previewItems,
  };
}

export function generateRecommendations(material: Material | null): Recommendation[] {
  const kind = material?.kind ?? "empty";
  const descriptions = RECOMMENDATION_TEXT[kind];

  return [
    {
      id: "clarity",
      title: "Clarity",
      label: "Content",
      description: descriptions.clarity,
      accent: "green",
      applied: false,
      disabled: !material,
    },
    {
      id: "visuals",
      title: "Visuals",
      label: "Design",
      description: descriptions.visuals,
      accent: "pink",
      applied: false,
      disabled: !material,
    },
    {
      id: "interaction",
      title: "Interaction",
      label: "Engagement",
      description: descriptions.interaction,
      accent: "cream",
      applied: false,
      disabled: !material,
    },
  ];
}

export function getSelectedMaterial(
  materials: Material[],
  selectedMaterialId: string | null,
): Material | null {
  if (!selectedMaterialId) {
    return null;
  }

  return materials.find((material) => material.id === selectedMaterialId) ?? null;
}

export function getSelectedPreviewItem(
  material: Material | null,
  selectedPreviewItemId: string | null,
): PreviewItem | null {
  if (!material || !selectedPreviewItemId) {
    return null;
  }

  return material.previewItems.find((item) => item.id === selectedPreviewItemId) ?? null;
}

export function getPreviewLabel(material: Material, previewItem: PreviewItem | null): string {
  const currentIndex = previewItem ? previewItem.index + 1 : 0;
  const total = material.previewItems.length;
  const previewKind = previewItem?.kind ?? material.previewItems[0]?.kind;

  switch (previewKind) {
    case "page":
      return `Page ${currentIndex} of ${total}`;
    case "slide":
      return `Slide ${currentIndex} of ${total}`;
    case "image":
      return `Image ${currentIndex || 1} of ${total}`;
    default:
      return `Page ${currentIndex} of ${total}`;
  }
}

export function getMaterialMeta(material: Material, expanded: boolean): string {
  const countLabel = getPreviewCountLabel(material);

  if (expanded) {
    return `${formatFileSize(material.size)} • ${formatUploadMoment(material.uploadedAt)}`;
  }

  return `${material.extension.toUpperCase()} • ${countLabel}`;
}

export function getPreviewCountLabel(material: Material): string {
  const count = material.previewItems.length;
  const previewKind = material.previewItems[0]?.kind;
  const noun =
    previewKind === "slide"
      ? "slide"
      : previewKind === "image"
        ? "image"
        : "page";

  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function getMaterialBaseName(name: string): string {
  const extensionIndex = name.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return name;
  }

  return name.slice(0, extensionIndex);
}

export function formatFileSize(size: number): string {
  return formatCourseContentSize(size);
}

export function revokeMaterialObjectUrls(materials: Material[]): void {
  for (const material of materials) {
    for (const previewItem of material.previewItems) {
      if (previewItem.imageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewItem.imageUrl);
      }
    }
  }
}

export const SUPPORTED_FILE_TYPE_LABEL =
  SUPPORTED_COURSE_CONTENT_ACCEPT;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatUploadMoment(uploadedAt: number): string {
  const uploadedDate = new Date(uploadedAt);
  const now = new Date();

  const sameDay =
    uploadedDate.getFullYear() === now.getFullYear() &&
    uploadedDate.getMonth() === now.getMonth() &&
    uploadedDate.getDate() === now.getDate();

  if (sameDay) {
    return "Today";
  }

  return uploadedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createStatusPlaceholderItems(
  kind: Exclude<MaterialKind, "image">,
  previewStatus: CourseContentPreviewStatus,
  previewError?: string | null,
  existingId?: string,
): PreviewItem[] {
  const baseItem = PENDING_PREVIEW_COPY[kind];
  const subtitle =
    previewStatus === "failed"
      ? previewError ?? "Preview rendering failed for this source."
      : baseItem.subtitle;

  return [
    {
      id: existingId ?? createId("preview"),
      index: 0,
      kind: kind === "ppt" ? "slide" : "page",
      label: baseItem.label,
      title: previewStatus === "failed" ? "Preview unavailable" : baseItem.title,
      subtitle,
      placeholderLayout: baseItem.placeholderLayout,
    },
  ];
}
