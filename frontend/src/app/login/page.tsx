import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginShowcase } from "@/components/login/LoginShowcase";

export const metadata: Metadata = {
  title: "Login | Curriculum Updater",
  description: "Secure sign in for Curriculum Updater.",
};

export default function LoginPage() {
  return (
    <AuthShell showcase={<LoginShowcase />}>
      <LoginForm />
    </AuthShell>
  );
}
