import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ComponentType, CSSProperties } from "react";

import {
  QuizPanel,
  type QuizGenerationStatus,
  type QuizViewMode,
} from "@/components/material-enhancement/QuizPanel";
import type {
  GeneratedMaterial,
  GeneratedMaterialDownloadFormat,
} from "@/lib/api/generated-materials";
import type { GeneratedQuiz } from "@/lib/api/quiz";
import type { ActiveTool, Material } from "@/lib/material-enhancement/workspace";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  ExportArrowIcon,
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

type SlideDeckPreviewItem = {
  id: string;
  imageUrl: string;
  index: number;
  label: string;
  subtitle: string;
  title: string;
};

type SlideDeckOutlineCard = {
  bullets: string[];
  title: string;
};

type AIToolsSidebarProps = {
  activeQuestionIndex: number;
  activeTool: ActiveTool;
  checkedMaterials: Material[];
  generatedMaterials: GeneratedMaterial[];
  isQuizExpanded: boolean;
  isSlideDeckExpanded: boolean;
  onCloseSlideDeckPreview: () => void;
  onCloseQuiz: () => void;
  onDownloadGeneratedMaterial: (
    generatedMaterialUuid: string,
    format?: GeneratedMaterialDownloadFormat,
  ) => void;
  onGenerateSlideDeck: () => void;
  onNavigateQuiz: (direction: "previous" | "next") => void;
  onOpenHelp: () => void;
  onOpenQuiz: (quizHistoryId: string) => void;
  onOpenSlideDeckPreview: (generatedMaterialUuid: string) => void;
  onResetQuiz: () => void;
  onRetryQuiz: () => void;
  onReviewQuiz: () => void;
  onSelectSlideDeck: (generatedMaterialUuid: string) => void;
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
  selectedSlideDeckUuid: string | null;
  slideDeckErrorMessage: string | null;
  slideDeckStatus: "idle" | "loading" | "error";
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
  generatedMaterials,
  isQuizExpanded,
  isSlideDeckExpanded,
  onCloseSlideDeckPreview,
  onCloseQuiz,
  onDownloadGeneratedMaterial,
  onGenerateSlideDeck,
  onNavigateQuiz,
  onOpenHelp,
  onOpenQuiz,
  onOpenSlideDeckPreview,
  onResetQuiz,
  onRetryQuiz,
  onReviewQuiz,
  onSelectSlideDeck,
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
  selectedSlideDeckUuid,
  slideDeckErrorMessage,
  slideDeckStatus,
}: AIToolsSidebarProps) {
  const [relativeNow, setRelativeNow] = useState(() => Date.now());
  const [openSlideDeckDownloadMenuKey, setOpenSlideDeckDownloadMenuKey] = useState<string | null>(null);
  const activeSlideDeckDownloadMenuRef = useRef<HTMLDivElement | null>(null);
  const showQuizLoadingRow =
    quizStatus === "loading" && pendingQuizSourceCount !== null;
  const showGeneratedMaterialsSection =
    generatedMaterials.length > 0 ||
    showQuizLoadingRow ||
    quizHistory.length > 0 ||
    slideDeckStatus === "loading" ||
    slideDeckStatus === "error";
  const slideDeckMaterials = useMemo(
    () => generatedMaterials.filter((generatedMaterial) => generatedMaterial.tool_type === "slide_deck"),
    [generatedMaterials],
  );
  const selectedSlideDeck =
    slideDeckMaterials.find(
      (generatedMaterial) => generatedMaterial.uuid === selectedSlideDeckUuid,
    ) ?? slideDeckMaterials[0] ?? null;
  const visibleSlideDeckDownloadMenuKey =
    openSlideDeckDownloadMenuKey &&
    generatedMaterials.some((generatedMaterial) =>
      openSlideDeckDownloadMenuKey.includes(generatedMaterial.uuid),
    )
      ? openSlideDeckDownloadMenuKey
      : null;
  const closeSlideDeckDownloadMenu = () => {
    setOpenSlideDeckDownloadMenuKey(null);
    activeSlideDeckDownloadMenuRef.current = null;
  };
  const toggleSlideDeckDownloadMenu = (menuKey: string) => {
    setOpenSlideDeckDownloadMenuKey((currentKey) =>
      currentKey === menuKey ? null : menuKey,
    );
  };
  const tools = TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    onClick: () => {
      closeSlideDeckDownloadMenu();
      onSelectTool(tool.id);
    },
  }));

  useEffect(() => {
    if (quizHistory.length === 0 && generatedMaterials.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRelativeNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [generatedMaterials.length, quizHistory.length]);

  useEffect(() => {
    if (!visibleSlideDeckDownloadMenuKey) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!activeSlideDeckDownloadMenuRef.current?.contains(event.target as Node)) {
        closeSlideDeckDownloadMenu();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSlideDeckDownloadMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visibleSlideDeckDownloadMenuKey]);

  useEffect(() => {
    if (!isSlideDeckExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !visibleSlideDeckDownloadMenuKey) {
        onCloseSlideDeckPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSlideDeckExpanded, onCloseSlideDeckPreview, visibleSlideDeckDownloadMenuKey]);

  return (
    <aside className="relative flex h-full min-w-0 min-h-0 max-w-full flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#202328] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
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
      ) : isSlideDeckExpanded ? (
        <SlideDeckExpandedView
          checkedMaterials={checkedMaterials}
          onCloseSlideDeckPreview={onCloseSlideDeckPreview}
          onDownloadGeneratedMaterial={onDownloadGeneratedMaterial}
          onGenerateSlideDeck={onGenerateSlideDeck}
          onOpenSlideDeckPreview={onOpenSlideDeckPreview}
          onSelectSlideDeck={onSelectSlideDeck}
          openSlideDeckDownloadMenuKey={visibleSlideDeckDownloadMenuKey}
          relativeNow={relativeNow}
          selectedSlideDeck={selectedSlideDeck}
          onToggleSlideDeckDownloadMenu={toggleSlideDeckDownloadMenu}
          setSlideDeckDownloadMenuRef={(node) => {
            activeSlideDeckDownloadMenuRef.current = node;
          }}
          slideDeckErrorMessage={slideDeckErrorMessage}
          slideDeckMaterials={slideDeckMaterials}
          slideDeckStatus={slideDeckStatus}
          onCloseDownloadMenu={closeSlideDeckDownloadMenu}
        />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col p-3.5 animate-studio-panel-content-enter 2xl:p-4">
          <h2 className="pl-1 text-[15px] font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
            AI Tools
          </h2>

          <div className="studio-scroll mt-4 min-h-0 flex-1 overflow-y-auto pb-20 pr-1 2xl:mt-5 2xl:pb-24">
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
              {activeTool === "slideDeck" ? (
                <SlideDeckStudioPanel
                  checkedMaterials={checkedMaterials}
                  isExpanded={false}
                  onCloseDownloadMenu={closeSlideDeckDownloadMenu}
                  onDownloadGeneratedMaterial={onDownloadGeneratedMaterial}
                  onGenerateSlideDeck={onGenerateSlideDeck}
                  onOpenSlideDeckPreview={onOpenSlideDeckPreview}
                  onSelectSlideDeck={onSelectSlideDeck}
                  openSlideDeckDownloadMenuKey={visibleSlideDeckDownloadMenuKey}
                  relativeNow={relativeNow}
                  selectedSlideDeck={selectedSlideDeck}
                  onToggleSlideDeckDownloadMenu={toggleSlideDeckDownloadMenu}
                  setSlideDeckDownloadMenuRef={(node) => {
                    activeSlideDeckDownloadMenuRef.current = node;
                  }}
                  slideDeckErrorMessage={slideDeckErrorMessage}
                  slideDeckMaterials={slideDeckMaterials}
                  slideDeckStatus={slideDeckStatus}
                />
              ) : showGeneratedMaterialsSection ? (
                <div className="space-y-1.5">
                  {slideDeckStatus === "loading" ? (
                    <LoadingArtifactRow label="Generating slide deck..." sourceCount={checkedMaterials.length || 1} />
                  ) : null}

                  {slideDeckStatus === "error" ? (
                    <ErrorArtifactRow
                      message={slideDeckErrorMessage ?? "Slide deck generation failed."}
                      onRetry={onGenerateSlideDeck}
                    />
                  ) : null}

                  {showQuizLoadingRow ? (
                    <LoadingArtifactRow label="Generating quiz..." sourceCount={pendingQuizSourceCount} />
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

                  {generatedMaterials.map((generatedMaterial) => (
                    <GeneratedMaterialRow
                      key={generatedMaterial.uuid}
                      generatedMaterial={generatedMaterial}
                      isDownloadMenuOpen={
                        visibleSlideDeckDownloadMenuKey ===
                        `generated-row-${generatedMaterial.uuid}`
                      }
                      onDownloadPdf={() =>
                        onDownloadGeneratedMaterial(generatedMaterial.uuid, "pdf")
                      }
                      onDownloadPptx={() =>
                        onDownloadGeneratedMaterial(generatedMaterial.uuid, "pptx")
                      }
                      onOpenPreview={() => onOpenSlideDeckPreview(generatedMaterial.uuid)}
                      onToggleDownloadMenu={() =>
                        toggleSlideDeckDownloadMenu(
                          `generated-row-${generatedMaterial.uuid}`,
                        )
                      }
                      setDownloadMenuRef={(node) => {
                        if (
                          visibleSlideDeckDownloadMenuKey ===
                          `generated-row-${generatedMaterial.uuid}`
                        ) {
                          activeSlideDeckDownloadMenuRef.current = node;
                        }
                      }}
                      relativeNow={relativeNow}
                      onCloseDownloadMenu={closeSlideDeckDownloadMenu}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {activeTool !== "slideDeck" ? (
            <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex justify-end 2xl:bottom-4 2xl:right-4">
              <button
                type="button"
                onClick={onOpenHelp}
                className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.08] px-4 text-[11.5px] font-medium text-white/78 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
              >
                <HelpIcon className="h-[14px] w-[14px]" />
                Help
              </button>
            </div>
          ) : null}
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
        "animate-studio-tool-enter group relative flex h-[72px] w-full items-center gap-3.5 overflow-hidden rounded-[22px] border border-white/[0.08] px-4 py-3.5 text-left transition-[transform,background,border-color,box-shadow,opacity] duration-200 ease-out 2xl:h-[80px] 2xl:gap-4 2xl:px-[17px] 2xl:py-4",
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
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_100%)] text-[color:var(--tool-icon)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_24px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out 2xl:h-11 2xl:w-11",
          "group-hover:scale-[1.03] group-hover:border-white/[0.16] group-hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_100%)] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_24px_var(--tool-glow),0_12px_24px_rgba(0,0,0,0.16)]",
          isSelected ? "border-white/[0.16]" : "",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[16px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)] 2xl:text-[17px]">
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

function SlideDeckExpandedView({
  checkedMaterials,
  onCloseDownloadMenu,
  onCloseSlideDeckPreview,
  onDownloadGeneratedMaterial,
  onGenerateSlideDeck,
  onOpenSlideDeckPreview,
  onSelectSlideDeck,
  onToggleSlideDeckDownloadMenu,
  openSlideDeckDownloadMenuKey,
  relativeNow,
  selectedSlideDeck,
  setSlideDeckDownloadMenuRef,
  slideDeckErrorMessage,
  slideDeckMaterials,
  slideDeckStatus,
}: {
  checkedMaterials: Material[];
  onCloseDownloadMenu: () => void;
  onCloseSlideDeckPreview: () => void;
  onDownloadGeneratedMaterial: (
    generatedMaterialUuid: string,
    format?: GeneratedMaterialDownloadFormat,
  ) => void;
  onGenerateSlideDeck: () => void;
  onOpenSlideDeckPreview: (generatedMaterialUuid: string) => void;
  onSelectSlideDeck: (generatedMaterialUuid: string) => void;
  onToggleSlideDeckDownloadMenu: (menuKey: string) => void;
  openSlideDeckDownloadMenuKey: string | null;
  relativeNow: number;
  selectedSlideDeck: GeneratedMaterial | null;
  setSlideDeckDownloadMenuRef: (node: HTMLDivElement | null) => void;
  slideDeckErrorMessage: string | null;
  slideDeckMaterials: GeneratedMaterial[];
  slideDeckStatus: "idle" | "loading" | "error";
}) {
  return (
    <section className="relative flex min-h-0 flex-1 flex-col animate-studio-panel-content-enter">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-4">
        <button
          type="button"
          onClick={onCloseSlideDeckPreview}
          className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] font-medium text-white/76 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/44">
            AI Tools
          </p>
          <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[color:var(--text-primary)]">
            Slide Deck Preview
          </p>
        </div>

        <button
          type="button"
          onClick={onCloseSlideDeckPreview}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/72 transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
          aria-label="Close slide deck preview"
        >
          <CloseIcon className="h-4.5 w-4.5" />
        </button>
      </header>

      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <SlideDeckStudioPanel
          checkedMaterials={checkedMaterials}
          isExpanded
          onCloseDownloadMenu={onCloseDownloadMenu}
          onDownloadGeneratedMaterial={onDownloadGeneratedMaterial}
          onGenerateSlideDeck={onGenerateSlideDeck}
          onOpenSlideDeckPreview={onOpenSlideDeckPreview}
          onSelectSlideDeck={onSelectSlideDeck}
          onToggleSlideDeckDownloadMenu={onToggleSlideDeckDownloadMenu}
          openSlideDeckDownloadMenuKey={openSlideDeckDownloadMenuKey}
          relativeNow={relativeNow}
          selectedSlideDeck={selectedSlideDeck}
          setSlideDeckDownloadMenuRef={setSlideDeckDownloadMenuRef}
          slideDeckErrorMessage={slideDeckErrorMessage}
          slideDeckMaterials={slideDeckMaterials}
          slideDeckStatus={slideDeckStatus}
        />
      </div>
    </section>
  );
}

function SlideDeckStudioPanel({
  checkedMaterials,
  isExpanded,
  onCloseDownloadMenu,
  onDownloadGeneratedMaterial,
  onGenerateSlideDeck,
  onOpenSlideDeckPreview,
  onSelectSlideDeck,
  onToggleSlideDeckDownloadMenu,
  openSlideDeckDownloadMenuKey,
  relativeNow,
  selectedSlideDeck,
  setSlideDeckDownloadMenuRef,
  slideDeckErrorMessage,
  slideDeckMaterials,
  slideDeckStatus,
}: {
  checkedMaterials: Material[];
  isExpanded: boolean;
  onCloseDownloadMenu: () => void;
  onDownloadGeneratedMaterial: (
    generatedMaterialUuid: string,
    format?: GeneratedMaterialDownloadFormat,
  ) => void;
  onGenerateSlideDeck: () => void;
  onOpenSlideDeckPreview: (generatedMaterialUuid: string) => void;
  onSelectSlideDeck: (generatedMaterialUuid: string) => void;
  onToggleSlideDeckDownloadMenu: (menuKey: string) => void;
  openSlideDeckDownloadMenuKey: string | null;
  relativeNow: number;
  selectedSlideDeck: GeneratedMaterial | null;
  setSlideDeckDownloadMenuRef: (node: HTMLDivElement | null) => void;
  slideDeckErrorMessage: string | null;
  slideDeckMaterials: GeneratedMaterial[];
  slideDeckStatus: "idle" | "loading" | "error";
}) {
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const previewItems = selectedSlideDeck ? readSlideDeckPreviewItems(selectedSlideDeck) : [];
  const previewStatus = selectedSlideDeck ? readSlideDeckPreviewStatus(selectedSlideDeck) : "pending";
  const previewError = selectedSlideDeck ? readSlideDeckPreviewError(selectedSlideDeck) : null;
  const fallbackOutlineCards = selectedSlideDeck ? readSlideDeckOutlineCards(selectedSlideDeck) : [];
  const selectedDisplayName = selectedSlideDeck?.name?.trim() || "Generated Slide Deck";
  const selectedSourceCount = selectedSlideDeck?.source_material_ids.length ?? 0;
  const tokenLabel = selectedSlideDeck ? formatTokenLabel(selectedSlideDeck) : null;
  const generatedAtLabel = selectedSlideDeck
    ? formatRelativeTime(Date.parse(selectedSlideDeck.created_at), relativeNow)
    : null;
  const headerMenuKey = selectedSlideDeck
    ? `slide-deck-header-${selectedSlideDeck.uuid}`
    : null;

  return (
    <div className={isExpanded ? "space-y-4" : "space-y-3"}>
      {slideDeckStatus === "loading" ? (
        <LoadingArtifactRow label="Generating slide deck..." sourceCount={checkedMaterials.length || 1} />
      ) : null}

      {slideDeckStatus === "error" ? (
        <ErrorArtifactRow
          message={slideDeckErrorMessage ?? "Slide deck generation failed."}
          onRetry={onGenerateSlideDeck}
        />
      ) : null}

      {selectedSlideDeck ? (
        <>
          <section className="rounded-[18px] border border-white/[0.1] bg-[rgba(255,255,255,0.03)] px-3.5 py-3.5 shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/48">
              Studio
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[31px] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {selectedDisplayName}
                </h3>
                <p className="mt-1 text-[13px] font-medium text-white/70">
                  Based on {selectedSourceCount} source{selectedSourceCount === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-[11px] text-white/48">
                  {generatedAtLabel}
                  {tokenLabel ? ` · ${tokenLabel}` : ""}
                </p>
              </div>

              {headerMenuKey ? (
                <SlideDeckDownloadMenu
                  isMenuOpen={openSlideDeckDownloadMenuKey === headerMenuKey}
                  menuKey={headerMenuKey}
                  onCloseMenu={onCloseDownloadMenu}
                  onDownloadPdf={() => onDownloadGeneratedMaterial(selectedSlideDeck.uuid, "pdf")}
                  onDownloadPptx={() => onDownloadGeneratedMaterial(selectedSlideDeck.uuid, "pptx")}
                  onToggleMenu={onToggleSlideDeckDownloadMenu}
                  setMenuRef={setSlideDeckDownloadMenuRef}
                />
              ) : null}
            </div>
          </section>

          {previewStatus === "failed" ? (
            <p className="rounded-[12px] border border-[rgba(255,126,126,0.22)] bg-[rgba(255,126,126,0.08)] px-3 py-2 text-[11px] text-white/72">
              {previewError ?? "Slide preview failed. Showing outline fallback."}
            </p>
          ) : null}

          <div className="space-y-3">
            {previewItems.length > 0
              ? previewItems.map((previewItem) => (
                  <article
                    key={previewItem.id}
                    className="overflow-hidden rounded-[18px] border border-white/[0.12] bg-[rgba(237,240,244,0.95)] p-2 shadow-[0_14px_26px_rgba(0,0,0,0.24)]"
                  >
                    <div className="overflow-hidden rounded-[14px] border border-[#cbd3dd] bg-[#f5f7fa]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewItem.imageUrl}
                        alt={`${selectedDisplayName} ${previewItem.label}`}
                        className="w-full bg-white object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-2 pb-1 pt-2">
                      <p className="text-[12px] font-semibold tracking-[-0.01em] text-[#111827]">
                        {previewItem.title}
                      </p>
                      <p className="text-[10.5px] text-[#334155]">
                        {previewItem.label}
                        {previewItem.subtitle ? ` · ${previewItem.subtitle}` : ""}
                      </p>
                    </div>
                  </article>
                ))
              : fallbackOutlineCards.length > 0
                ? fallbackOutlineCards.map((outlineCard, index) => (
                    <article
                      key={`${selectedSlideDeck.uuid}-outline-${index}`}
                      className="rounded-[18px] border border-white/[0.12] bg-[rgba(237,240,244,0.95)] p-4 shadow-[0_14px_26px_rgba(0,0,0,0.24)]"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
                        Slide {index + 1}
                      </p>
                      <h4 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#111827]">
                        {outlineCard.title}
                      </h4>
                      <ul className="mt-3 space-y-2 text-[12px] text-[#1f2937]">
                        {outlineCard.bullets.map((bullet, bulletIndex) => (
                          <li
                            key={`${selectedSlideDeck.uuid}-outline-${index}-bullet-${bulletIndex}`}
                            className="flex gap-2"
                          >
                            <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f2937]" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))
                : (
                    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-[12px] text-white/62">
                      Slide preview not available yet.
                    </div>
                  )}
          </div>

          {slideDeckMaterials.length > 1 ? (
            <section className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-white/48">
                Deck History
              </p>
              <div className="mt-2 space-y-1.5">
                {slideDeckMaterials.map((slideDeckMaterial) => {
                  const historyName = slideDeckMaterial.name?.trim() || "Generated Slide Deck";
                  const historyCreatedAt = Date.parse(slideDeckMaterial.created_at);
                  const isSelectedDeck = selectedSlideDeck?.uuid === slideDeckMaterial.uuid;
                  const menuKey = `slide-deck-history-${slideDeckMaterial.uuid}`;

                  return (
                    <div
                      key={slideDeckMaterial.uuid}
                      className={[
                        "flex w-full items-center justify-between gap-3 rounded-[11px] px-2.5 py-2 transition",
                        isSelectedDeck
                          ? "bg-white/[0.11] text-white"
                          : "bg-white/[0.03] text-white/76",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSlideDeck(slideDeckMaterial.uuid);
                          if (!isExpanded) {
                            onOpenSlideDeckPreview(slideDeckMaterial.uuid);
                          }
                        }}
                        className="min-w-0 flex-1 text-left hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
                      >
                        <p className="truncate text-[12px] font-medium">{historyName}</p>
                        <p className="text-[10px] text-white/52">
                          {formatRelativeTime(historyCreatedAt, relativeNow)}
                        </p>
                      </button>

                      {!slideDeckMaterial.file_location.startsWith("inline://") ? (
                        <SlideDeckDownloadMenu
                          compact
                          isMenuOpen={openSlideDeckDownloadMenuKey === menuKey}
                          menuKey={menuKey}
                          onCloseMenu={onCloseDownloadMenu}
                          onDownloadPdf={() => onDownloadGeneratedMaterial(slideDeckMaterial.uuid, "pdf")}
                          onDownloadPptx={() => onDownloadGeneratedMaterial(slideDeckMaterial.uuid, "pptx")}
                          onToggleMenu={onToggleSlideDeckDownloadMenu}
                          setMenuRef={setSlideDeckDownloadMenuRef}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className={isExpanded ? "rounded-[16px] bg-[#202328] pt-2" : "sticky bottom-0 z-10 rounded-[16px] bg-[#202328] pt-2"}>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFeedback("good")}
                className={[
                  "inline-flex h-12 items-center justify-center rounded-[15px] border px-4 text-[13px] font-medium transition",
                  feedback === "good"
                    ? "border-[rgba(184,219,128,0.42)] bg-[rgba(184,219,128,0.12)] text-white"
                    : "border-white/[0.12] bg-white/[0.04] text-white/84 hover:bg-white/[0.08]",
                ].join(" ")}
              >
                Good content
              </button>
              <button
                type="button"
                onClick={() => setFeedback("bad")}
                className={[
                  "inline-flex h-12 items-center justify-center rounded-[15px] border px-4 text-[13px] font-medium transition",
                  feedback === "bad"
                    ? "border-[rgba(255,126,126,0.3)] bg-[rgba(255,126,126,0.12)] text-white"
                    : "border-white/[0.12] bg-white/[0.04] text-white/84 hover:bg-white/[0.08]",
                ].join(" ")}
              >
                Bad content
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center">
          <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">No slide decks yet</p>
          <p className="mt-1 text-[11px] text-white/58">
            Select source materials and run Slide Deck to generate previews.
          </p>
          <button
            type="button"
            onClick={onGenerateSlideDeck}
            className="mt-3 inline-flex h-9 items-center rounded-full border border-white/[0.16] bg-white/[0.08] px-4 text-[11px] font-medium text-white/86 transition hover:bg-white/[0.12]"
          >
            Generate slide deck
          </button>
        </div>
      )}
    </div>
  );
}

function SlideDeckDownloadMenu({
  compact = false,
  isMenuOpen,
  menuKey,
  onCloseMenu,
  onDownloadPdf,
  onDownloadPptx,
  onToggleMenu,
  setMenuRef,
}: {
  compact?: boolean;
  isMenuOpen: boolean;
  menuKey: string;
  onCloseMenu: () => void;
  onDownloadPdf: () => void;
  onDownloadPptx: () => void;
  onToggleMenu: (menuKey: string) => void;
  setMenuRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(node) => {
        if (isMenuOpen) {
          setMenuRef(node);
        }
      }}
      className="relative flex shrink-0 items-center"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-label="Open deck download options"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleMenu(menuKey);
        }}
        className={[
          "inline-flex items-center justify-center rounded-[10px] border border-white/[0.14] bg-white/[0.07] text-white/80 transition hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]",
          compact ? "h-7 w-7" : "h-9 w-9",
        ].join(" ")}
      >
        <OverflowVerticalIcon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>

      {isMenuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-[186px] overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.03)_100%),linear-gradient(145deg,rgba(29,31,26,0.96)_0%,rgba(17,18,14,0.92)_100%)] p-1 shadow-[0_20px_44px_rgba(0,0,0,0.4)] backdrop-blur-[20px]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              onCloseMenu();
              onDownloadPptx();
            }}
            className="flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-medium text-[#e7ebdf] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
          >
            <ExportArrowIcon className="h-4 w-4 shrink-0" />
            <span>Download as PPTX</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.stopPropagation();
              onCloseMenu();
              onDownloadPdf();
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-medium text-[#d3e7ff] transition hover:bg-[rgba(211,231,255,0.16)] hover:text-[#eaf3ff]"
          >
            <ExportArrowIcon className="h-4 w-4 shrink-0" />
            <span>Download as PDF</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LoadingArtifactRow({
  sourceCount,
  label,
}: {
  sourceCount: number | null;
  label: string;
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
          <h4 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">{label}</h4>
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
          {quiz.source_count} source{quiz.source_count === 1 ? "" : "s"} · {formatRelativeTime(generatedAt, relativeNow)}
        </p>
      </div>

      <div className="shrink-0 rounded-full p-1.5 text-white/40 transition-all duration-200 ease-out group-hover:bg-white/[0.06] group-hover:text-white/68">
        <OverflowVerticalIcon className="h-4.5 w-4.5" />
      </div>
    </button>
  );
}

function GeneratedMaterialRow({
  generatedMaterial,
  isDownloadMenuOpen,
  onCloseDownloadMenu,
  onDownloadPdf,
  onDownloadPptx,
  onOpenPreview,
  onToggleDownloadMenu,
  relativeNow,
  setDownloadMenuRef,
}: {
  generatedMaterial: GeneratedMaterial;
  isDownloadMenuOpen: boolean;
  onCloseDownloadMenu: () => void;
  onDownloadPdf: () => void;
  onDownloadPptx: () => void;
  onOpenPreview: () => void;
  onToggleDownloadMenu: () => void;
  relativeNow: number;
  setDownloadMenuRef: (node: HTMLDivElement | null) => void;
}) {
  const createdAt = Date.parse(generatedMaterial.created_at);
  const relativeLabel = formatRelativeTime(createdAt, relativeNow);
  const isSlideDeckArtifact = generatedMaterial.tool_type === "slide_deck";
  const isDownloadable = !generatedMaterial.file_location.startsWith("inline://");
  const isClickable = isSlideDeckArtifact || isDownloadable;
  const displayName = generatedMaterial.name?.trim() || "Generated artifact";
  const tokenLabel = formatTokenLabel(generatedMaterial);
  const downloadMenuKey = `generated-row-${generatedMaterial.uuid}`;

  return (
    <div
      className={[
        "animate-studio-output-enter flex w-full items-center gap-2 rounded-[16px] px-1.5 py-1.5 transition-all duration-200 ease-out",
        isClickable ? "hover:bg-white/[0.05]" : "opacity-70",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={!isClickable}
        onClick={
          isClickable
            ? () => {
                if (isSlideDeckArtifact) {
                  onOpenPreview();
                  return;
                }
                onDownloadPptx();
              }
            : undefined
        }
        className={[
          "group flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-2 py-2 text-left transition-all duration-200 ease-out",
          isClickable
            ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
            : "cursor-not-allowed",
        ].join(" ")}
        title={
          isSlideDeckArtifact
            ? "Open slide deck preview"
            : isDownloadable
              ? "Download generated file"
              : "Inline artifact has no downloadable file"
        }
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-white/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {isSlideDeckArtifact ? (
            <SlideDeckIcon className="h-5 w-5" />
          ) : (
            <QuizIcon className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">
            {displayName}
          </h4>
          <p className="mt-1 text-[11px] font-medium text-white/54">
            {generatedMaterial.tool_type} · {relativeLabel}
          </p>
          {tokenLabel ? (
            <p className="mt-1 text-[10px] text-white/42">{tokenLabel}</p>
          ) : null}
        </div>
      </button>

      {isSlideDeckArtifact && isDownloadable ? (
        <SlideDeckDownloadMenu
          compact
          isMenuOpen={isDownloadMenuOpen}
          menuKey={downloadMenuKey}
          onCloseMenu={onCloseDownloadMenu}
          onDownloadPdf={onDownloadPdf}
          onDownloadPptx={onDownloadPptx}
          onToggleMenu={() => onToggleDownloadMenu()}
          setMenuRef={setDownloadMenuRef}
        />
      ) : (
        <ArrowRightIcon className="mr-2 h-4.5 w-4.5 shrink-0 text-white/42" />
      )}
    </div>
  );
}

function ErrorArtifactRow({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-[rgba(255,126,126,0.22)] bg-[rgba(255,126,126,0.08)] px-3 py-3">
      <p className="text-[12px] font-semibold text-[color:var(--text-primary)]">Slide deck generation failed</p>
      <p className="mt-1 text-[11px] text-white/60">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex h-8 items-center rounded-[10px] border border-white/[0.16] bg-white/[0.06] px-3 text-[11px] text-white/82 transition hover:bg-white/[0.1]"
      >
        Retry
      </button>
    </div>
  );
}

function readSlideDeckPreviewItems(generatedMaterial: GeneratedMaterial): SlideDeckPreviewItem[] {
  const previewPayload = readSlideDeckPreviewPayload(generatedMaterial);
  const rawItems = previewPayload?.["items"];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  const previewItems: SlideDeckPreviewItem[] = [];

  for (const rawItem of rawItems) {
    if (!isRecord(rawItem)) {
      continue;
    }

    const imageUrl = rawItem["image_url"];
    if (typeof imageUrl !== "string" || !imageUrl.trim()) {
      continue;
    }

    const indexValue = rawItem["index"];
    const index = typeof indexValue === "number" ? indexValue : previewItems.length;

    previewItems.push({
      id: typeof rawItem["id"] === "string" ? rawItem["id"] : `${generatedMaterial.uuid}-${index}`,
      imageUrl,
      index,
      label: typeof rawItem["label"] === "string" ? rawItem["label"] : `Slide ${index + 1}`,
      subtitle: typeof rawItem["subtitle"] === "string" ? rawItem["subtitle"] : "",
      title: typeof rawItem["title"] === "string" ? rawItem["title"] : `Slide ${index + 1}`,
    });
  }

  return previewItems.sort((firstItem, secondItem) => firstItem.index - secondItem.index);
}

function readSlideDeckPreviewStatus(
  generatedMaterial: GeneratedMaterial,
): "ready" | "failed" | "pending" {
  const previewPayload = readSlideDeckPreviewPayload(generatedMaterial);
  const rawStatus = previewPayload?.["status"];

  if (rawStatus === "ready" || rawStatus === "failed") {
    return rawStatus;
  }

  return "pending";
}

function readSlideDeckPreviewError(generatedMaterial: GeneratedMaterial): string | null {
  const previewPayload = readSlideDeckPreviewPayload(generatedMaterial);
  const rawError = previewPayload?.["error"];

  return typeof rawError === "string" && rawError.trim() ? rawError : null;
}

function readSlideDeckOutlineCards(generatedMaterial: GeneratedMaterial): SlideDeckOutlineCard[] {
  const rawOutline = generatedMaterial.payload["outline"];
  if (!isRecord(rawOutline)) {
    return [];
  }

  const rawSlides = rawOutline["slides"];
  if (!Array.isArray(rawSlides)) {
    return [];
  }

  const outlineCards: SlideDeckOutlineCard[] = [];

  for (const [index, rawSlide] of rawSlides.entries()) {
    if (!isRecord(rawSlide)) {
      continue;
    }

    const rawBullets = rawSlide["bullets"];
    const bullets = Array.isArray(rawBullets)
      ? rawBullets.filter((bullet): bullet is string => typeof bullet === "string" && bullet.trim().length > 0)
      : [];

    outlineCards.push({
      bullets: bullets.length > 0 ? bullets : ["Key points unavailable for this slide."],
      title:
        typeof rawSlide["title"] === "string" && rawSlide["title"].trim().length > 0
          ? rawSlide["title"]
          : `Slide ${index + 1}`,
    });
  }

  return outlineCards;
}

function readSlideDeckPreviewPayload(generatedMaterial: GeneratedMaterial): Record<string, unknown> | null {
  const rawPreview = generatedMaterial.payload["preview"];

  return isRecord(rawPreview) ? rawPreview : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatTokenLabel(generatedMaterial: GeneratedMaterial): string | null {
  const inputToken = generatedMaterial.input_token;
  const outputToken = generatedMaterial.output_token;

  if (typeof inputToken !== "number" && typeof outputToken !== "number") {
    return null;
  }

  return `in: ${inputToken ?? 0} • out: ${outputToken ?? 0}`;
}

function formatRelativeTime(createdAt: number, relativeNow: number) {
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
