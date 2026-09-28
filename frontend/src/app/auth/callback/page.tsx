import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginShowcase } from "@/components/login/LoginShowcase";
import { OAuthCallback } from "@/components/login/OAuthCallback";

export const metadata: Metadata = {
  title: "Signing in | Curriculum Updater",
  description: "Finishing Google or GitHub sign-in for Curriculum Updater.",
};

export default function OAuthCallbackPage() {
  return (
    <AuthShell showcase={<LoginShowcase />}>
      <OAuthCallback />
    </AuthShell>
  );
}
