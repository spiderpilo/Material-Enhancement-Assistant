import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Curriculum Updater",
  description: "AI feedback for lecture slides and academic materials.",
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
