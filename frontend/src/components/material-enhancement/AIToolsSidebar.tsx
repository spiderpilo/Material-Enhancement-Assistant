import type { GeneratedQuiz } from "@/lib/api/quiz";
import type { ActiveTool, Material } from "@/lib/material-enhancement/workspace";
import { getMaterialBaseName } from "@/lib/material-enhancement/workspace";
import type { QuizGenerationStatus } from "@/components/material-enhancement/QuizPanel";

import {
  FlashcardsIcon,
  HelpIcon,
  MindmapIcon,
  QuizIcon,
  SummaryIcon,
} from "./icons";

type AIToolsSidebarProps = {
  activeTool: ActiveTool;
  checkedMaterials: Material[];
  onOpenHelp: () => void;
  onOpenQuiz: () => void;
  onSelectTool: (tool: ActiveTool) => void;
  quiz: GeneratedQuiz | null;
  quizErrorMessage: string | null;
  quizStatus: QuizGenerationStatus;
};

const TOOL_DEFINITIONS: Array<{
  id: ActiveTool;
  subtitle: string;
  title: string;
}> = [
  { id: "summary", title: "Summary", subtitle: "Auto Synopsis" },
  { id: "mindmap", title: "Mindmap", subtitle: "Visual Flow" },
  { id: "quiz", title: "Quiz Maker", subtitle: "Engagement" },
  { id: "flashcards", title: "Flashcards", subtitle: "Study Aids" },
];

export function AIToolsSidebar({
  activeTool,
  checkedMaterials,
  onOpenHelp,
  onOpenQuiz,
  onSelectTool,
  quiz,
  quizErrorMessage,
  quizStatus,
}: AIToolsSidebarProps) {
  const outputCopy = getToolOutputCopy(activeTool, checkedMaterials);

  return (
    <aside className="shadow-panel surface-inset flex h-[949px] min-h-[949px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--bg-panel-right)] px-4 pb-4 pt-5">
      <h2 className="text-[15.3px] font-bold tracking-[-0.045em] text-[color:var(--text-primary)]">
        AI Tools
      </h2>

      <div className="mt-5 space-y-3">
        {TOOL_DEFINITIONS.map((tool) => {
          const isActive = activeTool === tool.id;
          const cardTone =
            tool.id === "mindmap"
              ? "bg-[rgba(255,246,192,0.1)]"
              : tool.id === "quiz"
                ? "bg-[rgba(127,183,126,0.1)]"
                : tool.id === "flashcards"
                  ? "bg-[rgba(5,51,156,0.1)]"
                  : "bg-[rgba(255,255,255,0.05)]";

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className={[
                "group surface-inset relative flex w-full items-center gap-4 overflow-hidden rounded-[20px] border border-[rgba(255,255,255,0.1)] px-4 py-4 text-left backdrop-blur-[10px] transition-all duration-200 before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.035)_34%,rgba(255,255,255,0)_72%)] before:opacity-75",
                cardTone,
                isActive
                  ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.14),0_22px_48px_0_rgba(0,0,0,0.3)]"
                  : "hover:bg-[rgba(255,255,255,0.08)] hover:-translate-y-px hover:border-[rgba(255,255,255,0.14)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_48px_0_rgba(0,0,0,0.24)]",
              ].join(" ")}
            >
              <div
                className={[
                  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.1)] text-[rgba(243,158,182,0.86)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_rgba(0,0,0,0.16)] backdrop-blur-[10px] transition-all duration-200 group-hover:border-[rgba(255,255,255,0.16)] group-hover:text-[rgba(248,184,201,0.96)]",
                  isActive ? "text-[rgba(247,178,196,0.98)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_18px_rgba(243,158,182,0.08),0_10px_24px_rgba(0,0,0,0.16)]" : "",
                ].join(" ")}
              >
                {tool.id === "summary" ? (
                  <SummaryIcon className="h-7 w-7" />
                ) : tool.id === "mindmap" ? (
                  <MindmapIcon className="h-7 w-7" />
                ) : tool.id === "quiz" ? (
                  <QuizIcon className="h-7 w-7" />
                ) : (
                  <FlashcardsIcon className="h-7 w-7" />
                )}
              </div>

              <div>
                <p className="text-[12.9px] font-bold leading-5 text-[color:var(--text-primary)]">
                  {tool.title}
                </p>
                <p className="mt-[1px] text-[9.3px] font-bold uppercase tracking-[0.05em] text-[color:var(--text-subtle)]">
                  {tool.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex min-h-[432px] flex-1 flex-col rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
              Placeholder Output
            </p>
            <h3 className="mt-3 text-[17px] font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
              {outputCopy.title}
            </h3>
          </div>

          <div className="rounded-full border border-[rgba(184,219,128,0.16)] bg-[rgba(184,219,128,0.12)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--accent-green)]">
            {checkedMaterials.length === 0
              ? "No input"
              : `${checkedMaterials.length} file${checkedMaterials.length > 1 ? "s" : ""}`}
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-[22px] text-[color:var(--text-secondary)]">
          {outputCopy.description}
        </p>

        {activeTool === "quiz" ? (
          <QuizArtifactCard
            checkedMaterials={checkedMaterials}
            errorMessage={quizErrorMessage}
            onOpen={onOpenQuiz}
            quiz={quiz}
            status={quizStatus}
          />
        ) : null}

        <div className="mt-auto rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.16)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
            AI Input
          </p>

          {checkedMaterials.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {checkedMaterials.map((material) => (
                <span
                  key={material.id}
                  className="inline-flex items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]"
                >
                  {getMaterialBaseName(material.name)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] leading-[21px] text-[color:var(--text-muted)]">
              Use the checkboxes in Materials to choose which files feed the active AI tool. Preview selection stays separate.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onOpenHelp}
          className="inline-flex h-[28px] items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.08)] px-3 text-[11px] font-medium text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
        >
          <HelpIcon className="h-[14px] w-[14px]" />
          Help
        </button>
      </div>
    </aside>
  );
}

function QuizArtifactCard({
  checkedMaterials,
  errorMessage,
  onOpen,
  quiz,
  status,
}: {
  checkedMaterials: Material[];
  errorMessage: string | null;
  onOpen: () => void;
  quiz: GeneratedQuiz | null;
  status: QuizGenerationStatus;
}) {
  const sourceCount = quiz?.source_count ?? checkedMaterials.length;
  const isLoading = status === "loading";
  const isError = status === "error";
  const isDisabled = checkedMaterials.length === 0 || isLoading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onOpen}
      className={[
        "mt-6 w-full rounded-[18px] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
        isError
          ? "border-[rgba(255,154,168,0.26)] bg-[rgba(255,154,168,0.08)]"
          : "border-[rgba(184,219,128,0.18)] bg-[rgba(184,219,128,0.1)]",
        isDisabled ? "opacity-65" : "hover:-translate-y-px hover:bg-[rgba(184,219,128,0.14)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
            Quiz
          </p>
          <h4 className="mt-2 truncate text-[15px] font-bold text-[color:var(--text-primary)]">
            {quiz?.title ?? getQuizArtifactTitle(status)}
          </h4>
        </div>
        <span className="shrink-0 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--accent-green)]">
          {quiz ? `${quiz.questions.length} Q` : "12 Q"}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-[19px] text-[color:var(--text-secondary)]">
        {isError
          ? errorMessage ?? "Quiz generation failed."
          : `Based on ${sourceCount} selected source${sourceCount === 1 ? "" : "s"}.`}
      </p>
    </button>
  );
}

function getQuizArtifactTitle(status: QuizGenerationStatus): string {
  if (status === "loading") {
    return "Making quiz";
  }

  if (status === "error") {
    return "Retry quiz";
  }

  return "Generated quiz";
}

function getToolOutputCopy(activeTool: ActiveTool, checkedMaterials: Material[]) {
  if (checkedMaterials.length === 0) {
    return {
      title: getEmptyOutputTitle(activeTool),
      description:
        "Select one or more files in the Materials panel to prepare tool output. Checked files define AI input, while preview selection still controls the center panel.",
    };
  }

  if (checkedMaterials.length === 1) {
    const [material] = checkedMaterials;
    const baseName = getMaterialBaseName(material.name);

    switch (activeTool) {
      case "summary":
        return {
          title: `Summary draft for ${baseName}`,
          description: `This placeholder is ready to generate a concise teaching summary from ${material.name}. The checked file will be the only source sent to the summary tool.`,
        };
      case "mindmap":
        return {
          title: `Mindmap outline for ${baseName}`,
          description: `This placeholder is ready to turn ${material.name} into a visual concept map with linked ideas, themes, and supporting branches.`,
        };
      case "quiz":
        return {
          title: `Quiz set for ${baseName}`,
          description: `This placeholder is ready to draft question prompts, distractors, and short checks based on ${material.name}.`,
        };
      case "flashcards":
        return {
          title: `Flashcards for ${baseName}`,
          description: `This placeholder is ready to assemble study cards and recall prompts from ${material.name}.`,
        };
      default:
        return {
          title: "Tool output",
          description: "This panel is reserved for AI-generated output.",
        };
    }
  }

  const materialCount = checkedMaterials.length;
  const previewNames = checkedMaterials
    .slice(0, 2)
    .map((material) => getMaterialBaseName(material.name))
    .join(", ");
  const remainingCount = materialCount - 2;
  const suffix = remainingCount > 0 ? `, plus ${remainingCount} more` : "";

  switch (activeTool) {
    case "summary":
      return {
        title: `Combined summary across ${materialCount} materials`,
        description: `This placeholder is ready to synthesize shared ideas, overlaps, and priority takeaways across ${previewNames}${suffix}.`,
      };
    case "mindmap":
      return {
        title: `Combined concept map for ${materialCount} files`,
        description: `This placeholder is ready to merge connected themes from ${previewNames}${suffix} into one broader concept map.`,
      };
    case "quiz":
      return {
        title: `Question bank from ${materialCount} checked files`,
        description: `This placeholder is ready to create a combined quiz draft using ${previewNames}${suffix} as the active input set.`,
      };
    case "flashcards":
      return {
        title: `Study deck from ${materialCount} materials`,
        description: `This placeholder is ready to create one flashcard set that pulls key terms and explanations from ${previewNames}${suffix}.`,
      };
    default:
      return {
        title: "Tool output",
        description: "This panel is reserved for AI-generated output.",
      };
  }
}

function getEmptyOutputTitle(activeTool: ActiveTool): string {
  switch (activeTool) {
    case "summary":
      return "Select materials to generate a summary";
    case "mindmap":
      return "Select materials to build a mindmap";
    case "quiz":
      return "Select materials to draft quiz questions";
    case "flashcards":
      return "Select materials to prepare flashcards";
    default:
      return "Select materials to begin";
  }
}
