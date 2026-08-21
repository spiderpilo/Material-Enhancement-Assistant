import { useEffect, useRef, useState } from "react";

import type { Material, PreviewItem } from "@/lib/material-enhancement/workspace";
import {
  formatFileSize,
  getMaterialBaseName,
  getPreviewLabel,
} from "@/lib/material-enhancement/workspace";
import {
  askProjectQuestion,
  clearProjectChatHistory,
  getProjectChatHistory,
  type ProjectChatMessage,
  type ProjectChatSelectionMode,
  type ProjectChatSource,
} from "@/lib/api/projects";
import { getStoredAccessToken } from "@/lib/api/auth";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
} from "./icons";
import { CenterChatComposer } from "./CenterChatComposer";

type PreviewWorkspaceProps = {
  onNavigate: (direction: "previous" | "next") => void;
  projectName: string;
  projectUuid: string;
  previewItem: PreviewItem | null;
  selectedSourceIds: number[];
  selectedSourceCount: number;
  selectedMaterial: Material | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: ProjectChatSource[];
  isLoading?: boolean;
  selectionMode?: ProjectChatSelectionMode | null;
};

export function PreviewWorkspace({
  onNavigate,
  projectName,
  projectUuid,
  previewItem,
  selectedSourceIds,
  selectedSourceCount,
  selectedMaterial,
}: PreviewWorkspaceProps) {
  const currentIndex = previewItem?.index ?? 0;
  const totalCount = selectedMaterial?.previewItems.length ?? 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [isChatMemoryLoading, setIsChatMemoryLoading] = useState(true);
  const [chatMemoryError, setChatMemoryError] = useState<string | null>(null);
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false);
  const [isResettingConversation, setIsResettingConversation] = useState(false);
  const [resetConversationError, setResetConversationError] = useState<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;
    const accessToken = getStoredAccessToken();

    setMessages([]);
    setChatMemoryError(null);
    setIsChatMemoryLoading(true);

    if (!accessToken) {
      setChatMemoryError("Sign in to load chat memory.");
      setIsChatMemoryLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    void getProjectChatHistory({ accessToken, projectUuid })
      .then((history) => {
        if (!isCancelled) {
          setMessages(history.messages.map(toChatMessage));
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setChatMemoryError(
            error instanceof Error ? error.message : "Unable to load chat memory.",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsChatMemoryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [projectUuid]);

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

  const handleChatSubmit = async (message: string) => {
    const userMessage = createChatMessage("user", message);
    const assistantMessageId = createMessageId();

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Reading the best-matching document...",
        timestamp: new Date().toISOString(),
        isLoading: true,
      },
    ]);

    setIsChatSubmitting(true);

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setMessages((currentMessages) =>
        currentMessages.filter(
          (messageItem) =>
            messageItem.id !== userMessage.id &&
            messageItem.id !== assistantMessageId,
        ),
      );
      setChatMemoryError("Sign in to use the document assistant.");
      setIsChatSubmitting(false);
      return;
    }

    try {
      const response = await askProjectQuestion({
        accessToken,
        projectUuid,
        message,
        selectedMaterialId: selectedSourceIds.length === 1 ? selectedSourceIds[0] : null,
        selectedMaterialIds: selectedSourceIds,
      });

      setMessages(response.messages.map(toChatMessage));
      setChatMemoryError(null);
    } catch (error) {
      setMessages((currentMessages) =>
        currentMessages.filter(
          (messageItem) =>
            messageItem.id !== userMessage.id &&
            messageItem.id !== assistantMessageId,
        ),
      );
      setChatMemoryError(
        error instanceof Error
          ? error.message
          : "Unable to answer from the current project documents.",
      );
    } finally {
      setIsChatSubmitting(false);
    }
  };

  const handleStartNewConversation = async (saveJsonFirst: boolean) => {
    if (isResettingConversation) {
      return;
    }

    if (saveJsonFirst) {
      downloadConversationJson({
        messages,
        projectName,
        projectUuid,
      });
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setResetConversationError("Sign in before starting a new conversation.");
      return;
    }

    setIsResettingConversation(true);
    setResetConversationError(null);

    try {
      await clearProjectChatHistory({ accessToken, projectUuid });
      setMessages([]);
      setChatMemoryError(null);
      setIsNewConversationModalOpen(false);
    } catch (error) {
      setResetConversationError(
        error instanceof Error ? error.message : "Unable to start a new conversation.",
      );
    } finally {
      setIsResettingConversation(false);
    }
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

        <div className="absolute inset-x-[clamp(4rem,9%,5.25rem)] top-3 bottom-7 xl:top-4 xl:bottom-8 2xl:top-[22px] 2xl:bottom-[37px]">
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
        <div className="flex min-h-8 shrink-0 items-center justify-between gap-3 px-1 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/38">
            Conversation
          </p>
          {messages.length > 0 ? (
            <button
              type="button"
              disabled={isChatSubmitting || isChatMemoryLoading}
              onClick={() => {
                setResetConversationError(null);
                setIsNewConversationModalOpen(true);
              }}
              className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-semibold text-white/64 transition hover:bg-white/[0.07] hover:text-white/82 disabled:cursor-not-allowed disabled:opacity-40"
            >
              New conversation
            </button>
          ) : null}
        </div>
        {chatMemoryError ? (
          <p className="mx-1 mb-1 rounded-[10px] border border-[rgba(255,170,184,0.16)] bg-[rgba(255,170,184,0.06)] px-3 py-2 text-[11.5px] text-[#ffc8d3]">
            {chatMemoryError}
          </p>
        ) : null}

        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto pr-1">
          {isChatMemoryLoading ? (
            <div className="flex h-full items-center justify-center px-4 text-center">
              <p className="text-[13px] text-white/38">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
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
          disabled={
            selectedSourceCount === 0 ||
            isChatSubmitting ||
            isChatMemoryLoading ||
            isResettingConversation
          }
          onSubmit={handleChatSubmit}
          selectedSourceCount={selectedSourceCount}
        />
      </div>

      <NewConversationModal
        errorMessage={resetConversationError}
        isOpen={isNewConversationModalOpen}
        isResetting={isResettingConversation}
        onCancel={() => {
          if (!isResettingConversation) {
            setIsNewConversationModalOpen(false);
            setResetConversationError(null);
          }
        }}
        onSaveAndStart={() => {
          void handleStartNewConversation(true);
        }}
        onStartWithoutSaving={() => {
          void handleStartNewConversation(false);
        }}
      />
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
        direction === "previous"
          ? "left-[clamp(0.75rem,2vw,1.5rem)]"
          : "right-[clamp(0.75rem,2vw,1.5rem)]",
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
    <div className="flex w-full max-w-[400px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 h-14 w-14 rounded-[18px] border border-[rgba(41,37,36,0.08)] bg-[linear-gradient(145deg,rgba(184,219,128,0.16)_0%,rgba(247,246,211,0.28)_100%)]" />

      <h3 className="text-[18px] font-semibold tracking-[-0.04em] text-[#292524]">
        Preview ready
      </h3>

      <p className="mt-2 max-w-[32ch] text-[12px] leading-[18px] text-[#78716c]">
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
    const shouldBoostFit = previewItem.kind === "slide" || previewItem.kind === "page";

    return (
      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[#fcfbfa]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewItem.imageUrl}
          alt={`${material.name} preview`}
          className={[
            "h-full w-full object-contain transition-transform duration-200 ease-out",
            shouldBoostFit ? "scale-[1.05] xl:scale-[1.08] 2xl:scale-[1.06]" : "",
          ].join(" ")}
        />
      </div>
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
        {message.sources && message.sources.length > 0 ? (
          <p className="mt-3 text-[11.5px] leading-5 text-white/58">
            {message.selectionMode ? `${getSelectionModeLabel(message.selectionMode)} - ` : ""}
            Sources: {message.sources.map(formatChatSourceLabel).join(", ")}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function getSelectionModeLabel(selectionMode: NonNullable<ChatMessage["selectionMode"]>) {
  switch (selectionMode) {
    case "rag":
      return "Project sources";
    case "rag_selected":
      return "Selected sources";
    case "rag_unavailable":
      return "Indexed sources unavailable";
    case "selected":
      return "Selected document";
    case "title_match":
      return "Matched by title";
    case "fallback":
      return "Fallback document";
  }
}

function formatChatSourceLabel(source: ProjectChatSource): string {
  const locations = Array.isArray(source.locations)
    ? source.locations.filter((location) => location.trim().length > 0)
    : [];

  if (locations.length === 0) {
    return source.material_name;
  }

  return `${source.material_name} (${locations.join(", ")})`;
}

function NewConversationModal({
  errorMessage,
  isOpen,
  isResetting,
  onCancel,
  onSaveAndStart,
  onStartWithoutSaving,
}: {
  errorMessage: string | null;
  isOpen: boolean;
  isResetting: boolean;
  onCancel: () => void;
  onSaveAndStart: () => void;
  onStartWithoutSaving: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        className="relative w-full max-w-[480px] rounded-[24px] border border-white/[0.12] bg-[#24211f] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.58)]"
      >
        <button
          type="button"
          disabled={isResetting}
          onClick={onCancel}
          aria-label="Close new conversation dialog"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[20px] leading-none text-white/55 transition hover:bg-white/[0.08] hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden="true">×</span>
        </button>

        <h2
          id="new-conversation-title"
          className="pr-10 text-[20px] font-semibold tracking-[-0.03em] text-white"
        >
          Start a new conversation?
        </h2>
        <p className="mt-3 text-[13.5px] leading-6 text-white/62">
          This permanently clears the current server copy. Save the conversation as
          JSON first if you want to keep it.
        </p>

        {errorMessage ? (
          <p className="mt-3 rounded-[12px] border border-[rgba(255,170,184,0.22)] bg-[rgba(255,170,184,0.08)] px-3 py-2 text-[12.5px] text-[#ffc8d3]">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isResetting}
            onClick={onStartWithoutSaving}
            className="h-10 rounded-[12px] border border-[rgba(255,170,184,0.26)] bg-[rgba(255,170,184,0.09)] px-4 text-[12.5px] font-semibold text-[#ffc8d3] transition hover:bg-[rgba(255,170,184,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start without saving
          </button>
          <button
            type="button"
            disabled={isResetting}
            onClick={onSaveAndStart}
            className="h-10 rounded-[12px] bg-[#FFAAB8] px-4 text-[12.5px] font-bold text-[#1c1917] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResetting ? "Starting..." : "Save JSON & start"}
          </button>
        </div>
      </div>
    </div>
  );
}

function createChatMessage(
  role: ChatMessage["role"],
  content: string,
): ChatMessage {
  return {
    id: createMessageId(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function toChatMessage(message: ProjectChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    sources: message.sources,
    selectionMode: message.selection_mode,
  };
}

function downloadConversationJson({
  messages,
  projectName,
  projectUuid,
}: {
  messages: ChatMessage[];
  projectName: string;
  projectUuid: string;
}) {
  const payload = {
    schema_version: 1,
    project_uuid: projectUuid,
    project_name: projectName || "Untitled project",
    exported_at: new Date().toISOString(),
    messages: messages
      .filter((message) => !message.isLoading)
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        sources: message.sources ?? [],
        selection_mode: message.selectionMode ?? null,
      })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  const safeProjectName =
    (projectName || "project")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "project";
  const exportDate = new Date().toISOString().replace(/[:.]/g, "-");

  downloadLink.href = objectUrl;
  downloadLink.download = `${safeProjectName}-conversation-${exportDate}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(objectUrl);
}

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}
