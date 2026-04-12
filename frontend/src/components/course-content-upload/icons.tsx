import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandSparkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.75 9.45 9.45 2.75 12l6.7 2.55L12 21.25l2.55-6.7L21.25 12l-6.7-2.55L12 2.75Z" />
      <path d="m5.5 4.5.85 2.15L8.5 7.5 6.35 8.35 5.5 10.5l-.85-2.15L2.5 7.5l2.15-.85L5.5 4.5Z" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </IconBase>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 18H9" />
      <path d="M18 16.5H6c1.15-1.13 1.75-2.9 1.75-5.25A4.25 4.25 0 0 1 12 7a4.25 4.25 0 0 1 4.25 4.25c0 2.35.6 4.12 1.75 5.25Z" />
      <path d="M10.5 19.5a1.5 1.5 0 0 0 3 0" />
    </IconBase>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75v4.5l3 1.75" />
    </IconBase>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </IconBase>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m3.75 11.5 8.25-6.75 8.25 6.75" />
      <path d="M6.5 10.75V20h11v-9.25" />
    </IconBase>
  );
}

export function FolderStackIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 9.5a2 2 0 0 1 2-2h3l1.75 2h7.25a2 2 0 0 1 2 2v5A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-7Z" />
      <path d="M6.25 6.5V5.75A1.75 1.75 0 0 1 8 4h3.25L13 6H18a1.75 1.75 0 0 1 1.75 1.75V9" />
    </IconBase>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9.25 4.5a2.75 2.75 0 0 1 5.5 0" />
      <path d="M8.5 10.25h7" />
      <path d="M8.5 14h7" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3.5v2.25" />
      <path d="M12 18.25v2.25" />
      <path d="m5.99 5.99 1.59 1.59" />
      <path d="m16.42 16.42 1.59 1.59" />
      <path d="M3.5 12h2.25" />
      <path d="M18.25 12h2.25" />
      <path d="m5.99 18.01 1.59-1.59" />
      <path d="m16.42 7.58 1.59-1.59" />
    </IconBase>
  );
}

export function UploadCloudIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 16.25" />
    </IconBase>
  );
}

export function HelpCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.75 9.25a2.25 2.25 0 1 1 3.56 1.84c-.92.62-1.31 1.07-1.31 2.16" />
      <path d="M12 16.65h.01" />
    </IconBase>
  );
}

export function BrandMarkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 8.5 8-4.5 8 4.5-8 4.5-8-4.5Z" />
      <path d="M4 8.5v7L12 20" />
      <path d="M20 8.5v7L12 20" />
    </IconBase>
  );
}

export function ReviewBubbleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 6.25A2.25 2.25 0 0 1 7.25 4h9.5A2.25 2.25 0 0 1 19 6.25v6.5A2.25 2.25 0 0 1 16.75 15H10l-4 4v-4H7.25A2.25 2.25 0 0 1 5 12.75Z" />
      <path d="M9 8.75h6" />
      <path d="M9 11.5h4.5" />
    </IconBase>
  );
}

export function ExportArrowIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.75v11" />
      <path d="m8.25 7.5 3.75-3.75 3.75 3.75" />
      <path d="M5.5 14.75v3A1.75 1.75 0 0 0 7.25 19.5h9.5a1.75 1.75 0 0 0 1.75-1.75v-3" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6.75 9.5 5.25 5 5.25-5" />
    </IconBase>
  );
}

export function StartAnalysisIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
      <path d="M8.25 8.5h3.5" />
      <path d="M8.25 12h7.5" />
      <path d="M8.25 15.5h4.5" />
      <path d="m15.25 8.5 1.5 1.5-1.5 1.5" />
    </IconBase>
  );
}

export function InfoCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.25v4.5" />
      <path d="M12 7.5h.01" />
    </IconBase>
  );
}

export function EmptyDocumentsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.5 5.75A1.75 1.75 0 0 1 7.25 4h6.25l4.25 4.25v9.5a1.75 1.75 0 0 1-1.75 1.75h-8.75A1.75 1.75 0 0 1 5.5 17.75Z" />
      <path d="M13.5 4v4.25h4.25" />
      <path d="M8.5 11.25h6.5" />
      <path d="M8.5 14.5h4.5" />
    </IconBase>
  );
}

export function CloseSmallIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 8 8 8" />
      <path d="m16 8-8 8" />
    </IconBase>
  );
}

export function CourseStackIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m4.5 8 7.5-4 7.5 4-7.5 4-7.5-4Z" />
      <path d="m7 11.5 5 2.75 5-2.75" />
      <path d="m7 15 5 2.75 5-2.75" />
    </IconBase>
  );
}
