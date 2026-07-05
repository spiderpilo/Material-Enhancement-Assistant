import type { CourseContentRecord } from "@/lib/api/course-content";
import { getApiBaseUrl } from "@/lib/api/course-content";
import type { GeneratedQuiz } from "@/lib/api/quiz";

export type ProjectSummary = {
  id?: number | null;
  project_uuid: string;
  name: string;
  owner_user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  material_count: number;
  last_updated?: string | null;
};

export type Project = ProjectSummary & {
  materials: CourseContentRecord[];
};

type ListProjectsResponse = {
  projects: ProjectSummary[];
};

export type GeneratedQuizHistoryRecord = {
  id: number;
  created_at?: string | null;
  quiz: GeneratedQuiz;
};

export type ProjectChatSource = {
  id: number;
  material_name: string;
  chunk_count?: number | null;
  top_similarity?: number | null;
};

export type ProjectChatResponse = {
  answer: string;
  selection_mode: "selected" | "title_match" | "fallback" | "rag" | "rag_selected" | "rag_unavailable";
  sources: ProjectChatSource[];
};

type ListGeneratedQuizHistoryResponse = {
  generated_quizzes?: GeneratedQuizHistoryRecord[];
};

export async function listProjects(accessToken: string, limit?: number): Promise<ProjectSummary[]> {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await fetch(`${getApiBaseUrl()}/projects${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await readProjectPayload<ListProjectsResponse>(
    response,
    "Unable to load projects.",
  );

  return Array.isArray(payload.projects) ? payload.projects : [];
}

export async function getProject({
  accessToken,
  projectUuid,
}: {
  accessToken: string;
  projectUuid: string;
}): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Cache-Control": "no-cache",
    },
  });

  return readProjectPayload<Project>(response, "Unable to load project.");
}

export async function createProject({
  accessToken,
  name,
}: {
  accessToken: string;
  name?: string;
}): Promise<ProjectSummary> {
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const requestBody = trimmedName ? { name: trimmedName } : {};

  const response = await fetch(`${getApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  return readProjectPayload<ProjectSummary>(response, "Unable to create project.");
}

export async function updateProjectTitle({
  accessToken,
  projectUuid,
  name,
}: {
  accessToken: string;
  projectUuid: string;
  name: string;
}): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.trim() }),
  });

  return readProjectPayload<Project>(response, "Unable to update project title.");
}

export async function deleteProject({
  accessToken,
  projectUuid,
}: {
  accessToken: string;
  projectUuid: string;
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    return;
  }

  throw new Error(await readProjectErrorMessage(response, "Unable to delete project."));
}

export async function listGeneratedMaterials({
  accessToken,
  projectUuid,
  tool = "quiz",
}: {
  accessToken: string;
  projectUuid: string;
  tool?: "quiz";
}): Promise<GeneratedQuizHistoryRecord[]> {
  const query = new URLSearchParams({ tool }).toString();
  const response = await fetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/generated-materials?${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = await readProjectPayload<ListGeneratedQuizHistoryResponse>(
    response,
    "Unable to load generated materials.",
  );

  return Array.isArray(payload.generated_quizzes) ? payload.generated_quizzes : [];
}

export async function askProjectQuestion({
  accessToken,
  projectUuid,
  message,
  selectedMaterialId,
}: {
  accessToken: string;
  projectUuid: string;
  message: string;
  selectedMaterialId?: number | null;
}): Promise<ProjectChatResponse> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      selected_material_id: selectedMaterialId ?? null,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | ProjectChatResponse
    | { detail?: string };

  if (!response.ok) {
    throw new Error(
      "detail" in payload && payload.detail
        ? payload.detail
        : "Unable to generate a chat response.",
    );
  }

  return payload as ProjectChatResponse;
}

async function readProjectPayload<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage;

    throw new Error(detail);
  }

  return payload as T;
}

async function readProjectErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }

  return fallbackMessage;
}
