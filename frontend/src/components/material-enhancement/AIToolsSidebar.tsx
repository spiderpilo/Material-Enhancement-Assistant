import { useEffect, useState } from "react";
import type { ComponentPropsWithoutRef, ComponentType, CSSProperties } from "react";

import {
  QuizPanel,
  type QuizGenerationStatus,
  type QuizViewMode,
} from "@/components/material-enhancement/QuizPanel";
import type { GeneratedQuiz } from "@/lib/api/quiz";
import type { ActiveTool, Material } from "@/lib/material-enhancement/workspace";

import {
  ArrowRightIcon,
  HelpIcon,
  OverflowVerticalIcon,
  QuizIcon,
  SlideDeckIcon,
  SummaryIcon,
} from "./icons";

type QuizHistoryItem = {
  createdAt: number;
  id: string;
  quiz: GeneratedQuiz;
};

type AIToolsSidebarProps = {
  activeQuestionIndex: number;
  activeTool: ActiveTool;
  checkedMaterials: Material[];
  isQuizExpanded: boolean;
  onCloseQuiz: () => void;
  onNavigateQuiz: (direction: "previous" | "next") => void;
  onOpenHelp: () => void;
  onOpenQuiz: (quizHistoryId: string) => void;
  onResetQuiz: () => void;
  onRetryQuiz: () => void;
  onReviewQuiz: () => void;
  onSelectQuizAnswer: (questionId: string, optionId: string) => void;
  onSelectTool: (tool: ActiveTool) => void;
  onShowQuizResults: () => void;
  pendingQuizSourceCount: number | null;
  quiz: GeneratedQuiz | null;
  quizErrorMessage: string | null;
  quizHistory: QuizHistoryItem[];
  quizStatus: QuizGenerationStatus;
  quizViewMode: QuizViewMode;
  selectedQuizAnswers: Record<string, string>;
};

type ToolIcon = ComponentType<ComponentPropsWithoutRef<"svg">>;

type ToolDefinition = {
  id: ActiveTool;
  accent: {
    border: string;
    focus: string;
    glow: string;
    icon: string;
    tint: string;
  };
  beta?: boolean;
  icon: ToolIcon;
  label: string;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: "summary",
    label: "Summary",
    icon: SummaryIcon,
    accent: {
      border: "rgba(243, 158, 182, 0.3)",
      focus: "rgba(243, 158, 182, 0.38)",
      glow: "rgba(243, 158, 182, 0.18)",
      icon: "#f6bdd0",
      tint: "rgba(243, 158, 182, 0.14)",
    },
  },
  {
    id: "quiz",
    label: "Quiz Maker",
    icon: QuizIcon,
    accent: {
      border: "rgba(184, 219, 128, 0.34)",
      focus: "rgba(184, 219, 128, 0.42)",
      glow: "rgba(184, 219, 128, 0.18)",
      icon: "#d9f1b2",
      tint: "rgba(184, 219, 128, 0.13)",
    },
  },
  {
    id: "slideDeck",
    label: "Slide Deck",
    beta: true,
    icon: SlideDeckIcon,
    accent: {
      border: "rgba(231, 234, 157, 0.28)",
      focus: "rgba(231, 234, 157, 0.36)",
      glow: "rgba(231, 234, 157, 0.16)",
      icon: "#eef1b8",
      tint: "rgba(214, 221, 120, 0.14)",
    },
  },
];

export function AIToolsSidebar({
  activeQuestionIndex,
  activeTool,
  checkedMaterials,
  isQuizExpanded,
  onCloseQuiz,
  onNavigateQuiz,
  onOpenHelp,
  onOpenQuiz,
  onResetQuiz,
  onRetryQuiz,
  onReviewQuiz,
  onSelectQuizAnswer,
  onSelectTool,
  onShowQuizResults,
  pendingQuizSourceCount,
  quiz,
  quizErrorMessage,
  quizHistory,
  quizStatus,
  quizViewMode,
  selectedQuizAnswers,
}: AIToolsSidebarProps) {
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const tools = TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    onClick: () => onSelectTool(tool.id),
  }));
  const showQuizLoadingRow =
    quizStatus === "loading" && pendingQuizSourceCount !== null;

  useEffect(() => {
    if (quizHistory.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRelativeNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [quizHistory.length]);

  return (
    <aside className="relative flex h-[949px] min-h-0 max-w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#202328] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_22%,rgba(0,0,0,0.08)_100%)]" />

      {isQuizExpanded ? (
        <div className="relative flex min-h-0 flex-1 flex-col animate-studio-panel-content-enter">
          <QuizPanel
            activeQuestionIndex={activeQuestionIndex}
            checkedMaterials={checkedMaterials}
            errorMessage={quizErrorMessage}
            onClose={onCloseQuiz}
            onNavigate={onNavigateQuiz}
            onReset={onResetQuiz}
            onRetry={onRetryQuiz}
            onReview={onReviewQuiz}
            onSelectAnswer={onSelectQuizAnswer}
            onShowResults={onShowQuizResults}
            quiz={quiz}
            selectedAnswers={selectedQuizAnswers}
            status={quizStatus}
            viewMode={quizViewMode}
          />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col p-4 animate-studio-panel-content-enter">
          <h2 className="pl-1 text-[15px] font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
            AI Tools
          </h2>

          <div className="studio-scroll mt-5 min-h-0 flex-1 overflow-y-auto pb-24 pr-1">
            <div className="space-y-3">
              {tools.map((tool, index) => (
                <AIToolCard
                  key={tool.id}
                  index={index}
                  isSelected={activeTool === tool.id}
                  onClick={tool.onClick}
                  tool={tool}
                />
              ))}
            </div>

            <div className="mt-6 border-t border-white/[0.08] pt-6">
              {showQuizLoadingRow || quizHistory.length > 0 ? (
                <div className="space-y-1.5">
                  {showQuizLoadingRow ? (
                    <LoadingQuizRow sourceCount={pendingQuizSourceCount} />
                  ) : null}

                  {quizHistory.map((quizHistoryItem) => (
                    <GeneratedQuizRow
                      key={quizHistoryItem.id}
                      generatedAt={quizHistoryItem.createdAt}
                      onOpen={() => onOpenQuiz(quizHistoryItem.id)}
                      quiz={quizHistoryItem.quiz}
                      relativeNow={relativeNow}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex justify-end">
            <button
              type="button"
              onClick={onOpenHelp}
              className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.08] px-4 text-[11.5px] font-medium text-white/78 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
            >
              <HelpIcon className="h-[14px] w-[14px]" />
              Help
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function AIToolCard({
  index,
  isSelected,
  onClick,
  tool,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  tool: ToolDefinition & { onClick: () => void };
}) {
  const Icon = tool.icon;
  const toolStyle = {
    "--tool-border": tool.accent.border,
    "--tool-focus": tool.accent.focus,
    "--tool-glow": tool.accent.glow,
    "--tool-icon": tool.accent.icon,
    "--tool-tint": tool.accent.tint,
    ...(isSelected
      ? {
          boxShadow: `0 0 0 1px ${tool.accent.border}, 0 18px 38px rgba(0, 0, 0, 0.26), 0 0 24px ${tool.accent.glow}`,
        }
      : {}),
  } as CSSProperties;

  return (
    <button
      type="button"
      aria-label={`${tool.label} tool`}
      aria-pressed={isSelected}
      onClick={onClick}
      style={{
        ...toolStyle,
        animationDelay: `${index * 40}ms`,
      }}
      className={[
        "animate-studio-tool-enter group relative flex h-[80px] w-full items-center gap-4 overflow-hidden rounded-[22px] border border-white/[0.08] px-[17px] py-4 text-left transition-[transform,background,border-color,box-shadow,opacity] duration-200 ease-out",
        "bg-[linear-gradient(140deg,var(--tool-tint)_0%,rgba(255,255,255,0.05)_58%,rgba(255,255,255,0.03)_100%)] shadow-[0_14px_30px_rgba(0,0,0,0.22)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_12%_16%,var(--tool-glow)_0%,transparent_52%)] before:opacity-70 before:transition-opacity before:duration-200 before:ease-out",
        "after:pointer-events-none after:absolute after:inset-x-5 after:top-0 after:h-px after:bg-white/14",
        "hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[linear-gradient(140deg,var(--tool-tint)_0%,rgba(255,255,255,0.08)_48%,rgba(255,255,255,0.05)_100%)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.26)] hover:before:opacity-100",
        "active:translate-y-px active:scale-[0.98] active:shadow-[0_10px_20px_rgba(0,0,0,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tool-focus)]",
        isSelected ? "border-[color:var(--tool-border)]" : "",
      ].join(" ")}
    >
      <div
        className={[
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_100%)] text-[color:var(--tool-icon)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_24px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out",
          "group-hover:scale-[1.03] group-hover:border-white/[0.16] group-hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_100%)] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_24px_var(--tool-glow),0_12px_24px_rgba(0,0,0,0.16)]",
          isSelected ? "border-white/[0.16]" : "",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[17px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            {tool.label}
          </p>
          {tool.beta ? (
            <span className="shrink-0 rounded-full bg-[#050607] px-2 py-[3px] text-[8px] font-bold uppercase tracking-[0.12em] text-white">
              Beta
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={[
          "ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-black/12 text-white/58 transition-all duration-200 ease-out",
          "group-hover:translate-x-0.5 group-hover:border-white/[0.1] group-hover:bg-white/[0.09] group-hover:text-white/88",
          isSelected ? "border-white/[0.12] bg-white/[0.1] text-white/88" : "",
        ].join(" ")}
        aria-hidden="true"
      >
        <ArrowRightIcon className="h-4.5 w-4.5" />
      </div>
    </button>
  );
}

function LoadingQuizRow({
  sourceCount,
}: {
  sourceCount: number | null;
}) {
  const normalizedSourceCount = Math.max(sourceCount ?? 1, 1);

  return (
    <div
      aria-live="polite"
      className="animate-studio-output-enter rounded-[16px] bg-white/[0.03] px-3 py-3.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-[#dff3ee] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <span className="h-5 w-5 rounded-full border-2 border-current/25 border-t-current animate-[spin_1000ms_linear_infinite]" />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">
            Generating Quiz...
          </h4>
          <p className="mt-1 text-[11px] font-medium text-white/54">
            based on {normalizedSourceCount} source{normalizedSourceCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

function GeneratedQuizRow({
  generatedAt,
  onOpen,
  quiz,
  relativeNow,
}: {
  generatedAt: number;
  onOpen: () => void;
  quiz: GeneratedQuiz;
  relativeNow: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="animate-studio-output-enter group flex w-full items-center gap-3 rounded-[16px] px-3 py-3.5 text-left transition-all duration-200 ease-out hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-[color:var(--accent-green)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 ease-out group-hover:border-white/[0.12] group-hover:bg-white/[0.07] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_18px_rgba(184,219,128,0.08)]">
        <QuizIcon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">
          {quiz.title}
        </h4>
        <p className="mt-1 text-[11px] font-medium text-white/54">
          {quiz.source_count} source{quiz.source_count === 1 ? "" : "s"} · {formatRelativeQuizTime(generatedAt, relativeNow)}
        </p>
      </div>

      <div className="shrink-0 rounded-full p-1.5 text-white/40 transition-all duration-200 ease-out group-hover:bg-white/[0.06] group-hover:text-white/68">
        <OverflowVerticalIcon className="h-4.5 w-4.5" />
      </div>
    </button>
  );
}

function formatRelativeQuizTime(createdAt: number, relativeNow: number) {
  const elapsedMs = Math.max(relativeNow - createdAt, 0);
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMinutes <= 0) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}
