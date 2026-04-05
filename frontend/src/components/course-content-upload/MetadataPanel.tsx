"use client";

import { useState } from "react";

import {
  ChevronDownIcon,
  CloseSmallIcon,
  CourseStackIcon,
  InfoCircleIcon,
} from "@/components/course-content-upload/icons";

type AnalysisOptionKey = "studyGuide" | "terminology" | "quiz";

type MetadataFormState = {
  courseName: string;
  lectureTitle: string;
  week: string;
  topic: string;
  keywordInput: string;
  keywords: string[];
  options: Record<AnalysisOptionKey, boolean>;
};

const weekOptions = ["Week 1", "Week 2", "Week 3", "Week 4"];
const topicOptions = [
  "Soil Science",
  "Environmental Systems",
  "Biogeochemistry",
  "Ecology",
];

const optionLabels: Array<{
  key: AnalysisOptionKey;
  label: string;
}> = [
  { key: "studyGuide", label: "Auto-generate study guide" },
  { key: "terminology", label: "Extract key terminology" },
  { key: "quiz", label: "Generate practice quiz" },
];

export function MetadataPanel() {
  const [formState, setFormState] = useState<MetadataFormState>({
    courseName: "BIO201: Environmental Systems",
    lectureTitle: "",
    week: "Week 2",
    topic: "Soil Science",
    keywordInput: "",
    keywords: ["Nitrogen Cycle", "Microbiome"],
    options: {
      studyGuide: true,
      terminology: true,
      quiz: false,
    },
  });

  function addKeyword() {
    const nextKeyword = formState.keywordInput.trim();

    if (!nextKeyword || formState.keywords.includes(nextKeyword)) {
      setFormState((current) => ({ ...current, keywordInput: "" }));
      return;
    }

    setFormState((current) => ({
      ...current,
      keywordInput: "",
      keywords: [...current.keywords, nextKeyword],
    }));
  }

  return (
    <aside className="rounded-[24px] bg-[color:var(--panel)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="font-[family:var(--font-display)] text-[1.75rem] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
        Metadata Context
      </h2>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="course-name"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]"
          >
            Course Name
          </label>
          <div className="relative mt-2">
            <CourseStackIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
            <input
              id="course-name"
              type="text"
              value={formState.courseName}
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  courseName: event.target.value,
                }));
              }}
              className="h-12 w-full rounded-2xl border border-[color:var(--line-strong)] bg-white pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="lecture-title"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]"
          >
            Lecture Title
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[color:var(--muted)]">
              T
            </span>
            <input
              id="lecture-title"
              type="text"
              value={formState.lectureTitle}
              placeholder="e.g. Nutrient Cycling in Soils"
              onChange={(event) => {
                setFormState((current) => ({
                  ...current,
                  lectureTitle: event.target.value,
                }));
              }}
              className="h-12 w-full rounded-2xl border border-[color:var(--line-strong)] bg-white pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="week"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]"
            >
              Week
            </label>
            <div className="relative mt-2">
              <select
                id="week"
                value={formState.week}
                onChange={(event) => {
                  setFormState((current) => ({
                    ...current,
                    week: event.target.value,
                  }));
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-[color:var(--line-strong)] bg-white px-4 pr-10 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              >
                {weekOptions.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
            </div>
          </div>

          <div>
            <label
              htmlFor="topic"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]"
            >
              Topic
            </label>
            <div className="relative mt-2">
              <select
                id="topic"
                value={formState.topic}
                onChange={(event) => {
                  setFormState((current) => ({
                    ...current,
                    topic: event.target.value,
                  }));
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-[color:var(--line-strong)] bg-white px-4 pr-10 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              >
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="keyword-input"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-strong)]"
          >
            Keywords
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {formState.keywords.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onClick={() => {
                  setFormState((current) => ({
                    ...current,
                    keywords: current.keywords.filter((item) => item !== keyword),
                  }));
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--chip-bg)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[color:var(--chip-text)] transition hover:bg-[rgba(74,124,89,0.18)]"
              >
                <span>{keyword}</span>
                <CloseSmallIcon className="h-3 w-3" />
              </button>
            ))}
          </div>
          <input
            id="keyword-input"
            type="text"
            value={formState.keywordInput}
            placeholder="Add keyword..."
            onBlur={addKeyword}
            onChange={(event) => {
              setFormState((current) => ({
                ...current,
                keywordInput: event.target.value,
              }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addKeyword();
              }
            }}
            className="mt-2 h-10 w-full border border-[color:var(--line-strong)] bg-transparent px-4 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
        </div>
      </div>

      <div className="mt-6 border-t border-[rgba(196,200,188,0.45)] pt-6">
        <div className="space-y-4">
          {optionLabels.map(({ key, label }) => {
            const checked = formState.options[key];

            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 text-sm text-[color:var(--foreground)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      options: {
                        ...current.options,
                        [key]: event.target.checked,
                      },
                    }));
                  }}
                  className="peer sr-only"
                />
                <span
                  className={[
                    "flex h-[18px] w-[18px] items-center justify-center rounded-full border transition",
                    checked
                      ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                      : "border-[color:var(--line-strong)] bg-white text-transparent",
                  ].join(" ")}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="m3.5 8.25 2.5 2.5 6-6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-[color:var(--warning-text)]">
        <div className="flex items-start gap-3">
          <InfoCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-xs leading-6">
            Analysis usually takes 3-5 minutes depending on the volume of text.
            You&apos;ll be notified when the review queue is ready.
          </p>
        </div>
      </div>
    </aside>
  );
}
