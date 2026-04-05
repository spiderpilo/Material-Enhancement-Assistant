import type { Metadata } from "next";
import { Literata, Nunito_Sans } from "next/font/google";

import "./globals.css";

const uiFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const displayFont = Literata({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Curriculum Updater",
  description:
    "Upload and organize curriculum materials for AI-assisted analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`${uiFont.variable} ${displayFont.variable} flex min-h-full flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
