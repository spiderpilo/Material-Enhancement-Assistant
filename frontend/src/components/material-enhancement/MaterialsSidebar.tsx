import type { ChangeEvent, DragEvent, RefObject } from "react";

import type { Material, PreviewItem } from "@/lib/material-enhancement/workspace";
import {
  SUPPORTED_FILE_TYPE_LABEL,
  getMaterialMeta,
} from "@/lib/material-enhancement/workspace";

import {
  AddIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileIcon,
  ImageFileIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  UploadCloudIcon,
} from "./icons";

type MaterialsSidebarProps = {
  checkedMaterialIds: string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  isCollapsed: boolean;
  isDragging: boolean;
  materials: Material[];
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenFilePicker: () => void;
  onSelectMaterial: (materialId: string) => void;
  onSelectPreviewItem: (materialId: string, previewItemId: string) => void;
  onToggleCollapsed: () => void;
  onToggleMaterialChecked: (materialId: string) => void;
  selectedMaterialId: string | null;
  selectedPreviewItemId: string | null;
};

export function MaterialsSidebar({
  checkedMaterialIds,
  fileInputRef,
  isCollapsed,
  isDragging,
  materials,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileInputChange,
  onOpenFilePicker,
  onSelectMaterial,
  onSelectPreviewItem,
  onToggleCollapsed,
  onToggleMaterialChecked,
  selectedMaterialId,
  selectedPreviewItemId,
}: MaterialsSidebarProps) {
  const checkedMaterialIdSet = new Set(checkedMaterialIds);
  const basePanelClass =
    "shadow-panel relative flex h-[949px] min-h-[949px] flex-col overflow-hidden rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--bg-panel-left)] backdrop-blur-[12px]";

  if (isCollapsed) {
    return (
      <aside
        className={[
          basePanelClass,
          "items-center px-3 py-4",
          isDragging
            ? "bg-[rgba(184,219,128,0.1)] shadow-[0_0_0_1px_rgba(184,219,128,0.26),0_18px_45px_rgba(0,0,0,0.42)]"
            : "",
        ].join(" ")}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={SUPPORTED_FILE_TYPE_LABEL}
          onChange={onFileInputChange}
        />

        <div className="flex w-full flex-col items-center gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] text-[color:var(--accent-cream)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
            aria-label="Expand materials sidebar"
          >
            <PanelExpandIcon className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            onClick={onOpenFilePicker}
            className="shadow-card-soft flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:var(--accent-green)] text-[#1c1917] transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-app-alt)]"
            aria-label="Add materials"
          >
            <AddIcon className="h-[18px] w-[18px]" />
          </button>

          <div className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">
            {materials.length}
          </div>
        </div>

        <div className="mt-5 flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-y-auto">
          {materials.length === 0 ? (
            <div className="mb-auto mt-auto flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[color:var(--accent-green)]">
                <UploadCloudIcon className="h-5 w-5" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">
                Drop files
              </p>
            </div>
          ) : (
            materials.map((material) => {
              const isSelected = material.id === selectedMaterialId;
              const isChecked = checkedMaterialIdSet.has(material.id);

              return (
                <button
                  key={material.id}
                  type="button"
                  title={material.name}
                  onClick={() => onSelectMaterial(material.id)}
                  className={[
                    "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border transition",
                    isSelected
                      ? "border-[rgba(184,219,128,0.38)] bg-[rgba(255,255,255,0.1)] text-[color:var(--accent-pink)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] text-[color:var(--text-secondary)] hover:bg-[rgba(255,255,255,0.07)]",
                  ].join(" ")}
                >
                  {material.kind === "image" ? (
                    <ImageFileIcon className="h-[18px] w-[18px]" />
                  ) : (
                    <FileIcon className="h-[18px] w-[18px]" />
                  )}

                  {isChecked ? (
                    <span className="absolute bottom-[5px] right-[5px] h-2.5 w-2.5 rounded-full bg-[color:var(--accent-green)] shadow-[0_0_0_2px_rgba(28,25,23,0.95)]" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={[basePanelClass, "px-4 pb-4 pt-5"].join(" ")}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold tracking-[-0.045em] text-[color:var(--text-primary)]">
          Materials
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilePicker}
            className="shadow-card-soft inline-flex h-9 items-center gap-2 rounded-[12px] bg-[color:var(--accent-green)] px-4 text-[12.7px] font-bold text-[#1c1917] transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-app-alt)]"
          >
            <AddIcon className="h-[18px] w-[18px]" />
            Add Materials
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] text-[color:var(--accent-cream)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
            aria-label="Collapse materials sidebar"
          >
            <PanelCollapseIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={SUPPORTED_FILE_TYPE_LABEL}
        onChange={onFileInputChange}
      />

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {materials.length === 0 ? (
          <EmptyMaterialsState isDragging={isDragging} onOpenFilePicker={onOpenFilePicker} />
        ) : (
          <div className="space-y-3">
            {materials.map((material) => {
              const isSelected = material.id === selectedMaterialId;
              const isChecked = checkedMaterialIdSet.has(material.id);
              const showsExpansionToggle = material.kind !== "image";
              const showsNestedItems = isSelected && material.kind !== "image";

              return (
                <article
                  key={material.id}
                  className={[
                    "surface-inset relative overflow-hidden rounded-[20px] border border-[color:var(--border-soft)] transition",
                    isSelected
                      ? "bg-[rgba(255,255,255,0.05)] shadow-[0_18px_45px_0_rgba(0,0,0,0.35)]"
                      : "bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.06)]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectMaterial(material.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] text-[color:var(--accent-pink)]">
                        {material.kind === "image" ? (
                          <ImageFileIcon className="h-[18px] w-[18px]" />
                        ) : (
                          <FileIcon className="h-[18px] w-[18px]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.9px] font-bold leading-5 text-[color:var(--text-primary)]">
                          {material.name}
                        </p>
                        <p className="mt-[1px] text-[9.8px] text-[color:var(--text-muted)]">
                          {getMaterialMeta(material, isSelected)}
                        </p>
                      </div>
                    </button>

                    {showsExpansionToggle ? (
                      <button
                        type="button"
                        onClick={() => onSelectMaterial(material.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(255,255,255,0.05)] text-[color:var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
                        aria-label={isSelected ? "Collapse material previews" : "Expand material previews"}
                      >
                        {isSelected ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}

                    <MaterialCheckbox
                      checked={isChecked}
                      label={`Include ${material.name} in AI tools`}
                      onToggle={() => onToggleMaterialChecked(material.id)}
                    />
                  </div>

                  {showsNestedItems ? (
                    <div className="space-y-2 px-3 pb-3">
                      {material.previewItems.map((previewItem) => (
                        <PreviewRow
                          key={previewItem.id}
                          material={material}
                          previewItem={previewItem}
                          selected={previewItem.id === selectedPreviewItemId}
                          onClick={() => onSelectPreviewItem(material.id, previewItem.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function EmptyMaterialsState({
  isDragging,
  onOpenFilePicker,
}: {
  isDragging: boolean;
  onOpenFilePicker: () => void;
}) {
  return (
    <div
      className={[
        "surface-inset flex min-h-[318px] flex-col items-center justify-center rounded-[24px] border border-[color:var(--border-soft)] px-6 py-8 text-center transition",
        isDragging
          ? "bg-[rgba(184,219,128,0.12)] shadow-[0_0_0_1px_rgba(184,219,128,0.35),0_18px_45px_0_rgba(0,0,0,0.4)]"
          : "bg-[rgba(255,255,255,0.04)]",
      ].join(" ")}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] text-[color:var(--accent-green)]">
        <UploadCloudIcon className="h-6 w-6" />
      </div>

      <h3 className="text-[16px] font-bold tracking-[-0.04em] text-[color:var(--text-primary)]">
        No materials uploaded yet
      </h3>
      <p className="mt-2 max-w-[220px] text-[13px] leading-[22px] text-[color:var(--text-secondary)]">
        Upload slides, documents, or images to begin previewing and reviewing AI guidance.
      </p>

      <button
        type="button"
        onClick={onOpenFilePicker}
        className="mt-6 inline-flex h-10 items-center rounded-[12px] border border-[color:var(--border-soft)] bg-[rgba(255,255,255,0.05)] px-4 text-[12.5px] font-semibold text-[color:var(--text-primary)] transition hover:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]"
      >
        Choose files
      </button>

      <p className="mt-5 max-w-[230px] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">
        Supported: {SUPPORTED_FILE_TYPE_LABEL}
      </p>
    </div>
  );
}

function MaterialCheckbox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={[
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-green)]",
        checked
          ? "border-[rgba(184,219,128,0.45)] bg-[rgba(184,219,128,0.18)] text-[color:var(--accent-green)]"
          : "border-[rgba(255,255,255,0.34)] bg-transparent text-transparent hover:border-[rgba(255,255,255,0.5)]",
      ].join(" ")}
    >
      <CheckIcon className="h-[12px] w-[12px]" />
    </button>
  );
}

function PreviewRow({
  material,
  onClick,
  previewItem,
  selected,
}: {
  material: Material;
  onClick: () => void;
  previewItem: PreviewItem;
  selected: boolean;
}) {
  const thumbnailClass =
    material.kind === "ppt"
      ? "bg-[linear-gradient(149deg,rgba(184,219,128,0.1)_0%,rgba(184,219,128,0.2)_100%)]"
      : material.kind === "pdf"
        ? "bg-[linear-gradient(145deg,rgba(255,246,192,0.1)_0%,rgba(255,255,255,0.04)_100%)]"
        : material.kind === "doc"
          ? "bg-[linear-gradient(145deg,rgba(243,158,182,0.08)_0%,rgba(255,255,255,0.03)_100%)]"
          : "bg-[linear-gradient(145deg,rgba(184,219,128,0.18)_0%,rgba(255,255,255,0.05)_100%)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition",
        selected
          ? "bg-[rgba(255,255,255,0.1)] shadow-[0_0_0_1px_rgba(184,219,128,0.4),0_18px_45px_0_rgba(0,0,0,0.35)]"
          : "hover:bg-[rgba(255,255,255,0.06)]",
      ].join(" ")}
    >
      <div
        className={[
          "h-[50px] w-[84px] shrink-0 overflow-hidden rounded-[8px] border border-[color:var(--border-soft)] bg-[color:var(--bg-app-deep)]",
          thumbnailClass,
        ].join(" ")}
      >
        {previewItem.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewItem.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[12.8px] font-bold leading-5 text-[color:var(--text-primary)]">
          {previewItem.label}
        </p>
        <p className="mt-[1px] truncate text-[10px] text-[color:var(--text-muted)]">
          {previewItem.title}
        </p>
      </div>
    </button>
  );
}
