import type { CourseContentRecord } from "@/lib/api/course-content";
import { getApiBaseUrl } from "@/lib/api/course-content";

export type Project = {
  id: number;
  name: string;
  created_by: string;
  owner_auth_user_id?: string | null;
  created_on?: string | null;
  materials: CourseContentRecord[];
  material_count: number;
  last_updated?: string | null;
};

export async function listProjects(accessToken: string, limit?: number): Promise<Project[]> {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await fetch(`${getApiBaseUrl()}/projects${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return readProjectPayload<Project[]>(response, "Unable to load projects.");
}

export async function getProject({
  accessToken,
  projectId,
}: {
  accessToken: string;
  projectId: number;
}): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return readProjectPayload<Project>(response, "Unable to load project.");
}

export async function createProject({
  accessToken,
  name,
}: {
  accessToken: string;
  name: string;
}): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  return readProjectPayload<Project>(response, "Unable to create project.");
}

export async function updateProjectName({
  accessToken,
  name,
  projectId,
}: {
  accessToken: string;
  name: string;
  projectId: number;
}): Promise<Project> {
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  return readProjectPayload<Project>(response, "Unable to rename project.");
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
