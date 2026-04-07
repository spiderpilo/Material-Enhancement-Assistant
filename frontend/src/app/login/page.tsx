import type { Metadata } from "next";
import Link from "next/link";

import { BrandMarkIcon } from "@/components/course-content-upload/icons";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginShowcase } from "@/components/login/LoginShowcase";

export const metadata: Metadata = {
  title: "Login | Curriculum Updater",
  description: "Secure sign in for the Material Enhancement Assistant.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f3ede4] text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-295 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-1 flex-col justify-center">
          <div className="overflow-hidden rounded-[24px] border border-[#e4d8c8] bg-[#faf7f2] shadow-[0_28px_80px_-48px_rgba(54,43,31,0.34)]">
            <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
              <div>
                <LoginShowcase />
              </div>
              <div>
                <LoginForm />
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-[#e1d6c6] pt-5 text-[11px] text-[#7e776d] sm:mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8e0d2] text-[#33533f]">
                <BrandMarkIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#3f4039]">
                  Curriculum Updater
                </p>
                <p>&copy; 2024 Curriculum Updater. Built for academic excellence.</p>
              </div>
            </div>

            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]"
            >
              <Link href="#" className="transition hover:text-[#33533f]">
                Privacy Policy
              </Link>
              <Link href="#" className="transition hover:text-[#33533f]">
                Terms of Service
              </Link>
              <Link href="#" className="transition hover:text-[#33533f]">
                Institutional Access
              </Link>
              <Link href="#" className="transition hover:text-[#33533f]">
                Help Center
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
