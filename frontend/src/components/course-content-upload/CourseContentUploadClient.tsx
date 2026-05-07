"use client";

import { MetadataPanel } from "@/components/course-content-upload/MetadataPanel";
import { UploadDropzone } from "@/components/course-content-upload/UploadDropzone";
import { UploadedDocumentsCard } from "@/components/course-content-upload/UploadedDocumentsCard";

export function CourseContentUploadClient() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
      <div className="space-y-6">
        <UploadDropzone />
        <UploadedDocumentsCard />
      </div>

      <MetadataPanel />
    </div>
  );
}
