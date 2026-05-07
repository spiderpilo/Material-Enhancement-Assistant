"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  EyeIcon,
  GitHubLogoIcon,
  GoogleLogoIcon,
  MicrosoftLogoIcon,
} from "@/components/login/LoginIcons";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:8000";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${backendUrl}/login-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        detail?: string;
        access_token?: string;
      };

      if (!response.ok) {
        if (response.status == 401) {
          throw new Error("Incorrect email or password");
        }
        throw new Error(payload.detail || "Unable to sign in.");
      }

      if (payload.access_token) {
        localStorage.setItem("mea_access_token", payload.access_token);
      }

      router.push("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex h-full items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 xl:px-14">
      <div className="mx-auto w-full max-w-[460px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cde0b2]">
          Secure sign in
        </p>
        <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#f3f5ee] sm:text-[2.7rem]">
          Welcome back
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#b5bcae]">
          Sign in to access your projects, AI workflows, and academic material
          enhancement tools.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
              Email
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="auth-input"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ca595]">
              Password
              <Link
                href="#"
                className="auth-link-subtle text-[10px] tracking-[0.08em]"
              >
                Forgot password?
              </Link>
            </span>
            <span className="relative block">
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="auth-input pr-11"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#7f8979]">
                <EyeIcon className="h-4 w-4" />
              </span>
            </span>
          </label>

          {error ? <p className="auth-status-error text-sm">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="auth-primary-button inline-flex h-[52px] w-full items-center justify-center rounded-[16px] text-sm font-semibold text-[#314126] focus:outline-none"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8">
          <div className="auth-divider" />
          <p className="mt-5 text-center text-[11px] uppercase tracking-[0.16em] text-[#879080]">
            Or continue with
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              aria-label="Continue with Google"
              className="auth-social-button group flex h-[52px] items-center justify-center rounded-[16px] focus:outline-none"
            >
              <span className="flex h-5 w-5 items-center justify-center transition-transform duration-250 ease-out group-hover:scale-110">
                <GoogleLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Continue with GitHub"
              className="auth-social-button group flex h-[52px] items-center justify-center rounded-[16px] focus:outline-none"
            >
              <span className="flex h-5 w-5 items-center justify-center transition-transform duration-250 ease-out group-hover:scale-110">
                <GitHubLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Continue with Microsoft"
              className="auth-social-button group flex h-[52px] items-center justify-center rounded-[16px] focus:outline-none"
            >
              <span className="flex h-5 w-5 items-center justify-center transition-transform duration-250 ease-out group-hover:scale-110">
                <MicrosoftLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-[#91998b]">
          Don&apos;t have an account?{" "}
          <Link href="/createAccount" className="auth-link font-medium">
            Create account
          </Link>
        </p>
      </div>
    </section>
  );
}
