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
      <path d="M7.25 18.5h8.5a4 4 0 0 0 .85-7.9A5.75 5.75 0 0 0 5.9 8.85 3.75 3.75 0 0 0 7.25 18.5Z" />
      <path d="m12 8.75 3.25 3.25" />
      <path d="m12 8.75-3.25 3.25" />
      <path d="M12 8.75v8" />
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
