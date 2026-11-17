"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientBookingCalendar } from "@/components/client-booking-calendar";
import { BackNavLink } from "@/components/back-nav-link";
import { MasseurGallery } from "@/components/masseur-gallery";
import { DEFAULT_CANCEL_CUTOFF_HOURS } from "@/lib/booking-constants";
import { isNonCancellableAtBookingTime } from "@/lib/client-booking-rules";
import {
  hasConsecutiveHourPair,
  showPersistentThaiHint,
  THAI_MASSAGE_TYPE,
} from "@/lib/thai-hints";
import {
  bookingCreateSchema,
  NOTE_MAX,
  zodErrorCode,
} from "@/lib/validation";
import { useLanguage } from "@/components/language-provider";
import {
  getMassageTypeLabel,
  type MassageTypeValue,
} from "@/lib/massage-types";
import { shouldSkipImageOptimization } from "@/lib/upload-url";

type MasseurProfile = {
  id: string;
  nameEn: string | null;
  nameUk: string | null;
  image: string | null;
  descriptionEn: string | null;
  descriptionUk: string | null;
  city: string | null;
  address: string | null;
  massageTypes: MassageTypeValue[];
  galleryImages: {
    id: string;
    url: string;
    width: number;
    height: number;
  }[];
};

type ClientBookingProfile = {
  name: string | null;
  nameEn: string | null;
  nameUk: string | null;
  phone: string | null;
};

export function MasseurBookingView({
  masseur,
  clientProfile,
}: {
  masseur: MasseurProfile;
  clientProfile?: ClientBookingProfile;
}) {
  const { t, locale } = useLanguage();
  const accountName = clientProfile?.name?.trim() || "";
  const accountPhone = clientProfile?.phone?.trim() || "";
  const profileComplete = Boolean(accountName && accountPhone);
  const [massageType, setMassageType] = useState("");
  const [selectedSlotStarts, setSelectedSlotStarts] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [cancelCutoffHours, setCancelCutoffHours] = useState<number>(
    DEFAULT_CANCEL_CUTOFF_HOURS,
  );

  const name =
    (locale === "uk" ? masseur.nameUk : masseur.nameEn)?.trim() ||
    t.masseurFallbackName;
  const description =
    (locale === "uk" ? masseur.descriptionUk : masseur.descriptionEn)?.trim() ||
    "";
  const city = masseur.city?.trim() || "";
  const addressLine = masseur.address?.trim() || "";
  const location =
    city && addressLine
      ? `${city}, ${addressLine}`
      : city || addressLine;
  const hasMassageTypes = masseur.massageTypes.length > 0;

  const showNonCancellableNotice = useMemo(() => {
    if (selectedSlotStarts.length === 0) return false;
    const now = new Date();
    return selectedSlotStarts.some((start) =>
      isNonCancellableAtBookingTime(new Date(start), cancelCutoffHours, now),
    );
  }, [selectedSlotStarts, cancelCutoffHours]);

  function handleMassageTypeChange(next: string) {
    setMassageType(next);
    if (next === THAI_MASSAGE_TYPE) {
      showPersistentThaiHint(t.bookingThaiMultiSlotHint);
    }
  }

  function handleSelectedSlotsChange(next: string[]) {
    const previous = selectedSlotStarts;
    setSelectedSlotStarts(next);
    if (massageType !== THAI_MASSAGE_TYPE) return;
    // Slot-selection hint only when the selection grew and still has no pair.
    if (next.length <= previous.length) return;
    if (hasConsecutiveHourPair(next)) return;
    showPersistentThaiHint(t.bookingThaiMultiSlotHint);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileComplete) {
      toast.error(t.bookingProfileIncomplete);
      return;
    }
    setPending(true);

    const parsed = bookingCreateSchema.safeParse({
      masseurId: masseur.id,
      massageType: hasMassageTypes ? massageType : undefined,
      slotStarts: selectedSlotStarts,
      note,
    });

    if (!parsed.success) {
      const code = zodErrorCode(parsed.error);
      if (code === "invalid_slot" || parsed.error.issues.some((i) => i.path[0] === "slotStarts")) {
        toast.error(t.bookingSlotRequired);
      } else if (
        code === "invalid_massage_type" ||
        parsed.error.issues.some((i) => i.path[0] === "massageType")
      ) {
        toast.error(t.bookingMassageTypeRequired);
      } else {
        toast.error(t.bookingMissingFields);
      }
      setPending(false);
      return;
    }

    if (hasMassageTypes && !parsed.data.massageType) {
      toast.error(t.bookingMassageTypeRequired);
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masseurId: parsed.data.masseurId,
          massageType: hasMassageTypes ? parsed.data.massageType : undefined,
          slotStarts: parsed.data.slotStarts,
          note: parsed.data.note,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          message?: string;
        };
        if (response.status === 429 || data.error === "rate_limited") {
          toast.error(data.message || t.authRateLimited.replace("{n}", "1"));
        } else if (data.error === "missing_fields") {
          toast.error(t.bookingMissingFields);
        } else if (data.error === "CLIENT_PROFILE_INCOMPLETE") {
          toast.error(t.bookingProfileIncomplete);
        } else if (data.error === "invalid_massage_type") {
          toast.error(t.bookingMassageTypeRequired);
        } else if (data.error === "unauthorized" || data.error === "forbidden") {
          toast.error(t.bookingUnauthorized);
        } else if (data.error === "slot_unavailable") {
          toast.error(t.bookingSlotUnavailable);
        } else if (data.error === "slot_taken") {
          toast.error(t.bookingSlotTaken);
        } else if (data.error === "CLIENT_SLOT_OVERLAP") {
          toast.error(t.bookingClientOverlap);
        } else if (data.error === "CLIENT_BOOKING_LIMIT") {
          toast.error(t.bookingClientLimit);
        } else if (
          data.error === "BOOKING_LEAD_TIME" ||
          data.error === "BOOKING_WINDOW_EXCEEDED"
        ) {
          toast.error(t.bookingSlotUnavailable);
        } else {
          toast.error(t.bookingError);
        }
        return;
      }

      toast.success(t.bookingSuccess);
      setMassageType("");
      setSelectedSlotStarts([]);
      setNote("");
      setCalendarRefreshKey((key) => key + 1);
    } catch {
      toast.error(t.bookingError);
    } finally {
      setPending(false);
    }
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto w-full max-w-6xl px-[15px]">
        <BackNavLink href="/client">{t.bookingBackToList}</BackNavLink>

        <section className="mt-8 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8">
          <div className="mb-6 text-left">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground">
              {t.bookingAboutTitle}
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
            <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-[5px] border border-surface-border bg-accent-soft sm:mx-0">
              {masseur.image ? (
                <Image
                  src={masseur.image}
                  alt={name}
                  fill
                  sizes="176px"
                  className="object-cover"
                  unoptimized={shouldSkipImageOptimization(masseur.image)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-medium text-accent">
                  {initials}
                </div>
              )}
            </div>

            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2.5">
                <RoleIcon className="size-4 shrink-0 text-muted" />
                <p className="text-sm uppercase tracking-[0.14em] text-muted">
                  {t.bookingEyebrow}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <NameIcon className="mt-2 size-5 shrink-0 text-muted" />
                <h1 className="font-display text-4xl tracking-[-0.03em] text-foreground">
                  {name}
                </h1>
              </div>
              {location ? (
                <div className="flex items-start gap-2.5">
                  <LocationIcon className="mt-1 size-[18px] shrink-0 text-muted" />
                  <p className="text-[18px] text-muted">{location}</p>
                </div>
              ) : null}
              {description ? (
                <div className="flex items-start gap-2.5">
                  <AboutIcon className="mt-1 size-4 shrink-0 text-muted" />
                  <p className="max-w-2xl text-base leading-relaxed text-muted">
                    {description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {masseur.galleryImages.length > 0 ? (
          <MasseurGallery initialImages={masseur.galleryImages} />
        ) : null}

        <section className="mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6">
          <div className="mb-4 text-left">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground">
              {t.bookingSelectSlot}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t.bookingSelectSlotSupport}
            </p>
          </div>

          <ClientBookingCalendar
            masseurId={masseur.id}
            selectedStarts={selectedSlotStarts}
            onChangeSelected={handleSelectedSlotsChange}
            refreshKey={calendarRefreshKey}
            onRulesLoaded={(rules) =>
              setCancelCutoffHours(rules.cancelCutoffHours)
            }
          />
        </section>

        <form
          onSubmit={handleSubmit}
          noValidate
          autoComplete="on"
          className="mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6"
        >
          <div className="mb-4 text-left">
            <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground">
              {t.bookingTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.bookingSupport}</p>
          </div>

          <div className="space-y-4">
              {hasMassageTypes ? (
                <label className="block text-left">
                  <span className="mb-1.5 block text-sm text-muted">
                    {t.bookingMassageType}
                  </span>
                  <select
                    required
                    value={massageType}
                    onChange={(event) =>
                      handleMassageTypeChange(event.target.value)
                    }
                    className="h-12 w-full text-foreground"
                  >
                    <option value="">{t.bookingMassageTypePlaceholder}</option>
                    {masseur.massageTypes.map((id) => (
                      <option key={id} value={id}>
                        {getMassageTypeLabel(id, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-left">
                  <span className="mb-1.5 block text-sm text-muted">
                    {t.bookingClientName}
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={accountName}
                    readOnly
                    className="h-12 w-full rounded-lg border border-surface-border bg-background/50 px-4 text-foreground outline-none"
                  />
                </label>

                <label className="block text-left">
                  <span className="mb-1.5 block text-sm text-muted">
                    {t.bookingClientPhone}
                  </span>
                  <input
                    type="tel"
                    name="tel"
                    value={accountPhone}
                    readOnly
                    className="h-12 w-full rounded-lg border border-surface-border bg-background/50 px-4 text-foreground outline-none"
                  />
                </label>
              </div>

              {!profileComplete ? (
                <p className="text-sm text-accent">{t.bookingProfileIncomplete}</p>
              ) : null}

              <label className="block text-left">
                <span className="mb-1.5 block text-sm text-muted">
                  {t.bookingNote}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  maxLength={NOTE_MAX}
                  placeholder={t.bookingNotePlaceholder}
                  className="w-full resize-y rounded-lg border border-surface-border bg-background/70 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              {showNonCancellableNotice ? (
                <p className="text-sm text-accent">
                  {t.bookingCancelNonCancellableNotice.replaceAll(
                    "{n}",
                    String(cancelCutoffHours),
                  )}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending || !profileComplete}
                className="h-12 rounded-lg bg-accent px-6 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? t.authPleaseWait : t.bookingSubmit}
              </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function RoleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  );
}

function NameIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M8 7h8" />
      <path d="M8 12h8" />
      <path d="M8 17h5" />
      <path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function AboutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}
