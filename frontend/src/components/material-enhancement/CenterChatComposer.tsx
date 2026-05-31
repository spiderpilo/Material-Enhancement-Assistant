"use client";

import { useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import { ArrowUpIcon } from "./icons";

type CenterChatComposerProps = {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void> | void;
  selectedSourceCount: number;
};

export function CenterChatComposer({
  disabled = false,
  onSubmit,
  selectedSourceCount,
}: CenterChatComposerProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaId = useId();

  const isSubmitDisabled =
    disabled || message.trim().length === 0 || isSubmitting;

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const nextMessage = message.trim();
    if (!nextMessage || disabled || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(nextMessage);
      setMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="animate-center-composer-enter mx-auto w-[calc(100%+10px)] max-w-none shrink-0 pb-6 pt-3"
    >
      <div className="flex min-h-[78px] items-center gap-4 rounded-[20px] border border-white/[0.08] bg-[#1F232A] px-5 py-[18px] shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-white/[0.1] focus-within:border-white/[0.14] focus-within:shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
        <label htmlFor={textareaId} className="flex flex-1 items-center">
          <span className="sr-only">Ask a question or create something</span>
          <textarea
            id={textareaId}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask a question or create something"
            spellCheck={false}
            className="studio-scroll h-7 max-h-24 w-full resize-none bg-transparent pt-[1px] text-[16px] leading-7 text-white outline-none placeholder:text-white/42"
          />
        </label>

        <div className="flex shrink-0 items-center gap-3">
          <p className="min-w-[74px] text-right text-[13px] text-white/64">
            {selectedSourceCount} source
            {selectedSourceCount === 1 ? "" : "s"}
          </p>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            aria-label="Send prompt"
            className={[
              "group inline-flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05] text-white shadow-[0_8px_18px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,opacity,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
              isSubmitDisabled
                ? "opacity-40"
                : "hover:scale-[1.03] hover:border-white/[0.12] hover:bg-white/[0.10] hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)] active:scale-[0.96]",
            ].join(" ")}
          >
            <ArrowUpIcon className="h-10 w-10 transition-transform duration-200 ease-out group-hover:-translate-y-px group-hover:translate-x-px" />
          </button>
        </div>
      </div>
    </form>
  );
}
