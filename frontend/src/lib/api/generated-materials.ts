import { getApiBaseUrl } from "@/lib/api/course-content";

export type GeneratedMaterial = {
  id?: number | null;
  uuid: string;
  created_at: string;
  input_token?: number | null;
  output_token?: number | null;
  project_uuid: string;
  name?: string | null;
  file_location: string;
  tool_type: string;
  source_material_ids: number[];
  payload: Record<string, unknown>;
};

type ListGeneratedMaterialsResponse = {
  generated_materials: GeneratedMaterial[];
};

type DownloadGeneratedMaterialResponse = {
  download_url: string;
  file_name: string;
};

export type GeneratedMaterialDownloadFormat = "pptx" | "pdf";

export async function listGeneratedMaterials({
  accessToken,
  projectUuid,
}: {
  accessToken: string;
  projectUuid: string;
}): Promise<GeneratedMaterial[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/generated-materials`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as
    | ListGeneratedMaterialsResponse
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to load generated materials.",
    );
  }

  const generatedMaterials =
    "generated_materials" in payload ? payload.generated_materials : undefined;

  return Array.isArray(generatedMaterials) ? generatedMaterials : [];
}

export async function generateSlideDeck({
  accessToken,
  projectUuid,
  materialIds,
  slideCount = 10,
}: {
  accessToken: string;
  projectUuid: string;
  materialIds: number[];
  slideCount?: number;
}): Promise<GeneratedMaterial> {
  const response = await fetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/slide-decks/generate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        material_ids: materialIds,
        slide_count: slideCount,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as
    | GeneratedMaterial
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to generate slide deck.",
    );
  }

  return payload as GeneratedMaterial;
}

export async function getGeneratedMaterialDownload({
  accessToken,
  format = "pptx",
  projectUuid,
  generatedMaterialUuid,
}: {
  accessToken: string;
  format?: GeneratedMaterialDownloadFormat;
  projectUuid: string;
  generatedMaterialUuid: string;
}): Promise<DownloadGeneratedMaterialResponse> {
  const searchParams = new URLSearchParams({ format });
  const response = await fetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/generated-materials/${encodeURIComponent(generatedMaterialUuid)}/download?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = (await response.json().catch(() => ({}))) as
    | DownloadGeneratedMaterialResponse
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to download generated material.",
    );
  }

  return payload as DownloadGeneratedMaterialResponse;
}
