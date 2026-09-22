"use client";

import { useEffect, useState } from "react";

import { getStoredAccessToken } from "@/lib/api/auth";
import { getCourseContentFile } from "@/lib/api/course-content";

type PdfViewerState =
  | { status: "resolving" }
  | { status: "loading"; url: string }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

type ResolvedFile = { requestKey: string; state: PdfViewerState };

/**
 * Shows an uploaded PDF inline. The URL is requested from the API on mount (and on
 * retry) rather than taken from `access_url`, so the API can confirm the file exists
 * and the viewer gets a readable error instead of the storage provider's XML page.
 */
export function PdfViewer({
  courseContentId,
  materialName,
}: {
  courseContentId: number;
  materialName: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<ResolvedFile | null>(null);
  const requestKey = `${courseContentId}:${attempt}`;
  // Anything resolved for an earlier material or attempt is stale until the new request lands.
  const state: PdfViewerState =
    resolved?.requestKey === requestKey ? resolved.state : { status: "resolving" };

  useEffect(() => {
    let isCancelled = false;
    const settle = (next: PdfViewerState) => {
      if (!isCancelled) {
        setResolved({ requestKey, state: next });
      }
    };

    resolveFileUrl(courseContentId)
      .then((url) => settle({ status: "loading", url }))
      .catch((cause: unknown) =>
        settle({
          status: "error",
          message: cause instanceof Error ? cause.message : "Unable to load the original file.",
        }),
      );

    return () => {
      isCancelled = true;
    };
  }, [courseContentId, requestKey]);

  if (state.status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#fcfbfa] px-8 text-center">
        <p className="text-[13px] font-semibold text-[#44403c]">Can&apos;t show this PDF</p>
        <p className="max-w-[420px] text-[12px] leading-5 text-[#78716c]">{state.message}</p>
        <button
          type="button"
          onClick={() => setAttempt((current) => current + 1)}
          className="rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#44403c] transition hover:bg-[#f5f5f4]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#fcfbfa]">
      {state.status !== "ready" ? (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-[#a8a29e]"
        >
          Loading PDF…
        </div>
      ) : null}
      {state.status !== "resolving" ? (
        <iframe
          key={state.url}
          src={state.url}
          title={`${materialName} (PDF)`}
          onLoad={() => setResolved({ requestKey, state: { status: "ready", url: state.url } })}
          className={["h-full w-full border-0", state.status === "ready" ? "" : "invisible"].join(" ")}
        />
      ) : null}
    </div>
  );
}

async function resolveFileUrl(courseContentId: number): Promise<string> {
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    throw new Error("Sign in to view this file.");
  }

  const file = await getCourseContentFile(courseContentId, accessToken);
  if (file.content_type && file.content_type !== "application/pdf") {
    throw new Error("This file is not a PDF, so it cannot be shown here.");
  }

  return file.url;
}
