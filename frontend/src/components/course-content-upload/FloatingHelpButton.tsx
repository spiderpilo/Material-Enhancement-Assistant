import { HelpCircleIcon } from "@/components/course-content-upload/icons";

export function FloatingHelpButton() {
  return (
    <button
      type="button"
      aria-label="Open help"
      className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),#5CA484)] text-white shadow-[var(--shadow-button)] transition hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-[color:var(--accent-soft)]"
    >
      <HelpCircleIcon className="h-5 w-5" />
    </button>
  );
}
