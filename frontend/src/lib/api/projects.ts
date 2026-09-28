import { authorizedFetch } from "@/lib/api/auth";
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
  locations?: string[];
};

export type ProjectChatSelectionMode =
  | "selected"
  | "title_match"
  | "fallback"
  | "rag"
  | "rag_selected"
  | "rag_unavailable";

export type ProjectChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources: ProjectChatSource[];
  selection_mode?: ProjectChatSelectionMode | null;
};

export type ProjectChatHistoryResponse = {
  messages: ProjectChatMessage[];
};

type ListGeneratedQuizHistoryResponse = {
  generated_quizzes?: GeneratedQuizHistoryRecord[];
};

export async function listProjects(accessToken: string, limit?: number): Promise<ProjectSummary[]> {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await authorizedFetch(`${getApiBaseUrl()}/projects${query}`, {
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
  const response = await authorizedFetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
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

  const response = await authorizedFetch(`${getApiBaseUrl()}/projects`, {
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
  const response = await authorizedFetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
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
  const response = await authorizedFetch(`${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}`, {
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
  const response = await authorizedFetch(
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

export type ProjectChatStreamEvent =
  | { type: "status"; phase: "searching" | "writing" }
  | { type: "sources"; selection_mode: ProjectChatSelectionMode; sources: ProjectChatSource[] }
  | { type: "delta"; text: string }
  | { type: "done"; messages: ProjectChatMessage[] }
  | { type: "error"; detail: string };

/**
 * Ask a question and receive the answer as it is written.
 *
 * Calls `onEvent` for every server-sent event and resolves with the saved conversation
 * once the `done` event arrives. Rejects on HTTP errors, `error` events, or a stream that
 * ends early. Pass `signal` to stop listening.
 */
export async function streamProjectQuestion({
  accessToken,
  projectUuid,
  message,
  selectedMaterialId,
  selectedMaterialIds,
  onEvent,
  signal,
}: {
  accessToken: string;
  projectUuid: string;
  message: string;
  selectedMaterialId?: number | null;
  selectedMaterialIds?: number[] | null;
  onEvent: (event: ProjectChatStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<ProjectChatMessage[]> {
  const response = await authorizedFetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/chat/stream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message,
        selected_material_id: selectedMaterialId ?? null,
        selected_material_ids: selectedMaterialIds ?? [],
      }),
      signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new Error(await readProjectErrorMessage(response, "Unable to generate a chat response."));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += value;
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const event = parseServerSentEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      if (!event) {
        continue;
      }
      if (event.type === "error") {
        throw new Error(event.detail || "Unable to generate a chat response.");
      }
      onEvent(event);
      if (event.type === "done") {
        await reader.cancel();
        return event.messages;
      }
    }
  }

  throw new Error("The answer was interrupted. Try again.");
}

function parseServerSentEvent(block: string): ProjectChatStreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as ProjectChatStreamEvent;
  } catch {
    return null;
  }
}

export async function getProjectChatHistory({
  accessToken,
  projectUuid,
}: {
  accessToken: string;
  projectUuid: string;
}): Promise<ProjectChatHistoryResponse> {
  const response = await authorizedFetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/chat`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Cache-Control": "no-cache",
      },
    },
  );

  return readProjectPayload<ProjectChatHistoryResponse>(
    response,
    "Unable to load chat memory.",
  );
}

export async function clearProjectChatHistory({
  accessToken,
  projectUuid,
}: {
  accessToken: string;
  projectUuid: string;
}): Promise<void> {
  const response = await authorizedFetch(
    `${getApiBaseUrl()}/projects/${encodeURIComponent(projectUuid)}/chat`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.ok) {
    return;
  }

  throw new Error(
    await readProjectErrorMessage(response, "Unable to start a new conversation."),
  );
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
