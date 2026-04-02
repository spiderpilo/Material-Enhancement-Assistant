import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Material Enhancement Assistant",
  description:
    "Frontend for reviewing AI-assisted improvements to course materials.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
