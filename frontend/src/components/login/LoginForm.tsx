import Link from "next/link";

import {
  EyeIcon,
  GitHubLogoIcon,
  GoogleLogoIcon,
  MicrosoftLogoIcon,
} from "@/components/login/LoginIcons";

export function LoginForm() {
  return (
    <section className="h-full bg-[#fdfcf9] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[430px]">
        <h1 className="text-center font-[family:var(--font-display)] text-[2.35rem] font-semibold tracking-[-0.05em] text-[#2d312d] sm:text-[2.7rem]">
          Welcome Back
        </h1>
        <p className="text-center mt-2 text-sm leading-6 text-[#7c776f]">
          Sign in to access your academic curriculum management portal.
        </p>

        <form className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-[#625d56]">
              Username
            </span>
            <input
              type="text"
              placeholder="Enter your username"
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
                className="h-12 w-full rounded-[12px] border border-[#eee7db] bg-[#f4efe8] px-4 pr-11 text-sm text-[#2f322d] outline-none transition placeholder:text-[#b0a79b] focus:border-[#5d8960] focus:bg-white focus:ring-4 focus:ring-[rgba(93,137,96,0.12)]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#c0b7aa]">
                <EyeIcon className="h-4 w-4" />
              </span>
            </span>
          </label>

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#5a8a5e] text-sm font-semibold text-white shadow-[0_14px_28px_-18px_rgba(90,138,94,0.8)] transition hover:bg-[#4f7b53] focus:outline-none focus:ring-4 focus:ring-[rgba(90,138,94,0.18)]"
          >
            Login
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
          New to the institution?{" "}
          <Link href="#" className="text-[#5a8a5e] transition hover:text-[#4f7b53]">
            Request Access
          </Link>
        </p>
      </div>
    </section>
  );
}
