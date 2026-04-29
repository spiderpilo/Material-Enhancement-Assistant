"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    <section className="bg-[#fdfcf9] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[430px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7f9c80]">
          Account setup
        </p>
        <h2 className="mt-3 font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#2d312d] sm:text-[2.7rem]">
          Create Account
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#7c776f]">
          Create your profile and connect it to your academic role.
        </p>

        <form onSubmit={handleSignUp} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Email
            </span>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Username
            </span>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Password
            </span>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Role
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "student" | "professor")}
              className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 text-sm text-[#2f322d] outline-none transition focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
            >
              <option value="student">Student</option>
              <option value="professor">Professor</option>
            </select>
          </label>

          {error ? <p className="text-sm text-[#b54d4d]">{error}</p> : null}
          {success ? <p className="text-sm text-[#4f7a57]">{success}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#5a8a5e] text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(90,138,94,0.8)] transition hover:bg-[#4f7b53] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.18)] disabled:cursor-not-allowed disabled:bg-[#92a994]"
          >
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-[#90897f]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#5a8a5e] transition hover:text-[#4f7b53]">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
