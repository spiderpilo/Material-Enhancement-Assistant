import { getApiBaseUrl } from "@/lib/api/course-content";

// Tokens live in localStorage, so each browser (and browser profile) keeps its own
// session: opening the app in another browser requires signing in there too.
const ACCESS_TOKEN_KEY = "mea_access_token";
const REFRESH_TOKEN_KEY = "mea_refresh_token";

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeSession(tokens: SessionTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let pendingRefresh: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new pair. Concurrent callers share one
 * request: refresh tokens are single-use, so a second parallel refresh would be
 * treated by the API as token reuse and end the session.
 */
export function refreshAccessToken(): Promise<string | null> {
  pendingRefresh ??= performRefresh().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/refresh-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }).catch(() => null);

  if (!response) {
    // Network failure: keep the session so a later request can retry.
    return null;
  }

  if (!response.ok) {
    clearSession();
    return null;
  }

  const tokens = (await response.json()) as SessionTokens;
  storeSession(tokens);
  return tokens.access_token;
}

/**
 * fetch() for protected API routes. Sends the current access token and, when the API
 * answers 401 (expired or revoked token), refreshes once and retries the request.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, withAccessToken(init, getStoredAccessToken()));
  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) {
    return response;
  }

  return fetch(input, withAccessToken(init, refreshedToken));
}

export async function signOut(): Promise<void> {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    await authorizedFetch(`${getApiBaseUrl()}/logout`, { method: "POST" }).catch(() => undefined);
  }
  clearSession();
}

function withAccessToken(init: RequestInit, accessToken: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return { ...init, headers };
}

export type OAuthProvider = "google" | "github";

/** Full-page navigation target that starts Google or GitHub sign-in on the API. */
export function oauthAuthorizeUrl(provider: OAuthProvider): string {
  return `${getApiBaseUrl()}/oauth/${provider}/authorize`;
}

/** Trade the one-time code from the OAuth redirect for a session and store it. */
export async function exchangeOAuthCode(code: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/oauth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<SessionTokens> & { detail?: string };

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.detail || "Unable to finish signing in.");
  }
  storeSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
}

/** Create the account for a first-time Google/GitHub sign-in and store its session. */
export async function completeOAuthSignup(input: {
  ticket: string;
  username: string;
  profession: "student" | "professor";
}): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/oauth/complete-signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<SessionTokens> & { detail?: unknown };

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Unable to create your account.");
  }
  storeSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
}
