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

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

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
    <section className="h-full bg-[#fdfcf9] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[430px]">
        <h1 className="text-center font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#2d312d] sm:text-[2.7rem]">
          Welcome Back
        </h1>
        <p className="text-center mt-2 text-sm leading-6 text-[#7c776f]">
          Sign in to access your account.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Email
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Password
              <Link
                href="#"
                className="text-[10px] tracking-[0.04em] text-[#7f9c80] transition hover:text-[#4f7a57]"
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
                className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 pr-11 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#c0b7aa]">
                <EyeIcon className="h-4 w-4" />
              </span>
            </span>
          </label>

          {error ? <p className="text-sm text-[#b54d4d]">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#5a8a5e] text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(90,138,94,0.8)] transition hover:bg-[#4f7b53] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.18)]"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-7">
          <p className="text-center text-[11px] text-[#8d877d]">
            Or continue with
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              aria-label="Continue with Google"
              className="flex h-11 items-center justify-center rounded-[10px] border border-[#ece2d4] bg-white text-[#2f322d] transition hover:border-[#d9cdbd] hover:bg-[#fbf8f3] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.12)]"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <GoogleLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Continue with GitHub"
              className="flex h-11 items-center justify-center rounded-[10px] border border-[#ece2d4] bg-white text-[#2f322d] transition hover:border-[#d9cdbd] hover:bg-[#fbf8f3] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.12)]"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <GitHubLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Continue with Microsoft"
              className="flex h-11 items-center justify-center rounded-[10px] border border-[#ece2d4] bg-white text-[#2f322d] transition hover:border-[#d9cdbd] hover:bg-[#fbf8f3] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.12)]"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <MicrosoftLogoIcon className="h-[18px] w-[18px]" />
              </span>
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-[#90897f]">
          Don&apos;t have an account?{" "}
          <Link href="/createAccount" className="text-[#5a8a5e] transition hover:text-[#4f7b53]">
            Create account
          </Link>
        </p>
      </div>
    </section>
  );
}
