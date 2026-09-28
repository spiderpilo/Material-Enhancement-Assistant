"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDownIcon } from "@/components/material-enhancement/icons";
import { completeOAuthSignup, exchangeOAuthCode } from "@/lib/api/auth";

type CallbackState =
  | { kind: "loading"; code: string }
  | { kind: "error"; message: string }
  | { kind: "signup"; ticket: string; email: string; name: string };

// The result arrives in the URL fragment, which only exists in the browser.
export const OAuthCallback = dynamic(() => Promise.resolve(OAuthCallbackContent), { ssr: false });

function readCallbackFragment(): CallbackState {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const code = params.get("code");
  const ticket = params.get("signup");

  if (code) {
    return { kind: "loading", code };
  }
  if (ticket) {
    return { kind: "signup", ticket, email: params.get("email") ?? "", name: params.get("name") ?? "" };
  }
  return { kind: "error", message: params.get("error") || "Sign-in did not complete. Please try again." };
}

function OAuthCallbackContent() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>(readCallbackFragment);
  const [username, setUsername] = useState(() => (state.kind === "signup" ? suggestUsername(state.email) : ""));
  const [role, setRole] = useState<"student" | "professor">("student");
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState("");
  // The login code is single-use: a second exchange (React StrictMode runs effects
  // twice in development) would be treated as replay and end the session.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    // Drop the code/ticket from the address bar and history right away.
    window.history.replaceState(null, "", window.location.pathname);

    if (state.kind !== "loading") {
      return;
    }
    exchangeOAuthCode(state.code)
      .then(() => router.replace("/dashboard"))
      .catch((cause: unknown) =>
        setState({
          kind: "error",
          message: cause instanceof Error ? cause.message : "Unable to finish signing in.",
        }),
      );
  }, [router, state]);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind !== "signup") {
      return;
    }

    setSubmitting(true);
    setSignupError("");
    try {
      await completeOAuthSignup({ ticket: state.ticket, username: username.trim(), profession: role });
      router.replace("/dashboard");
    } catch (cause) {
      setSignupError(cause instanceof Error ? cause.message : "Unable to create your account.");
      setSubmitting(false);
    }
  };

  return (
    <section className="flex h-full items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-14">
      <div className="mx-auto w-full max-w-[460px]">
        {state.kind === "loading" ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cde0b2]">
              Secure sign in
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#f3f5ee] sm:text-[2.7rem]">
              Signing you in...
            </h2>
          </>
        ) : null}

        {state.kind === "error" ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cde0b2]">
              Secure sign in
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#f3f5ee] sm:text-[2.7rem]">
              Sign-in failed
            </h2>
            <p className="auth-status-error mt-6 text-sm">{state.message}</p>
            <Link
              href="/login"
              className="auth-primary-button mt-8 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-sm font-semibold text-[#314126] focus:outline-none"
            >
              Back to sign in
            </Link>
          </>
        ) : null}

        {state.kind === "signup" ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cde0b2]">
              Account setup
            </p>
            <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#f3f5ee] sm:text-[2.7rem]">
              Finish your account
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#b5bcae]">
              {state.name ? `Welcome, ${state.name}. ` : ""}Pick a username and your role to finish
              creating your account for <span className="text-[#e3e8dc]">{state.email}</span>.
            </p>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
                  Username
                </span>
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  maxLength={80}
                  autoComplete="username"
                  className="auth-input"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
                  Role
                </span>
                <span className="relative block">
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as "student" | "professor")}
                    className="auth-input auth-select appearance-none pr-12"
                  >
                    <option value="student">Student</option>
                    <option value="professor">Professor</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#7f8979]">
                    <ChevronDownIcon className="h-4 w-4" />
                  </span>
                </span>
              </label>

              {signupError ? <p className="auth-status-error text-sm">{signupError}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="auth-primary-button inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-sm font-semibold text-[#314126] focus:outline-none"
              >
                {submitting ? "Creating..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-[12px] text-[#91998b]">
              Not you?{" "}
              <Link href="/login" className="auth-link font-medium">
                Back to sign in
              </Link>
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function suggestUsername(email: string): string {
  return email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) ?? "";
}
