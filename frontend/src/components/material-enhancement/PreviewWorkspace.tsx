import type { Material, PreviewItem, Recommendation } from "@/lib/material-enhancement/workspace";
import {
  formatFileSize,
  getMaterialBaseName,
  getPreviewLabel,
} from "@/lib/material-enhancement/workspace";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClarityIcon,
  InteractionIcon,
  VisualsIcon,
} from "./icons";

type PreviewWorkspaceProps = {
  onApplyRecommendation: (recommendationId: Recommendation["id"]) => void;
  onNavigate: (direction: "previous" | "next") => void;
  previewItem: PreviewItem | null;
  recommendations: Recommendation[];
  selectedMaterial: Material | null;
};

export function PreviewWorkspace({
  onApplyRecommendation,
  onNavigate,
  previewItem,
  recommendations,
  selectedMaterial,
}: PreviewWorkspaceProps) {
  const currentIndex = previewItem?.index ?? 0;
  const totalCount = selectedMaterial?.previewItems.length ?? 0;

  return (
    <section className="shadow-panel surface-inset relative flex h-[949px] min-h-[949px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--bg-panel-center)] px-[22px] pt-[18px]">
      <div className="relative h-[562px] overflow-hidden rounded-[24px] border border-black/70 bg-[linear-gradient(180deg,rgba(85,66,63,0.9)_0%,rgba(76,61,58,0.96)_100%)]">
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

        <div className="absolute inset-x-[9.5%] top-[26px] bottom-[37px]">
          <div className="shadow-card-soft relative flex h-full items-center justify-center overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-white">
            {selectedMaterial && previewItem ? (
              <PreviewSurface material={selectedMaterial} previewItem={previewItem} />
            ) : (
              <PreviewEmptyState />
            )}
          </div>
        </div>

        <div className="absolute bottom-[11px] left-1/2 -translate-x-1/2 text-center">
          <p className="text-[12.6px] font-semibold text-[color:var(--text-muted)]">
            {selectedMaterial && previewItem
              ? getPreviewLabel(selectedMaterial, previewItem)
              : "Select or upload a file to preview"}
          </p>
        </div>
      </div>

      <div className="mt-[24px] flex items-center justify-between gap-4">
        <h2 className="text-[17.7px] font-bold tracking-[-0.05em] text-[color:var(--text-primary)]">
          AI Recommendations
        </h2>

        <div className="flex h-6 items-center rounded-full bg-[rgba(255,255,255,0.05)] px-3 text-[11px] font-medium text-[color:var(--text-muted)]">
          Suggestions are supportive &amp; optional.
        </div>
      </div>

      <div className="mt-[13px] grid grid-cols-3 gap-3 pb-4">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            onApply={() => onApplyRecommendation(recommendation.id)}
          />
        ))}
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
        "absolute top-[241px] z-10 flex h-10 w-10 items-center justify-center rounded-[12px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] text-[color:var(--text-primary)] shadow-[0_18px_45px_0_rgba(0,0,0,0.45)] transition",
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
        Upload a file from the Materials panel to activate the preview stage, navigation controls, and recommendations.
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

function RecommendationCard({
  onApply,
  recommendation,
}: {
  onApply: () => void;
  recommendation: Recommendation;
}) {
  const accentClass =
    recommendation.accent === "green"
      ? "text-[color:var(--accent-green)] bg-[rgba(184,219,128,0.1)]"
      : recommendation.accent === "pink"
        ? "text-[color:var(--accent-pink)] bg-[rgba(243,158,182,0.1)]"
        : "text-[color:var(--accent-cream)] bg-[rgba(247,246,211,0.12)]";

  return (
    <article
      className={[
        "surface-inset relative flex min-h-[284px] flex-col rounded-[24px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] px-6 pb-[17px] pt-[17px]",
        recommendation.disabled ? "opacity-65" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className={["flex h-10 w-10 items-center justify-center rounded-[16px]", accentClass].join(" ")}>
          {recommendation.id === "clarity" ? (
            <ClarityIcon className="h-5 w-5" />
          ) : recommendation.id === "visuals" ? (
            <VisualsIcon className="h-5 w-5" />
          ) : (
            <InteractionIcon className="h-5 w-5" />
          )}
        </div>

        <div>
          <h3 className="text-[16px] font-bold text-[color:var(--accent-cream)]">
            {recommendation.title}
          </h3>
          <p className="mt-[2px] text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-subtle)]">
            {recommendation.label}
          </p>
        </div>
      </div>

      <p className="mt-6 flex-1 text-[13.8px] leading-[22.75px] text-[color:var(--text-secondary)]">
        {recommendation.description}
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onApply}
          disabled={recommendation.disabled}
          className={[
            "shadow-card-soft inline-flex h-10 min-w-[86px] items-center justify-center gap-2 rounded-[12px] px-5 text-[12.7px] font-bold transition",
            recommendation.disabled
              ? "bg-[rgba(255,255,255,0.08)] text-[color:var(--text-muted)]"
              : recommendation.applied
                ? "bg-[rgba(184,219,128,0.25)] text-[color:var(--accent-green)]"
                : "bg-[rgba(184,219,128,0.9)] text-[#1c1917] hover:brightness-[1.03]",
          ].join(" ")}
        >
          <CheckIcon className="h-[18px] w-[18px]" />
          {recommendation.applied ? "Applied" : "Apply"}
        </button>
      </div>
    </article>
  );
}
