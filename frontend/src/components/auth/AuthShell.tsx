import type { ReactNode } from "react";
import Link from "next/link";

import { BrandMarkIcon } from "@/components/course-content-upload/icons";

type AuthShellProps = {
  children: ReactNode;
  showcase: ReactNode;
};

const footerLinks = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Institutional Access" },
  { href: "#", label: "Help Center" },
];

export function AuthShell({ children, showcase }: AuthShellProps) {
  const currentYear = new Date().getFullYear();

  return (
    <main className="auth-premium min-h-screen text-foreground">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex flex-1 items-center justify-center">
          <div className="auth-stage grid w-full max-w-[1360px] overflow-hidden rounded-[30px] lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:min-h-[760px]">
            <div className="min-w-0">{showcase}</div>
            <div className="auth-form-shell min-w-0">{children}</div>
          </div>
        </div>

        <footer className="mt-6 border-t border-[rgba(255,255,255,0.08)] px-1 pt-5 text-[11px] text-[#8f978a] sm:mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#181b16] text-[#d8ebba]">
                <BrandMarkIcon className="h-4 w-4" />
              </span>

              <div>
                <p className="text-[13px] font-semibold text-[#eef2e8]">
                  Curriculum Updater
                </p>
                <p>
                  &copy; {currentYear} Curriculum Updater. Built for academic
                  excellence.
                </p>
              </div>
            </div>

            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]"
            >
              {footerLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="transition-colors duration-200 hover:text-[#dbeabf]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
