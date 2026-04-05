import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M2.75 12s3.25-5.25 9.25-5.25S21.25 12 21.25 12s-3.25 5.25-9.25 5.25S2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </BaseIcon>
  );
}

export function GitHubLogoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.75-.24.75-.54l-.01-2.08c-3.05.66-3.69-1.3-3.69-1.3-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.69 1.13 1.69 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.39-1.2.7-1.48-2.43-.28-4.98-1.22-4.98-5.42 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.42.11-2.95 0 0 .92-.3 3.02 1.12a10.53 10.53 0 0 1 5.5 0c2.1-1.42 3.01-1.12 3.01-1.12.61 1.53.23 2.67.11 2.95.71.77 1.13 1.75 1.13 2.95 0 4.21-2.56 5.13-5 5.41.4.35.74 1.03.74 2.08v3.08c0 .31.19.65.76.54A11.25 11.25 0 0 0 12 .75Z" />
    </svg>
  );
}

export function GoogleLogoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M21.58 12.23c0-.7-.06-1.37-.19-2.01H12v3.8h5.39a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.89-1.74 2.96-4.31 2.96-7.31Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.62-2.4l-3.22-2.5c-.89.6-2.03.95-3.4.95-2.61 0-4.81-1.76-5.6-4.13H3.08v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC04"
        d="M6.4 13.92A5.97 5.97 0 0 1 6.09 12c0-.67.12-1.32.31-1.92V7.5H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.5l3.32-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.78.5 3.82 1.48l2.86-2.86C16.95 2.96 14.7 2 12 2A10 10 0 0 0 3.08 7.5l3.32 2.58C7.19 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

export function MicrosoftLogoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="#f35325" d="M3 3h8.5v8.5H3z" />
      <path fill="#81bc06" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#05a6f0" d="M3 12.5h8.5V21H3z" />
      <path fill="#ffba08" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}
