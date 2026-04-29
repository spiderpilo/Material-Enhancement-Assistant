import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell/AppShell";
import { CourseContentUploadClient } from "@/components/course-content-upload/CourseContentUploadClient";

export const metadata: Metadata = {
  title: "Uploads | Material Enhancement Assistant",
  description: "Upload course content into Supabase-backed material records.",
};

export default function UploadsPage() {
  return (
    <AppShell
      activeNavItem="uploads"
      headerTitle="Course Content Upload"
      showHeaderSearch={false}
    >
      <CourseContentUploadClient />
    </AppShell>
  );
}
