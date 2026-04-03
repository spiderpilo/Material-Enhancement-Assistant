import { HelpCircleIcon } from "@/components/course-content-upload/icons";

export function FloatingHelpButton() {
  return (
    <button
      type="button"
      aria-label="Open help"
      className="fixed bottom-6 right-6 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c57648,#9f5830)] text-white shadow-[0_24px_48px_-22px_rgba(110,62,31,0.65)] transition hover:scale-[1.02] hover:shadow-[0_30px_55px_-24px_rgba(110,62,31,0.72)] focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
    >
      <HelpCircleIcon className="h-7 w-7" />
    </button>
  );
}
