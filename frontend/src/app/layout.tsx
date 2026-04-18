import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Material Enhancement Assistant",
  description: "AI feedback for lecture slides and documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
