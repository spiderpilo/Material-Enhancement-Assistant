import type { GeneratedQuiz } from "@/lib/api/quiz";
import type { Material } from "@/lib/material-enhancement/workspace";

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
  selectedAnswers,
  status,
  viewMode,
}: QuizPanelProps) {
  const question = quiz?.questions[activeQuestionIndex] ?? null;
  const totalQuestions = quiz?.questions.length ?? 12;
  const sourceCount = quiz?.source_count ?? checkedMaterials.length;
  const summary = getQuizSummary(quiz, selectedAnswers);
  const selectedOptionId = question ? selectedAnswers[question.id] : undefined;
  const isLastQuestion = activeQuestionIndex >= totalQuestions - 1;

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-6 pb-5 pt-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white/46">
            Studio &gt; App
          </p>
          <h2 className="mt-3 truncate text-[28px] font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
            {quiz?.title ?? "Generated Quiz"}
          </h2>
          <p className="mt-2 text-[12px] font-medium text-white/52">
            Based on {Math.max(sourceCount, 1)} source{Math.max(sourceCount, 1) === 1 ? "" : "s"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-white/70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
          aria-label="Close quiz panel"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </header>

      {status === "loading" ? (
        <QuizPanelState
          detail={`Generating questions based on ${Math.max(checkedMaterials.length, 1)} source${Math.max(checkedMaterials.length, 1) === 1 ? "" : "s"}.`}
          label="Generating Quiz..."
          loading
        />
      ) : status === "error" ? (
        <QuizPanelState
          actionLabel="Try again"
          detail={errorMessage ?? "Unable to generate quiz."}
          label="Quiz generation failed"
          onAction={onRetry}
        />
      ) : quiz && viewMode === "results" ? (
        <QuizResultsView
          onReset={onReset}
          onReview={onReview}
          quiz={quiz}
          summary={summary}
        />
      ) : question && quiz ? (
        <>
          <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-[620px]">
              <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(150deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
                      Progress
                    </p>
                    <p className="mt-3 text-[24px] font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
                      {activeQuestionIndex + 1} / {totalQuestions}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-[color:var(--accent-green)]">
                    <QuizIcon className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="mt-6 text-[28px] font-semibold leading-[1.32] tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {question.prompt}
                </h3>

                <p className="mt-4 text-[13px] text-white/48">
                  {selectedOptionId ? "Answer selected." : "Choose one answer and continue when ready."}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {question.options.map((option) => {
                  const isSelected = selectedOptionId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelectAnswer(question.id, option.id)}
                      className={[
                        "w-full rounded-[22px] border px-5 py-5 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]",
                        isSelected
                          ? "border-[rgba(184,219,128,0.34)] bg-[rgba(255,255,255,0.08)] shadow-[0_0_0_1px_rgba(184,219,128,0.14),0_0_28px_rgba(184,219,128,0.08)]"
                          : "border-white/[0.08] bg-[rgba(255,255,255,0.04)] hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-[rgba(255,255,255,0.06)]",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={[
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-all duration-200",
                            isSelected
                              ? "border-[rgba(184,219,128,0.42)] bg-[rgba(184,219,128,0.14)] text-[color:var(--accent-green)]"
                              : "border-white/[0.12] bg-white/[0.03] text-white/72",
                          ].join(" ")}
                        >
                          {option.label}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={[
                              "text-[18px] leading-[1.45]",
                              isSelected ? "text-[color:var(--text-primary)]" : "text-white/82",
                            ].join(" ")}
                          >
                            {option.text}
                          </p>
                        </div>

                        {isSelected ? (
                          <div className="mt-1 shrink-0 text-[color:var(--accent-green)]">
                            <CheckIcon className="h-5 w-5" />
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-white/[0.08] bg-[rgba(17,19,22,0.55)] px-6 py-4">
            <div className="mx-auto flex w-full max-w-[620px] items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onNavigate("previous")}
                disabled={activeQuestionIndex === 0}
                className={[
                  "inline-flex h-11 items-center gap-2 rounded-[16px] border px-4 text-[14px] font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]",
                  activeQuestionIndex === 0
                    ? "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-white/28"
                    : "border-white/[0.08] bg-white/[0.05] text-white/74 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.08]",
                ].join(" ")}
              >
                <ArrowLeftIcon className="h-4.5 w-4.5" />
                Previous
              </button>

              <button
                type="button"
                onClick={isLastQuestion ? onShowResults : () => onNavigate("next")}
                className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[color:var(--accent-green)] px-6 text-[15px] font-semibold text-[#111411] shadow-[0_12px_30px_rgba(184,219,128,0.2)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
              >
                {isLastQuestion ? "Finish" : "Next"}
                <ArrowRightIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <QuizPanelState
          actionLabel="Generate quiz"
          detail={checkedMaterials.length > 0 ? "Open Quiz Maker to generate a quiz from your selected sources." : "Select one or more sources before generating a quiz."}
          label="No quiz yet"
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
  loading = false,
  onAction,
}: {
  actionLabel?: string;
  detail: string;
  label: string;
  loading?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="w-full max-w-[420px] rounded-[28px] border border-white/[0.08] bg-[linear-gradient(150deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] px-8 py-9 text-center shadow-[0_22px_46px_rgba(0,0,0,0.22)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/[0.08] bg-white/[0.05] text-[color:var(--accent-green)]">
          {loading ? (
            <span className="h-7 w-7 rounded-full border-2 border-current/25 border-t-current animate-[spin_1000ms_linear_infinite]" />
          ) : (
            <QuizIcon className="h-8 w-8" />
          )}
        </div>

        <h3 className="mt-6 text-[24px] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
          {label}
        </h3>
        <p className="mt-3 text-[14px] leading-[1.65] text-white/58">
          {detail}
        </p>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-7 inline-flex h-11 items-center justify-center rounded-[14px] bg-[color:var(--accent-green)] px-5 text-[14px] font-semibold text-[#111411] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function QuizResultsView({
  onReset,
  onReview,
  quiz,
  summary,
}: {
  onReset: () => void;
  onReview: () => void;
  quiz: GeneratedQuiz;
  summary: QuizSummary;
}) {
  const totalQuestions = quiz.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((summary.correctCount / totalQuestions) * 100) : 0;

  return (
    <>
      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-[620px]">
          <div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(150deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
              Quiz Complete
            </p>
            <h3 className="mt-4 text-[34px] font-semibold tracking-[-0.05em] text-[color:var(--text-primary)]">
              {summary.correctCount} / {totalQuestions} correct
            </h3>
            <p className="mt-3 text-[14px] leading-[1.65] text-white/56">
              You answered {summary.answeredCount} question{summary.answeredCount === 1 ? "" : "s"} and scored {percentage}%.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <ResultStatCard label="Correct" tone="green" value={summary.correctCount} />
              <ResultStatCard label="Wrong" tone="red" value={summary.wrongCount} />
              <ResultStatCard label="Skipped" tone="neutral" value={summary.skippedCount} />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.08] bg-[rgba(17,19,22,0.55)] px-6 py-4">
        <div className="mx-auto flex w-full max-w-[620px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center rounded-[16px] border border-white/[0.08] bg-white/[0.05] px-4 text-[14px] font-medium text-white/76 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
          >
            Retake Quiz
          </button>

          <button
            type="button"
            onClick={onReview}
            className="inline-flex h-12 items-center gap-2 rounded-[16px] bg-[color:var(--accent-green)] px-6 text-[15px] font-semibold text-[#111411] shadow-[0_12px_30px_rgba(184,219,128,0.2)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(184,219,128,0.35)]"
          >
            Review
            <ArrowRightIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </>
  );
}

function ResultStatCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "red" | "neutral";
  value: number;
}) {
  return (
    <div
      className={[
        "rounded-[20px] border px-4 py-4",
        tone === "green"
          ? "border-[rgba(184,219,128,0.22)] bg-[rgba(184,219,128,0.08)]"
          : tone === "red"
            ? "border-[rgba(255,154,168,0.22)] bg-[rgba(255,154,168,0.08)]"
            : "border-white/[0.08] bg-white/[0.04]",
      ].join(" ")}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <p className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-[color:var(--text-primary)]">
        {value}
      </p>
    </div>
  );
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
