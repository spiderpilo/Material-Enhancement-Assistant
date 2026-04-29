import {
  type CourseContentRecord,
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

const PREVIEW_COPY: Record<
  Exclude<MaterialKind, "image">,
  Array<{ label: string; title: string; subtitle: string; placeholderLayout: PlaceholderLayout }>
> = {
  pdf: [
    {
      label: "Page 1",
      title: "Overview page",
      subtitle: "Structured page placeholder while PDF parsing is being connected.",
      placeholderLayout: "document",
    },
    {
      label: "Page 2",
      title: "Annotated page",
      subtitle:
        "Paragraph and callout placement will update when real page extraction is available.",
      placeholderLayout: "document",
    },
    {
      label: "Page 3",
      title: "Reference page",
      subtitle:
        "Page sequencing is ready for future parsed thumbnails and annotations.",
      placeholderLayout: "document",
    },
  ],
  ppt: [
    {
      label: "Slide 1",
      title: "Title slide",
      subtitle:
        "Structured slide placeholder while presentation parsing is being connected.",
      placeholderLayout: "diagram",
    },
    {
      label: "Slide 2",
      title: "Content slide",
      subtitle:
        "Hierarchy and diagram placeholders will swap to real slide previews later.",
      placeholderLayout: "diagram",
    },
    {
      label: "Slide 3",
      title: "Discussion slide",
      subtitle:
        "Slide navigation is wired for future thumbnail extraction and AI markup.",
      placeholderLayout: "diagram",
    },
  ],
  doc: [
    {
      label: "Section 1",
      title: "Introduction",
      subtitle:
        "Structured document placeholder while section parsing is being connected.",
      placeholderLayout: "outline",
    },
    {
      label: "Section 2",
      title: "Key points",
      subtitle:
        "Outline cards will update with real headings and excerpts after parsing.",
      placeholderLayout: "outline",
    },
    {
      label: "Section 3",
      title: "Supporting notes",
      subtitle:
        "Selection logic is ready for downstream document segmentation.",
      placeholderLayout: "outline",
    },
  ],
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
        : "section";

  return PREVIEW_COPY[detectedType.kind].map((item, index) => ({
    id: createId("preview"),
    index,
    kind: itemKind,
    label: item.label,
    title: item.title,
    subtitle: item.subtitle,
    placeholderLayout: item.placeholderLayout,
  }));
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

  switch (material.kind) {
    case "pdf":
      return `Page ${currentIndex} of ${total}`;
    case "ppt":
      return `Slide ${currentIndex} of ${total}`;
    case "doc":
      return `Section ${currentIndex} of ${total}`;
    case "image":
      return `Image ${currentIndex || 1} of ${total}`;
    default:
      return `${currentIndex} of ${total}`;
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
  const noun =
    material.kind === "pdf"
      ? "page"
      : material.kind === "ppt"
        ? "slide"
        : material.kind === "doc"
          ? "section"
          : "image";

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
      if (previewItem.imageUrl) {
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
