"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MasonryPhotoAlbum } from "react-photo-album";
import Lightbox from "yet-another-react-lightbox";
import { toast } from "sonner";
import { GalleryCropModal } from "@/components/gallery-crop-modal";
import { useLanguage } from "@/components/language-provider";
import "react-photo-album/masonry.css";
import "yet-another-react-lightbox/styles.css";

export type GalleryPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
};

const EMPTY_GALLERY: GalleryPhoto[] = [];

type MasseurGalleryProps = {
  initialImages?: GalleryPhoto[];
  editable?: boolean;
};

export function MasseurGallery({
  initialImages = EMPTY_GALLERY,
  editable = false,
}: MasseurGalleryProps) {
  const { t } = useLanguage();
  const [images, setImages] = useState<GalleryPhoto[]>(initialImages);
  const [loading, setLoading] = useState(
    editable && initialImages.length === 0,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const loadImages = useCallback(async () => {
    if (!editable) return;
    setLoading(true);
    try {
      const response = await fetch("/api/masseur/gallery");
      if (!response.ok) {
        toast.error(t.galleryLoadError);
        return;
      }
      const data = (await response.json()) as { images: GalleryPhoto[] };
      setImages(data.images);
    } catch {
      toast.error(t.galleryLoadError);
    } finally {
      setLoading(false);
    }
  }, [editable, t.galleryLoadError]);

  useEffect(() => {
    if (!editable) return;
    void loadImages();
  }, [editable, loadImages]);

  useEffect(() => {
    if (editable) return;
    setImages(initialImages);
  }, [editable, initialImages]);

  const photos = useMemo(
    () =>
      images.map((image) => ({
        src: image.url,
        // Square tiles for a compact grid; lightbox still shows the full image.
        width: 1,
        height: 1,
        key: image.id,
      })),
    [images],
  );

  const slides = useMemo(
    () => images.map((image) => ({ src: image.url })),
    [images],
  );

  async function handleSave(payload: {
    blob: Blob;
    width: number;
    height: number;
  }) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", payload.blob, "gallery.jpg");
      formData.append("width", String(payload.width));
      formData.append("height", String(payload.height));

      const response = await fetch("/api/masseur/gallery", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(mapGalleryError(data?.error, t));
        return false;
      }

      const data = (await response.json()) as { image: GalleryPhoto };
      setImages((current) => [...current, data.image]);
      toast.success(t.galleryUploaded);
      return true;
    } catch {
      toast.error(t.galleryUploadError);
      return false;
    } finally {
      setUploading(false);
    }
  }

  function requestDelete(id: string) {
    if (deletingId) return;
    setDeleteTargetId(id);
  }

  function closeDeleteDialog() {
    if (deletingId) return;
    setDeleteTargetId(null);
  }

  async function confirmDelete() {
    if (!deleteTargetId || deletingId) return;

    const id = deleteTargetId;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/masseur/gallery/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error(t.galleryDeleteError);
        return;
      }
      setImages((current) => current.filter((image) => image.id !== id));
      setLightboxIndex((current) => (current >= 0 ? -1 : current));
      setDeleteTargetId(null);
      toast.success(t.galleryDeleted);
    } catch {
      toast.error(t.galleryDeleteError);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6">
      <div className="mb-4 text-left">
        <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground">
          {t.galleryTitle}
        </h2>
        {editable ? (
          <p className="mt-1 text-sm text-muted">{t.galleryLimitSupport}</p>
        ) : null}
        {images.length === 0 && !loading ? (
          <p className="mt-1 text-sm text-muted">{t.galleryEmptySupport}</p>
        ) : null}
        {editable ? (
          <button
            type="button"
            disabled={uploading || loading || images.length >= 3}
            onClick={() => setModalOpen(true)}
            className="mt-4 h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {t.galleryAddPhoto}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted">{t.galleryLoading}</p>
      ) : images.length > 0 ? (
        <MasonryPhotoAlbum
          photos={photos}
          columns={(containerWidth) => {
            if (containerWidth < 480) return 1;
            if (containerWidth < 768) return 2;
            return 3;
          }}
          spacing={12}
          onClick={
            editable
              ? undefined
              : ({ index }) => setLightboxIndex(index)
          }
          render={{
            photo: ({ onClick }, { photo, width, height, index }) => {
              const id = typeof photo.key === "string" ? photo.key : null;
              return (
                <div
                  className="relative aspect-square overflow-hidden rounded-lg border border-surface-border bg-accent-soft"
                  style={{ width, height }}
                >
                  <button
                    type="button"
                    className="absolute inset-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0"
                    onClick={(event) => {
                      if (onClick) {
                        onClick(event);
                        return;
                      }
                      setLightboxIndex(index);
                    }}
                    aria-label={t.galleryTitle}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.src}
                      alt=""
                      width={width}
                      height={height}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>
                  {editable && id ? (
                    <button
                      type="button"
                      disabled={deletingId === id}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void requestDelete(id);
                      }}
                      aria-label={t.galleryDelete}
                      className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-surface-border bg-background text-foreground shadow-sm transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
                    >
                      {deletingId === id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-accent" />
                      ) : (
                        <TrashIcon />
                      )}
                    </button>
                  ) : null}
                </div>
              );
            },
          }}
        />
      ) : null}

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={slides}
      />

      {editable ? (
        <GalleryCropModal
          open={modalOpen}
          pending={uploading}
          remainingSlots={Math.max(0, 3 - images.length)}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      ) : null}

      {deleteTargetId ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
          role="presentation"
          onClick={closeDeleteDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delete-title"
            className="w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="gallery-delete-title"
              className="text-base font-medium text-foreground"
            >
              {t.galleryDeleteConfirm}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={closeDeleteDialog}
                className="h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60"
              >
                {t.galleryDeleteCancel}
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => void confirmDelete()}
                className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {deletingId
                  ? t.authPleaseWait
                  : t.galleryDeleteConfirmAction}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function mapGalleryError(
  code: string | undefined,
  t: ReturnType<typeof useLanguage>["t"],
) {
  switch (code) {
    case "too_many":
      return t.galleryTooMany;
    case "invalid_type":
      return t.galleryInvalidType;
    case "too_large":
      return t.galleryTooLarge;
    default:
      return t.galleryUploadError;
  }
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
