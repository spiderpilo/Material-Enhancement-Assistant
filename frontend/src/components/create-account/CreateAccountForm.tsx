"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDownIcon } from "@/components/material-enhancement/icons";

const backendUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:8000";

export function CreateAccountForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "professor">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${backendUrl}/create-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          username,
          password,
          profession: role,
        }),
      });

      const payload = (await response.json()) as
        | { detail?: string }
        | { auth_user_id: string; profile: { username: string } };

      if (!response.ok) {
        throw new Error("detail" in payload && payload.detail ? payload.detail : "An error occurred");
      }

      const successPayload = payload as { auth_user_id: string; profile: { username: string } };

      setSuccess(`Account created successfully for ${successPayload.profile.username}. Redirecting to login...`);
      setEmail("");
      setUsername("");
      setPassword("");
      setRole("student");
      router.push("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-14">
      <div className="mx-auto w-full max-w-[460px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cde0b2]">
          Account setup
        </p>
        <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#f3f5ee] sm:text-[2.7rem]">
          Create Account
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#b5bcae]">
          Create your profile, choose your role, and step directly into the
          same premium workspace used for active academic projects.
        </p>

        <form onSubmit={handleSignUp} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
              Email
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="auth-input"
            />
          </label>

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
              autoComplete="username"
              className="auth-input"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
              Password
            </span>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
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
                onChange={(event) =>
                  setRole(event.target.value as "student" | "professor")
                }
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

          {error ? <p className="auth-status-error text-sm">{error}</p> : null}
          {success ? <p className="auth-status-success text-sm">{success}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="auth-primary-button inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-sm font-semibold text-[#314126] focus:outline-none"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-[12px] text-[#91998b]">
          Already have an account?{" "}
          <Link href="/login" className="auth-link font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
