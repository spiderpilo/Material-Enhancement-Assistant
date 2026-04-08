import { HelpCircleIcon } from "@/components/course-content-upload/icons";

export function FloatingHelpButton() {
  return (
    <button
      type="button"
      aria-label="Open help"
      className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-(--fab) text-white shadow-[0_18px_36px_-22px_rgba(85,64,32,0.72)] transition hover:-translate-y-0.5 hover:bg-[#7b602b] focus:outline-none focus:ring-4 focus:ring-[rgba(196,166,106,0.28)]"
    >
      <HelpCircleIcon className="h-5 w-5" />
    </button>
  );
}
