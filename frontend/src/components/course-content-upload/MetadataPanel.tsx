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
    <aside className="rounded-3xl bg-(--panel) p-6 shadow-(--shadow-soft)">
      <h2 className="text-[1.75rem] font-semibold tracking-[-0.04em] text-foreground">
        Metadata Context
      </h2>

      <div className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="course-name"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted-strong)"
          >
            Course Name
          </label>
          <div className="relative mt-2">
            <CourseStackIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)" />
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
              className="h-12 w-full rounded-2xl border border-(--line-strong) bg-white pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="lecture-title"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted-strong)"
          >
            Lecture Title
          </label>
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-(--muted)">
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
              className="h-12 w-full rounded-2xl border border-(--line-strong) bg-white pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-(--muted) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="week"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted-strong)"
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
                className="h-12 w-full appearance-none rounded-2xl border border-(--line-strong) bg-white px-4 pr-10 text-sm text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)"
              >
                {weekOptions.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)" />
            </div>
          </div>

          <div>
            <label
              htmlFor="topic"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted-strong)"
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
                className="h-12 w-full appearance-none rounded-2xl border border-(--line-strong) bg-white px-4 pr-10 text-sm text-foreground outline-none transition focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)"
              >
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--muted)" />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="keyword-input"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted-strong)"
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
                className="inline-flex items-center gap-1 rounded-lg bg-(--chip-bg) px-2.5 py-1 text-[0.6875rem] font-semibold text-(--chip-text) transition hover:bg-(rgba(74,124,89,0.18))"
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
            className="mt-2 h-10 w-full border border-(--line-strong) bg-transparent px-4 text-sm text-foreground outline-none transition placeholder:text-(--muted) focus:border-(--accent) focus:ring-2 focus:ring-(--accent-soft)"
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
                className="flex cursor-pointer items-center gap-3 text-sm text-foreground"
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
                    "flex h-4.5 w-4.5 items-center justify-center rounded-full border transition",
                    checked
                      ? "border-(--accent) bg-(--accent) text-white"
                      : "border-(--line-strong) bg-white text-transparent",
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

      <div className="mt-6 rounded-2xl border border-(--warning-border) bg-(--warning-bg) px-4 py-3 text-(--warning-text)">
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
