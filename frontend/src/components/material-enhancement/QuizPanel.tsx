import type { GeneratedQuiz } from "@/lib/api/quiz";
import type { Material } from "@/lib/material-enhancement/workspace";
import { getMaterialBaseName } from "@/lib/material-enhancement/workspace";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  QuizIcon,
} from "./icons";

export type QuizGenerationStatus = "idle" | "loading" | "ready" | "error";

type QuizPanelProps = {
  activeQuestionIndex: number;
  checkedMaterials: Material[];
  errorMessage: string | null;
  isSubmitted: boolean;
  onClose: () => void;
  onNavigate: (direction: "previous" | "next") => void;
  onReset: () => void;
  onRetry: () => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onSubmit: () => void;
  quiz: GeneratedQuiz | null;
  selectedAnswers: Record<string, string>;
  status: QuizGenerationStatus;
};

export function QuizPanel({
  activeQuestionIndex,
  checkedMaterials,
  errorMessage,
  isSubmitted,
  onClose,
  onNavigate,
  onReset,
  onRetry,
  onSelectAnswer,
  onSubmit,
  quiz,
  selectedAnswers,
  status,
}: QuizPanelProps) {
  const question = quiz?.questions[activeQuestionIndex] ?? null;
  const totalQuestions = quiz?.questions.length ?? 12;
  const sourceCount = quiz?.source_count ?? checkedMaterials.length;
  const answeredCount = quiz
    ? quiz.questions.filter((item) => Boolean(selectedAnswers[item.id])).length
    : 0;
  const score = quiz
    ? quiz.questions.filter((item) => selectedAnswers[item.id] === item.correct_option_id).length
    : 0;
  const canSubmit = Boolean(quiz) && answeredCount === totalQuestions && !isSubmitted;

  return (
    <section className="shadow-panel surface-inset relative flex h-[949px] min-h-[949px] flex-col overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.1)] bg-[#1f2328]">
      <div className="flex h-[86px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#181c21] px-7">
        <div className="min-w-0">
          <p className="text-[13px] text-[color:var(--text-muted)]">
            Quizmaker
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-3">
            <h2 className="truncate text-[28px] font-semibold text-[color:var(--text-primary)]">
              {quiz?.title ?? "Generated Quiz"}
            </h2>
            <span className="shrink-0 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-1 text-[12px] font-semibold text-[color:var(--text-secondary)]">
              Based on {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
            aria-label="Quiz options"
          >
            <span className="text-[22px] leading-none">...</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
            aria-label="Close quiz panel"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {status === "loading" ? (
        <QuizPanelState
          label="Making quiz"
          detail={`${checkedMaterials.length} selected source${checkedMaterials.length === 1 ? "" : "s"}`}
        />
      ) : status === "error" ? (
        <QuizPanelState
          label="Quiz generation failed"
          detail={errorMessage ?? "Unable to generate quiz."}
          actionLabel="Try again"
          onAction={onRetry}
        />
      ) : question && quiz ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-[72px] py-11">
            <div className="mx-auto max-w-[980px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[24px] font-semibold text-[rgba(245,245,244,0.42)]">
                    {isSubmitted ? `${score} / ${totalQuestions}` : `${activeQuestionIndex + 1} / ${totalQuestions}`}
                  </p>
                  <h3 className="mt-8 max-w-[860px] text-[27px] font-semibold leading-[1.45] text-[color:var(--text-primary)]">
                    {question.prompt}
                  </h3>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[color:var(--text-muted)]">
                  <QuizIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-10 space-y-4">
                {question.options.map((option) => {
                  const selectedOptionId = selectedAnswers[question.id];
                  const isSelected = selectedOptionId === option.id;
                  const isCorrect = question.correct_option_id === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => onSelectAnswer(question.id, option.id)}
                      className={[
                        "w-full rounded-[20px] border px-9 py-7 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
                        getOptionClass({
                          isCorrect,
                          isSelected,
                          isSubmitted,
                        }),
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-6">
                        <span className="mt-0.5 w-7 shrink-0 text-[22px] font-semibold text-[rgba(245,245,244,0.62)]">
                          {option.label}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[22px] leading-[1.35] text-[color:var(--text-secondary)]">
                            {option.text}
                          </p>

                          {isSubmitted ? (
                            <div className="mt-5">
                              {isCorrect ? (
                                <p className="inline-flex items-center gap-3 text-[18px] font-semibold text-[#5ee087]">
                                  <CheckIcon className="h-5 w-5" />
                                  {isSelected ? "That's right!" : "Correct answer"}
                                </p>
                              ) : isSelected ? (
                                <p className="text-[18px] font-semibold text-[#ff9aa8]">
                                  Not quite.
                                </p>
                              ) : null}

                              <p className="mt-4 text-[18px] leading-[1.55] text-[rgba(214,211,209,0.68)]">
                                {option.explanation || question.explanation}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex h-[92px] shrink-0 items-center justify-between border-t border-[rgba(255,255,255,0.08)] bg-[#181c21] px-7">
            <div className="flex items-center gap-3">
              <QuizNavButton
                direction="previous"
                disabled={activeQuestionIndex === 0}
                onClick={() => onNavigate("previous")}
              />
              <QuizNavButton
                direction="next"
                disabled={activeQuestionIndex >= totalQuestions - 1}
                onClick={() => onNavigate("next")}
              />
              <span className="ml-3 text-[13px] font-semibold text-[color:var(--text-muted)]">
                {answeredCount} answered
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onReset}
                className="h-11 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-5 text-[14px] font-semibold text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={onSubmit}
                className={[
                  "h-11 rounded-[12px] px-6 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
                  canSubmit
                    ? "bg-[color:var(--accent-green)] text-[#111411] hover:brightness-105"
                    : "border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[rgba(214,211,209,0.42)]",
                ].join(" ")}
              >
                {isSubmitted ? `Score ${score} / ${totalQuestions}` : "Submit Answers"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <QuizPanelState
          label="No quiz yet"
          detail={formatSourceNames(checkedMaterials)}
          actionLabel="Generate quiz"
          onAction={onRetry}
        />
      )}
    </section>
  );
}

function QuizPanelState({
  actionLabel,
  detail,
  label,
  onAction,
}: {
  actionLabel?: string;
  detail: string;
  label: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="max-w-[420px] text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] text-[color:var(--accent-green)]">
          <QuizIcon className="h-8 w-8" />
        </div>
        <h3 className="mt-6 text-[24px] font-semibold text-[color:var(--text-primary)]">
          {label}
        </h3>
        <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--text-muted)]">
          {detail}
        </p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-7 h-11 rounded-[12px] bg-[color:var(--accent-green)] px-6 text-[14px] font-semibold text-[#111411] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function QuizNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "previous" ? "Previous question" : "Next question"}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[color:var(--text-secondary)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
        disabled ? "opacity-35" : "hover:bg-[rgba(255,255,255,0.08)]",
      ].join(" ")}
    >
      {direction === "previous" ? (
        <ArrowLeftIcon className="h-5 w-5" />
      ) : (
        <ArrowRightIcon className="h-5 w-5" />
      )}
    </button>
  );
}

function getOptionClass({
  isCorrect,
  isSelected,
  isSubmitted,
}: {
  isCorrect: boolean;
  isSelected: boolean;
  isSubmitted: boolean;
}) {
  if (isSubmitted && isCorrect) {
    return "border-[#1fc65e] bg-[rgba(31,198,94,0.08)] shadow-[0_0_0_1px_rgba(31,198,94,0.45)]";
  }

  if (isSubmitted && isSelected && !isCorrect) {
    return "border-[rgba(255,154,168,0.72)] bg-[rgba(255,154,168,0.08)]";
  }

  if (isSelected) {
    return "border-[rgba(247,246,211,0.42)] bg-[rgba(255,255,255,0.07)]";
  }

  return "border-[rgba(255,255,255,0.05)] bg-[#191d23] hover:border-[rgba(255,255,255,0.1)] hover:bg-[#1b2027]";
}

function formatSourceNames(materials: Material[]): string {
  if (materials.length === 0) {
    return "Select sources from the left panel first.";
  }

  return materials
    .slice(0, 3)
    .map((material) => getMaterialBaseName(material.name))
    .join(", ");
}
