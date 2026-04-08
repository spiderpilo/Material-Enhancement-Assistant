export type UploadStatus = "queued" | "uploading" | "success" | "error";

export type CourseContentRecord = {
  id: number;
  material_name: string;
  access_url: string;
  data_size: number;
};

export type UploadListItem = {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;
  record?: CourseContentRecord;
};
