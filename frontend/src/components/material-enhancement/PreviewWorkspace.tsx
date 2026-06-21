import { useEffect, useRef, useState } from "react";

import type { Material, PreviewItem } from "@/lib/material-enhancement/workspace";
import {
  formatFileSize,
  getMaterialBaseName,
  getPreviewLabel,
} from "@/lib/material-enhancement/workspace";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "./icons";
import { CenterChatComposer } from "./CenterChatComposer";

type PreviewWorkspaceProps = {
  onNavigate: (direction: "previous" | "next") => void;
  previewItem: PreviewItem | null;
  selectedSourceCount: number;
  selectedMaterial: Material | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export function PreviewWorkspace({
  onNavigate,
  previewItem,
  selectedSourceCount,
  selectedMaterial,
}: PreviewWorkspaceProps) {
  const currentIndex = previewItem?.index ?? 0;
  const totalCount = selectedMaterial?.previewItems.length ?? 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const assistantTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      conversationEndRef.current?.scrollIntoView({
        behavior: messages.length > 1 ? "smooth" : "auto",
        block: "end",
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages]);

  useEffect(() => {
    return () => {
      for (const timerId of assistantTimersRef.current) {
        window.clearTimeout(timerId);
      }
      assistantTimersRef.current = [];
    };
  }, []);

  const handleChatSubmit = (message: string) => {
    const userMessage = createChatMessage("user", message);
    const assistantMessage = createChatMessage(
      "assistant",
      buildAssistantPlaceholderReply({
        message,
        selectedSourceCount,
      }),
    );

    setMessages((currentMessages) => [...currentMessages, userMessage]);

    // TODO: Replace this local placeholder with a real project chat backend response.
    const timerId = window.setTimeout(() => {
      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
      assistantTimersRef.current = assistantTimersRef.current.filter(
        (currentTimerId) => currentTimerId !== timerId,
      );
    }, 220);

    assistantTimersRef.current.push(timerId);
  };

  return (
    <section className="shadow-panel surface-inset relative flex h-full min-w-0 min-h-0 flex-col overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--bg-panel-center)] px-4 pt-4 sm:px-5 xl:px-6 2xl:px-[22px] 2xl:pt-[18px]">
      <div className="relative h-[clamp(260px,40vh,500px)] overflow-hidden rounded-[24px] border border-black/70 bg-[linear-gradient(180deg,rgba(85,66,63,0.9)_0%,rgba(76,61,58,0.96)_100%)] 2xl:h-[clamp(280px,42vh,540px)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_70%)]" />

        <NavigationButton
          direction="previous"
          disabled={!selectedMaterial || currentIndex === 0}
          onClick={() => onNavigate("previous")}
        />
        <NavigationButton
          direction="next"
          disabled={!selectedMaterial || currentIndex >= totalCount - 1}
          onClick={() => onNavigate("next")}
        />

        <div className="absolute inset-x-[8%] top-4 bottom-7 xl:top-5 xl:bottom-8 2xl:inset-x-[9.5%] 2xl:top-[26px] 2xl:bottom-[37px]">
          <div className="shadow-card-soft relative flex h-full items-center justify-center overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-white">
            {selectedMaterial && previewItem ? (
              <PreviewSurface material={selectedMaterial} previewItem={previewItem} />
            ) : (
              <PreviewEmptyState />
            )}
          </div>
        </div>

        <div className="absolute bottom-[11px] left-1/2 max-w-[calc(100%_-_3rem)] -translate-x-1/2 text-center">
          <p className="text-[12.6px] font-semibold text-[color:var(--text-muted)]">
            {selectedMaterial && previewItem
              ? getPreviewLabel(selectedMaterial, previewItem)
              : "Select or upload a file to preview"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col 2xl:mt-4">
        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[13px] text-white/38">
                Ask a question about your materials
              </p>
            </div>
          ) : (
            <div className="flex min-h-full flex-col justify-end gap-3 px-1 py-1">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              <div ref={conversationEndRef} />
            </div>
          )}
        </div>

        <CenterChatComposer
          disabled={selectedSourceCount === 0}
          onSubmit={handleChatSubmit}
          selectedSourceCount={selectedSourceCount}
        />
      </div>
    </section>
  );
}

function NavigationButton({
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
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "previous" ? "Previous preview item" : "Next preview item"}
      className={[
        "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[12px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] text-[color:var(--text-primary)] shadow-[0_18px_45px_0_rgba(0,0,0,0.45)] transition",
        direction === "previous" ? "left-6" : "right-6",
        disabled
          ? "opacity-35"
          : "hover:bg-[rgba(255,255,255,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
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

function PreviewEmptyState() {
  return (
    <div className="flex max-w-[380px] flex-col items-center justify-center px-10 text-center">
      <div className="mb-5 h-24 w-24 rounded-[28px] border border-[rgba(41,37,36,0.08)] bg-[linear-gradient(145deg,rgba(184,219,128,0.16)_0%,rgba(247,246,211,0.28)_100%)]" />
      <h3 className="text-[26px] font-bold tracking-[-0.05em] text-[#292524]">
        Preview ready
      </h3>
      <p className="mt-3 text-[14px] leading-[23px] text-[#78716c]">
        Upload a file from the Materials panel to activate the preview stage, navigation controls, and chat composer.
      </p>
    </div>
  );
}

function PreviewSurface({
  material,
  previewItem,
}: {
  material: Material;
  previewItem: PreviewItem;
}) {
  if (previewItem.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewItem.imageUrl}
        alt={`${material.name} preview`}
        className="h-full w-full object-contain bg-[#fcfbfa]"
      />
    );
  }

  if (previewItem.placeholderLayout === "document") {
    return <DocumentPlaceholder material={material} previewItem={previewItem} />;
  }

  if (previewItem.placeholderLayout === "outline") {
    return <OutlinePlaceholder material={material} previewItem={previewItem} />;
  }

  return <DiagramPlaceholder material={material} previewItem={previewItem} />;
}

function DiagramPlaceholder({
  material,
  previewItem,
}: {
  material: Material;
  previewItem: PreviewItem;
}) {
  return (
    <div className="relative flex h-full w-full flex-col px-[50px] py-[44px]">
      <h3 className="mt-2 text-center text-[27px] font-bold tracking-[-0.05em] text-[#292524]">
        {getMaterialBaseName(material.name)}
      </h3>
      <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#7a9d3e]">
        {previewItem.label}
      </p>

      <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-center gap-8">
        <div className="space-y-3">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#a8a29e]">
            Left column
          </p>
          <PlaceholderPill tone="neutral" />
          <PlaceholderPill tone="neutral" />
          <PlaceholderPill tone="neutral" />
        </div>
        <div className="space-y-3">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#7a9d3e]">
            Focus
          </p>
          <PlaceholderPill tone="green" />
          <PlaceholderPill tone="green" />
          <PlaceholderPill tone="green" />
          <PlaceholderPill tone="green" />
        </div>
        <div className="space-y-3">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#a8a29e]">
            Output
          </p>
          <PlaceholderPill tone="neutral" />
          <PlaceholderPill tone="neutral" />
          <PlaceholderPill tone="neutral" />
        </div>
      </div>

      <p className="mt-auto text-center text-[12px] text-[#a8a29e]">
        Structured presentation placeholder while slide parsing is added
      </p>
    </div>
  );
}

function DocumentPlaceholder({
  material,
  previewItem,
}: {
  material: Material;
  previewItem: PreviewItem;
}) {
  return (
    <div className="flex h-full w-full flex-col px-[54px] py-[48px]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a8a29e]">
            {previewItem.label}
          </p>
          <h3 className="mt-2 text-[25px] font-bold tracking-[-0.05em] text-[#292524]">
            {getMaterialBaseName(material.name)}
          </h3>
        </div>
        <div className="rounded-full bg-[rgba(184,219,128,0.18)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a9d3e]">
          {formatFileSize(material.size)}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <PlaceholderLine width="92%" />
        <PlaceholderLine width="100%" />
        <PlaceholderLine width="84%" />
      </div>

      <div className="mt-9 rounded-[18px] border border-[#e7e5e4] bg-[#faf9f8] p-5">
        <div className="space-y-3">
          <PlaceholderLine width="72%" />
          <PlaceholderLine width="94%" />
          <PlaceholderLine width="88%" />
          <PlaceholderLine width="79%" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-[18px] border border-[#e7e5e4] bg-[#faf9f8] p-4">
          <PlaceholderLine width="72%" />
          <div className="mt-3 space-y-2">
            <PlaceholderLine width="92%" />
            <PlaceholderLine width="70%" />
          </div>
        </div>
        <div className="rounded-[18px] border border-[#e7e5e4] bg-[#faf9f8] p-4">
          <PlaceholderLine width="64%" />
          <div className="mt-3 space-y-2">
            <PlaceholderLine width="88%" />
            <PlaceholderLine width="76%" />
          </div>
        </div>
      </div>
    </div>
  );
}

function OutlinePlaceholder({
  material,
  previewItem,
}: {
  material: Material;
  previewItem: PreviewItem;
}) {
  return (
    <div className="flex h-full w-full flex-col px-[52px] py-[46px]">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a8a29e]">
        {previewItem.label}
      </p>
      <h3 className="mt-2 text-[26px] font-bold tracking-[-0.05em] text-[#292524]">
        {getMaterialBaseName(material.name)}
      </h3>

      <div className="mt-9 grid grid-cols-[220px_1fr] gap-6">
        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#faf9f8] p-4">
          <div className="space-y-3">
            <div className="rounded-[14px] bg-[rgba(184,219,128,0.16)] px-3 py-3">
              <PlaceholderLine width="78%" />
            </div>
            <div className="rounded-[14px] bg-[#f5f5f4] px-3 py-3">
              <PlaceholderLine width="62%" />
            </div>
            <div className="rounded-[14px] bg-[#f5f5f4] px-3 py-3">
              <PlaceholderLine width="70%" />
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#faf9f8] p-5">
          <PlaceholderLine width="54%" />
          <div className="mt-5 space-y-3">
            <PlaceholderLine width="94%" />
            <PlaceholderLine width="88%" />
            <PlaceholderLine width="96%" />
            <PlaceholderLine width="78%" />
          </div>

          <div className="mt-6 rounded-[16px] border border-[#e7e5e4] bg-white p-4">
            <PlaceholderLine width="66%" />
            <div className="mt-3 space-y-2">
              <PlaceholderLine width="92%" />
              <PlaceholderLine width="74%" />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-auto text-center text-[12px] text-[#a8a29e]">
        Structured document placeholder while real section parsing is added
      </p>
    </div>
  );
}

function PlaceholderPill({ tone }: { tone: "neutral" | "green" }) {
  return (
    <div
      className={[
        "h-9 rounded-full border",
        tone === "green"
          ? "border-[rgba(184,219,128,0.3)] bg-[rgba(184,219,128,0.2)]"
          : "border-[#e7e5e4] bg-[#f5f5f4]",
      ].join(" ")}
    />
  );
}

function PlaceholderLine({ width }: { width: string }) {
  return <div className="h-3 rounded-full bg-[#ece8e6]" style={{ width }} />;
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "animate-center-chat-message-enter flex w-full",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <article
        className={[
          "overflow-hidden rounded-[22px] border px-5 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
          isUser
            ? "max-w-[72%] border-white/[0.08] bg-[#2A2F38] text-white"
            : "max-w-[78%] border-white/[0.08] bg-[#242830] text-white",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap text-[14.5px] leading-[1.7]">
          {message.content}
        </p>
      </article>
    </div>
  );
}

function buildAssistantPlaceholderReply({
  message,
  selectedSourceCount,
}: {
  message: string;
  selectedSourceCount: number;
}) {
  const normalizedMessage = message.trim();

  return [
    `I'm ready to help with ${selectedSourceCount} selected source${selectedSourceCount === 1 ? "" : "s"}.`,
    "This is a local placeholder response while chat backend integration is still pending.",
    normalizedMessage
      ? `Your latest prompt was: "${normalizedMessage}"`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function createChatMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return {
    id: createMessageId(),
    role,
    content,
    timestamp: Date.now(),
  };
}

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}
