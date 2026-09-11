"use client";

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/crop-image";
import { useLanguage } from "@/components/language-provider";
import "react-easy-crop/react-easy-crop.css";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type AspectOption = "free" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

const ASPECT_VALUES: Record<AspectOption, number | undefined> = {
  free: undefined,
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

type GalleryCropModalProps = {
  open: boolean;
  pending?: boolean;
  remainingSlots?: number;
  multiple?: boolean;
  initialAspect?: AspectOption;
  /** When true, aspect stays fixed (see initialAspect) and ratio buttons are hidden. */
  lockAspect?: boolean;
  title?: string;
  selectHint?: string;
  addButtonLabel?: string;
  onClose: () => void;
  onSave: (payload: {
    blob: Blob;
    width: number;
    height: number;
  }) => Promise<boolean> | boolean;
};

function revokeAll(urls: string[]) {
  for (const url of urls) URL.revokeObjectURL(url);
}

export function GalleryCropModal({
  open,
  pending = false,
  remainingSlots = 20,
  multiple = true,
  initialAspect = "free",
  lockAspect = false,
  title,
  selectHint,
  addButtonLabel,
  onClose,
  onSave,
}: GalleryCropModalProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectOption, setAspectOption] = useState<AspectOption>(initialAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dialogTitle = title ?? t.galleryCropTitle;
  const pickHint = selectHint ?? (multiple ? t.gallerySelectPhotos : t.gallerySelectPhoto);
  const pickButtonLabel = addButtonLabel ?? t.galleryAddPhoto;
  const imageSrc = queue[index] ?? null;
  const isLast = queue.length > 0 && index >= queue.length - 1;
  const aspect = ASPECT_VALUES[aspectOption];

  useEffect(() => {
    if (open) return;

    setQueue((current) => {
      revokeAll(current);
      return [];
    });
    setIndex(0);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspectOption(initialAspect);
    setCroppedAreaPixels(null);
    setLocalError(null);
    setSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, initialAspect]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, pending, saving]);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, [index, imageSrc, aspectOption]);

  if (!open) return null;

  function onFilesSelected(fileList: FileList | null) {
    setLocalError(null);
    if (!fileList?.length) return;

    if (remainingSlots <= 0) {
      setLocalError(t.galleryTooMany);
      return;
    }

    const accepted: string[] = [];
    let typeError = false;
    let sizeError = false;

    for (const file of Array.from(fileList)) {
      if (accepted.length >= remainingSlots) break;
      if (!ALLOWED_TYPES.has(file.type)) {
        typeError = true;
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        sizeError = true;
        continue;
      }
      accepted.push(URL.createObjectURL(file));
    }

    if (accepted.length === 0) {
      setLocalError(
        typeError
          ? t.galleryInvalidType
          : sizeError
            ? t.galleryTooLarge
            : t.galleryInvalidType,
      );
      return;
    }

    if (typeError || sizeError) {
      setLocalError(
        typeError ? t.galleryInvalidType : t.galleryTooLarge,
      );
    }

    setQueue((current) => {
      revokeAll(current);
      return accepted;
    });
    setIndex(0);
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels || saving || pending) return;
    setSaving(true);
    setLocalError(null);
    try {
      const cropped = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const ok = await onSave(cropped);
      if (!ok) return;

      if (isLast) {
        onClose();
        return;
      }

      setIndex((current) => current + 1);
    } catch {
      setLocalError(t.galleryUploadError);
    } finally {
      setSaving(false);
    }
  }

  const busy = pending || saving;
  const progressLabel =
    queue.length > 1
      ? t.galleryCropProgress
          .replaceAll("{current}", String(index + 1))
          .replaceAll("{total}", String(queue.length))
      : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-surface-border bg-background/90 shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-surface-border px-5 py-4">
          <h3 className="text-lg font-medium text-foreground">
            {dialogTitle}
          </h3>
          {progressLabel ? (
            <p className="mt-1 text-sm text-muted">{progressLabel}</p>
          ) : null}
        </div>

        <div className="space-y-4 px-5 py-4">
          {!imageSrc ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted">{pickHint}</p>
              <button
                type="button"
                disabled={busy || remainingSlots <= 0}
                onClick={() => fileInputRef.current?.click()}
                className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pickButtonLabel}
              </button>
            </div>
          ) : (
            <>
              <div className="relative h-72 w-full overflow-hidden rounded-lg bg-accent-soft">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) =>
                    setCroppedAreaPixels(areaPixels)
                  }
                />
              </div>
              {!lockAspect ? (
                <div className="text-left">
                  <span className="mb-2 block text-sm text-muted">
                    {t.galleryCropAspect}
                  </span>
                  <div
                    role="group"
                    aria-label={t.galleryCropAspect}
                    className="flex flex-wrap gap-1.5"
                  >
                    {(
                      [
                        ["free", t.galleryCropAspectFree],
                        ["1:1", t.galleryCropAspectSquare],
                        ["4:3", t.galleryCropAspectLandscape],
                        ["3:4", t.galleryCropAspectPortrait],
                        ["16:9", t.galleryCropAspectWide],
                        ["9:16", t.galleryCropAspectTall],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={busy}
                        onClick={() => setAspectOption(value)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                          aspectOption === value
                            ? "bg-accent text-white"
                            : "border border-surface-border bg-background/70 text-foreground hover:border-accent/50 hover:text-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="block text-sm text-muted">
                <span className="mb-2 block">{t.galleryCropZoom}</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  disabled={busy}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-medium text-accent transition hover:opacity-80"
              >
                {pickHint}
              </button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            className="hidden"
            onChange={(event) => {
              onFilesSelected(event.target.files);
              event.target.value = "";
            }}
          />

          {localError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{localError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-surface-border px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-60"
          >
            {t.galleryCropCancel}
          </button>
          <button
            type="button"
            disabled={busy || !imageSrc || !croppedAreaPixels}
            onClick={() => void handleSave()}
            className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? t.authPleaseWait
              : isLast || queue.length <= 1
                ? t.galleryCropApply
                : t.galleryCropApplyNext}
          </button>
        </div>
      </div>
    </div>
  );
}
