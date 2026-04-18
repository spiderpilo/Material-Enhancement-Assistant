import type { ComponentPropsWithoutRef } from "react";

type SvgIconProps = ComponentPropsWithoutRef<"svg">;

function SvgIcon({ children, className, ...props }: SvgIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ProjectLogoIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Background */}
      <circle cx="12" cy="12" r="10" fill="#2F4F4F" />

      {/* Rounded triangle */}
      <path
        d="
          M12 7
          Q12.6 7 13 7.8
          L16.8 14.8
          Q17.2 15.6 16.4 16
          H7.6
          Q6.8 15.6 7.2 14.8
          L11 7.8
          Q11.4 7 12 7
          Z
        "
        fill="#D8B4A0"
      />
    </SvgIcon>
  );
}

export function AddIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </SvgIcon>
  );
}

export function FileIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M7.5 4.75h6.88L18 8.37v10.88a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.25v-13a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M14.5 4.75v3.5H18" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 12h6M9 15.25h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </SvgIcon>
  );
}

export function ImageFileIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <path
        d="m7.5 16 3-3 2.25 2.25 2.25-2.75 1.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </SvgIcon>
  );
}

export function ChevronDownIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m7.5 9.5 4.5 5 4.5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

export function ChevronUpIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m7.5 14.5 4.5-5 4.5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </SvgIcon>
  );
}

export function ArrowLeftIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m14.5 6.5-5 5 5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function ArrowRightIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m9.5 6.5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function SummaryIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="5.5" y="4.5" width="8.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8.5h3M9 11h3M9 13.5h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <rect x="10" y="9" width="8.5" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </SvgIcon>
  );
}

export function MindmapIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="2" fill="currentColor" />

      <circle cx="12" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="19.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="19.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5" />

      {/* Connecting lines */}
      <path
        d="M12 10V6.5M14 12H17.5M12 14V17.5M10 12H6.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </SvgIcon>
  );
}

export function QuizIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="6" y="4.75" width="12" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9.25h6M9 12.5h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <path d="m9.25 16 1.5 1.5 3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9 3.75h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </SvgIcon>
  );
}

export function FlashcardsIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect
        x="6.5"
        y="6"
        width="10"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.5"
      />

      <rect
        x="9"
        y="8"
        width="10"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />

      <path
        d="M12 11c1.8-2 4.5-2 6 0M18 11v2.5M18 13.5h-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M11.5 14.5l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4.4-1.1z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}

export function HelpIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.75 9.5a2.5 2.5 0 1 1 4.06 1.93c-.83.68-1.31 1.1-1.31 2.07"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="16.75" r="0.9" fill="currentColor" />
    </SvgIcon>
  );
}

export function UserIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="8.25" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.75 18c.65-2.47 2.6-4 5.25-4s4.6 1.53 5.25 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

export function ShareIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="6.75" cy="12" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15.5" cy="6.75" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16.25" cy="17.25" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m8.25 11.1 5.5-3M8.25 12.9l6.1 3.15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

export function SettingsIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M19.14,12.94a7.49,7.49,0,0,0,.05-.94,7.49,7.49,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.77,2H10.23a.5.5,0,0,0-.49.42L9.36,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.49,7.49,0,0,0-.05.94,7.49,7.49,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.42h3.54a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
      />
    </SvgIcon>
  );
}

export function EditIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m8.5 15.5 6.85-6.85a1.5 1.5 0 1 0-2.12-2.12L6.38 13.4l-.63 2.73 2.75-.63Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M12.5 6.75 15.25 9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </SvgIcon>
  );
}

export function ClarityIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M12 5.25a3.9 3.9 0 0 0-2.25 7.08v1.92h4.5v-1.92A3.9 3.9 0 0 0 12 5.25Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M10 17h4M10.5 19.25h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </SvgIcon>
  );
}

export function VisualsIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="5.25" y="5.25" width="13.5" height="5.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5.25" y="13.25" width="5.5" height="5.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.25" y="13.25" width="5.5" height="5.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
    </SvgIcon>
  );
}

export function InteractionIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8.25" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15.75" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.75 18c.34-1.86 1.66-3 3.5-3 1.1 0 2.03.36 2.75 1.05A4.3 4.3 0 0 1 14.75 15c1.84 0 3.16 1.14 3.5 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

export function CheckIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m6.5 12.25 3.5 3.5 7.5-7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}


export function UploadCloudIcon(props: SvgIconProps) {
  return (
    <SvgIcon
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      {/* Arrow */}
      <path
        d="M16 15l-4-4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 11v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Cloud */}
      <path
        d="M20 16.5A5 5 0 0 0 18 7h-1.2A8 8 0 1 0 4 16.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}

export function ExportArrowIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path
        fill="currentColor"
        d="
          M12 2.75
          a1.6 1.6 0 0 1 1.13.47
          l4.5 4.5
          a1.6 1.6 0 1 1-2.26 2.26
          l-1.77-1.77
          V16
          a1.6 1.6 0 1 1-3.2 0
          V8.21
          l-1.77 1.77
          a1.6 1.6 0 1 1-2.26-2.26
          l4.5-4.5
          A1.6 1.6 0 0 1 12 2.75
          Z

          M6.25 16.75
          a1.75 1.75 0 0 1 1.75 1.75
          v1
          h8
          v-1
          a1.75 1.75 0 1 1 3.5 0
          v1.25
          A3.75 3.75 0 0 1 15.75 23
          h-7.5
          A3.75 3.75 0 0 1 4.5 19.25
          V18.5
          a1.75 1.75 0 0 1 1.75-1.75
          Z
        "
      />
    </SvgIcon>
  );
}

export function PanelCollapseIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="5.25" y="5" width="13.5" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="m14.75 9.5-2.5 2.5 2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

export function PanelExpandIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <rect x="5.25" y="5" width="13.5" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 7v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="m12.25 9.5 2.5 2.5-2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}

export function CloseIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </SvgIcon>
  );
}

export function ShieldCheckIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M12 3.75c1.59 1.16 3.48 1.83 5.45 1.92v4.55c0 4-2.2 6.93-5.45 8.03-3.25-1.1-5.45-4.03-5.45-8.03V5.67C8.52 5.58 10.41 4.91 12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m9.7 11.8 1.6 1.6 3.15-3.15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}
