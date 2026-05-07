import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { CreateAccountForm } from "@/components/create-account/CreateAccountForm";

export const metadata: Metadata = {
  title: "Create Account | Curriculum Updater",
  description: "Create an account for Curriculum Updater.",
};

export default function CreateAccountPage() {
  return (
    <AuthShell
      showcase={
        <AuthShowcase
          eyebrow="Join the workspace"
          title="Create your account"
          description="Set up your profile so the assistant can track your role and keep your course materials organized."
          steps={[
            "1. Sign up with your academic email.",
            "2. Choose whether you are a student or professor.",
            "3. Start uploading course materials right away.",
          ]}
        />
      }
    >
      <CreateAccountForm />
    </AuthShell>
  );
}
