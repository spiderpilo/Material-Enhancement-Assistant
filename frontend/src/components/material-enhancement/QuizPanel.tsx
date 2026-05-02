import type { GeneratedQuiz, QuizQuestion } from "@/lib/api/quiz";
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
export type QuizViewMode = "question" | "results";

type QuizPanelProps = {
  activeQuestionIndex: number;
  checkedMaterials: Material[];
  errorMessage: string | null;
  onClose: () => void;
  onNavigate: (direction: "previous" | "next") => void;
  onReset: () => void;
  onRetry: () => void;
  onReview: () => void;
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onShowResults: () => void;
  quiz: GeneratedQuiz | null;
  revealedFeedback: Record<string, boolean>;
  selectedAnswers: Record<string, string>;
  status: QuizGenerationStatus;
  viewMode: QuizViewMode;
};

type QuizSummary = {
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
};

export function QuizPanel({
  activeQuestionIndex,
  checkedMaterials,
  errorMessage,
  onClose,
  onNavigate,
  onReset,
  onRetry,
  onReview,
  onSelectAnswer,
  onShowResults,
  quiz,
  revealedFeedback,
  selectedAnswers,
  status,
  viewMode,
}: QuizPanelProps) {
  const question = quiz?.questions[activeQuestionIndex] ?? null;
  const totalQuestions = quiz?.questions.length ?? 12;
  const sourceCount = quiz?.source_count ?? checkedMaterials.length;
  const summary = getQuizSummary(quiz, selectedAnswers);

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
      ) : quiz && viewMode === "results" ? (
        <QuizResultsView
          quiz={quiz}
          onReset={onReset}
          onReview={onReview}
          selectedAnswers={selectedAnswers}
          summary={summary}
        />
      ) : question && quiz ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-[72px] py-11">
            <div className="mx-auto max-w-[980px]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[24px] font-semibold text-[rgba(245,245,244,0.42)]">
                    {activeQuestionIndex + 1} / {totalQuestions}
                  </p>
                  <h3 className="mt-8 max-w-[860px] text-[27px] font-semibold leading-[1.45] text-[color:var(--text-primary)]">
                    {question.prompt}
                  </h3>
                  <p className="mt-4 text-[14px] font-medium text-[color:var(--text-muted)]">
                    {getQuestionStatusLabel({
                      hasFeedback: Boolean(revealedFeedback[question.id]),
                      selectedOptionId: selectedAnswers[question.id],
                      question,
                    })}
                  </p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[color:var(--text-muted)]">
                  <QuizIcon className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-10 space-y-4">
                {question.options.map((option) => {
                  const selectedOptionId = selectedAnswers[question.id];
                  const hasFeedback = Boolean(revealedFeedback[question.id]);
                  const isSelected = selectedOptionId === option.id;
                  const isCorrect = question.correct_option_id === option.id;
                  const showCorrect = hasFeedback && isCorrect;
                  const showWrongSelected = hasFeedback && isSelected && !isCorrect;
                  const showCorrectSelected = hasFeedback && isSelected && isCorrect;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectAnswer(question.id, option.id)}
                      className={[
                        "w-full rounded-[20px] border px-9 py-7 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
                        getOptionClass({
                          hasFeedback,
                          isCorrect,
                          isSelected,
                        }),
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-6">
                        <SelectionIndicator
                          isCorrect={showCorrect}
                          isSelected={isSelected}
                          isWrong={showWrongSelected}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-4">
                            <span
                              className={[
                                "mt-0.5 w-7 shrink-0 text-[22px] font-semibold",
                                showWrongSelected
                                  ? "text-[#ff9aa8]"
                                  : showCorrect
                                    ? "text-[#5ee087]"
                                    : "text-[rgba(245,245,244,0.62)]",
                              ].join(" ")}
                            >
                              {option.label}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className={[
                                  "text-[22px] leading-[1.35]",
                                  showWrongSelected
                                    ? "text-[#ffd2d8]"
                                    : showCorrect
                                      ? "text-[color:var(--text-primary)]"
                                      : "text-[color:var(--text-secondary)]",
                                ].join(" ")}
                              >
                                {option.text}
                              </p>

                              {showCorrectSelected ? (
                                <div className="mt-5 rounded-[16px] border border-[rgba(31,198,94,0.26)] bg-[rgba(31,198,94,0.08)] px-5 py-4">
                                  <p className="inline-flex items-center gap-3 text-[18px] font-semibold text-[#5ee087]">
                                    <CheckIcon className="h-5 w-5" />
                                    Right answer
                                  </p>
                                  <p className="mt-3 text-[17px] leading-[1.55] text-[rgba(226,244,231,0.78)]">
                                    {option.explanation || question.explanation}
                                  </p>
                                </div>
                              ) : null}

                              {showWrongSelected ? (
                                <div className="mt-5 rounded-[16px] border border-[rgba(255,154,168,0.28)] bg-[rgba(255,154,168,0.08)] px-5 py-4">
                                  <p className="text-[18px] font-semibold text-[#ff9aa8]">
                                    Wrong answer
                                  </p>
                                  <p className="mt-3 text-[17px] leading-[1.55] text-[rgba(255,219,224,0.8)]">
                                    {option.explanation || question.explanation}
                                  </p>
                                  <p className="mt-3 text-[16px] font-medium text-[rgba(245,245,244,0.88)]">
                                    Correct answer: {getCorrectAnswerLabel(question)}
                                  </p>
                                </div>
                              ) : null}

                              {showCorrect && !isSelected ? (
                                <div className="mt-5 rounded-[16px] border border-[rgba(31,198,94,0.22)] bg-[rgba(31,198,94,0.06)] px-5 py-4">
                                  <p className="inline-flex items-center gap-3 text-[18px] font-semibold text-[#5ee087]">
                                    <CheckIcon className="h-5 w-5" />
                                    Correct answer
                                  </p>
                                  <p className="mt-3 text-[17px] leading-[1.55] text-[rgba(226,244,231,0.78)]">
                                    {option.explanation || question.explanation}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
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
                {summary.answeredCount} answered · {summary.skippedCount} skipped
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onReset}
                className="h-11 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-5 text-[14px] font-semibold text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
              >
                Retake Quiz
              </button>
              <button
                type="button"
                onClick={onShowResults}
                className="h-11 rounded-[12px] bg-[color:var(--accent-green)] px-6 text-[14px] font-semibold text-[#111411] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
              >
                See Results
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

function QuizResultsView({
  quiz,
  onReset,
  onReview,
  selectedAnswers,
  summary,
}: {
  quiz: GeneratedQuiz;
  onReset: () => void;
  onReview: () => void;
  selectedAnswers: Record<string, string>;
  summary: QuizSummary;
}) {
  const totalQuestions = quiz.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((summary.correctCount / totalQuestions) * 100) : 0;
  const progressDegrees = totalQuestions > 0 ? (summary.correctCount / totalQuestions) * 360 : 0;
  const heading =
    summary.answeredCount === 0
      ? "No questions answered."
      : summary.correctCount === totalQuestions
        ? "All answers correct."
        : "Quiz review ready.";

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-[72px] py-11">
        <div className="mx-auto max-w-[980px]">
          <h3 className="text-[52px] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
            {heading}
          </h3>
          <p className="mt-4 max-w-[640px] text-[17px] leading-[1.65] text-[color:var(--text-muted)]">
            Review every question with the stored feedback, or retake the quiz and try a fresh pass.
          </p>

          <div className="mt-10 rounded-[30px] border border-[rgba(255,255,255,0.08)] bg-[#20242a] p-10">
            <div className="flex flex-wrap items-center gap-10">
              <div
                className="flex h-[278px] w-[278px] items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#1fc65e 0deg ${progressDegrees}deg, rgba(255,255,255,0.14) ${progressDegrees}deg 360deg)`,
                }}
              >
                <div className="flex h-[206px] w-[206px] flex-col items-center justify-center rounded-full bg-[#1b1f25]">
                  <p className="text-[58px] font-semibold leading-none text-[color:var(--text-primary)]">
                    {summary.correctCount}/{totalQuestions}
                  </p>
                  <p className="mt-3 text-[28px] font-medium text-[color:var(--text-secondary)]">
                    {percentage}%
                  </p>
                </div>
              </div>

              <div className="min-w-[260px] flex-1 space-y-6">
                <SummaryStat label="Right" tone="green" value={summary.correctCount} />
                <SummaryStat label="Wrong" tone="red" value={summary.wrongCount} />
                <SummaryStat label="Skipped" tone="neutral" value={summary.skippedCount} />
                <div className="rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.12)] px-5 py-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
                    Review note
                  </p>
                  <p className="mt-3 text-[16px] leading-[1.6] text-[color:var(--text-secondary)]">
                    {summary.answeredCount === 0
                      ? "Everything is skipped. Review Quiz opens the question flow without forcing any answer."
                      : "Review Quiz keeps every marked answer, including skipped questions and feedback reveals."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[26px] border border-[rgba(255,255,255,0.08)] bg-[#20242a] p-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
              Answer state
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {quiz.questions.slice(0, 12).map((question, index) => {
                const selectedOptionId = selectedAnswers[question.id];
                const isCorrect = selectedOptionId === question.correct_option_id;

                return (
                  <div
                    key={question.id}
                    className={[
                      "rounded-[18px] border px-5 py-4",
                      !selectedOptionId
                        ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
                        : isCorrect
                          ? "border-[rgba(31,198,94,0.36)] bg-[rgba(31,198,94,0.07)]"
                          : "border-[rgba(255,154,168,0.36)] bg-[rgba(255,154,168,0.07)]",
                    ].join(" ")}
                  >
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
                      Question {index + 1}
                    </p>
                    <p className="mt-3 text-[15px] font-medium text-[color:var(--text-primary)]">
                      {!selectedOptionId ? "Skipped" : isCorrect ? "Right answer" : "Wrong answer"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[92px] shrink-0 items-center justify-end gap-3 border-t border-[rgba(255,255,255,0.08)] bg-[#181c21] px-7">
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-5 text-[14px] font-semibold text-[color:var(--text-secondary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
        >
          Retake Quiz
        </button>
        <button
          type="button"
          onClick={onReview}
          className="h-11 rounded-[12px] bg-[color:var(--accent-green)] px-6 text-[14px] font-semibold text-[#111411] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
        >
          Review Quiz
        </button>
      </div>
    </>
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

function SelectionIndicator({
  isCorrect,
  isSelected,
  isWrong,
}: {
  isCorrect: boolean;
  isSelected: boolean;
  isWrong: boolean;
}) {
  return (
    <span
      className={[
        "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition",
        isWrong
          ? "border-[#ff7c90] bg-[rgba(255,124,144,0.12)]"
          : isCorrect
            ? "border-[#1fc65e] bg-[rgba(31,198,94,0.14)]"
            : isSelected
              ? "border-[rgba(247,246,211,0.42)] bg-[rgba(255,255,255,0.06)]"
              : "border-[rgba(255,255,255,0.12)] bg-transparent",
      ].join(" ")}
      aria-hidden="true"
    >
      {isCorrect ? <CheckIcon className="h-3.5 w-3.5 text-[#5ee087]" /> : null}
      {isWrong ? <span className="h-2.5 w-2.5 rounded-full bg-[#ff7c90]" /> : null}
    </span>
  );
}

function SummaryStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "red" | "neutral";
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-[20px] text-[color:var(--text-secondary)]">
        {label}
      </span>
      <span
        className={[
          "text-[34px] font-semibold leading-none",
          tone === "green"
            ? "text-[#45b450]"
            : tone === "red"
              ? "text-[#ff9aa8]"
              : "text-[color:var(--text-primary)]",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function getOptionClass({
  hasFeedback,
  isCorrect,
  isSelected,
}: {
  hasFeedback: boolean;
  isCorrect: boolean;
  isSelected: boolean;
}) {
  if (hasFeedback && isSelected && !isCorrect) {
    return "border-[rgba(255,124,144,0.68)] bg-[rgba(255,124,144,0.08)] shadow-[0_0_0_1px_rgba(255,124,144,0.22)]";
  }

  if (hasFeedback && isCorrect) {
    return "border-[#1fc65e] bg-[rgba(31,198,94,0.08)] shadow-[0_0_0_1px_rgba(31,198,94,0.4)]";
  }

  if (isSelected) {
    return "border-[rgba(247,246,211,0.42)] bg-[rgba(255,255,255,0.07)]";
  }

  return "border-[rgba(255,255,255,0.05)] bg-[#191d23] hover:border-[rgba(255,255,255,0.1)] hover:bg-[#1b2027]";
}

function getQuestionStatusLabel({
  hasFeedback,
  selectedOptionId,
  question,
}: {
  hasFeedback: boolean;
  selectedOptionId?: string;
  question: QuizQuestion;
}) {
  if (!selectedOptionId) {
    return "Skipped for now. Use Next to keep reviewing.";
  }

  if (!hasFeedback) {
    return "Answer selected.";
  }

  return selectedOptionId === question.correct_option_id
    ? "Right answer selected."
    : "Wrong answer selected. Correct choice is highlighted in green.";
}

function getCorrectAnswerLabel(question: QuizQuestion) {
  const correctOption = question.options.find((option) => option.id === question.correct_option_id);
  return correctOption ? `${correctOption.label}. ${correctOption.text}` : "Unavailable";
}

function getQuizSummary(
  quiz: GeneratedQuiz | null,
  selectedAnswers: Record<string, string>,
): QuizSummary {
  if (!quiz) {
    return {
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
    };
  }

  let answeredCount = 0;
  let correctCount = 0;

  for (const question of quiz.questions) {
    const selectedOptionId = selectedAnswers[question.id];

    if (!selectedOptionId) {
      continue;
    }

    answeredCount += 1;
    if (selectedOptionId === question.correct_option_id) {
      correctCount += 1;
    }
  }

  return {
    answeredCount,
    correctCount,
    wrongCount: answeredCount - correctCount,
    skippedCount: quiz.questions.length - answeredCount,
  };
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
