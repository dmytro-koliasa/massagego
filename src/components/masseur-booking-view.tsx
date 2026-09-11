"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import PhoneInput, {
  isValidPhoneNumber,
  type Country,
} from "react-phone-number-input/max";
import flags from "react-phone-number-input/flags";
import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";
import "react-phone-number-input/style.css";
import { ClientBookingCalendar } from "@/components/client-booking-calendar";
import { BackNavLink } from "@/components/back-nav-link";
import { MasseurGallery } from "@/components/masseur-gallery";
import { useLanguage } from "@/components/language-provider";
import {
  getMassageTypeLabel,
  type MassageTypeValue,
} from "@/lib/massage-types";

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

function getMaxNationalLength(country: Country) {
  return getExampleNumber(country, examples)?.nationalNumber.length ?? 15;
}

function getFormattedMaxLength(country: Country) {
  const callingCode = getCountryCallingCode(country);
  const nationalMax = getMaxNationalLength(country);
  const formatter = new AsYouType(country);
  let formatted = "";
  for (const char of `+${callingCode}${"9".repeat(nationalMax)}`) {
    formatted = formatter.input(char);
  }
  return formatted.length;
}

export function MasseurBookingView({ masseur }: { masseur: MasseurProfile }) {
  const { t, locale } = useLanguage();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState<string | undefined>();
  const [phoneCountry, setPhoneCountry] = useState<Country>("UA");
  const [massageType, setMassageType] = useState("");
  const [selectedSlotStarts, setSelectedSlotStarts] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    if (selectedSlotStarts.length === 0) {
      toast.error(t.bookingSlotRequired);
      setPending(false);
      return;
    }

    if (hasMassageTypes && !massageType) {
      toast.error(t.bookingMassageTypeRequired);
      setPending(false);
      return;
    }

    if (!clientName.trim()) {
      toast.error(t.bookingClientNameRequired);
      setPending(false);
      return;
    }

    if (!clientPhone || !isValidPhoneNumber(clientPhone)) {
      toast.error(t.bookingInvalidPhone);
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masseurId: masseur.id,
          clientName: clientName.trim(),
          clientPhone,
          massageType: hasMassageTypes ? massageType : undefined,
          slotStarts: selectedSlotStarts,
          note,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (data.error === "missing_fields") {
          toast.error(t.bookingMissingFields);
        } else if (data.error === "unauthorized" || data.error === "forbidden") {
          toast.error(t.bookingUnauthorized);
        } else if (data.error === "slot_unavailable") {
          toast.error(t.bookingSlotUnavailable);
        } else if (data.error === "slot_taken") {
          toast.error(t.bookingSlotTaken);
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
                  unoptimized={masseur.image.startsWith("/uploads/")}
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
            onChangeSelected={setSelectedSlotStarts}
            refreshKey={calendarRefreshKey}
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
                    onChange={(event) => setMassageType(event.target.value)}
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
                    required
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className="h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>

                <label className="block text-left">
                  <span className="mb-1.5 block text-sm text-muted">
                    {t.bookingClientPhone}
                  </span>
                  <PhoneInput
                    international
                    defaultCountry="UA"
                    flags={flags}
                    value={clientPhone}
                    onChange={setClientPhone}
                    onCountryChange={(country) => {
                      if (country) setPhoneCountry(country);
                    }}
                    className="PhoneInputField"
                    numberInputProps={{
                      name: "tel",
                      autoComplete: "tel",
                      required: true,
                      maxLength: getFormattedMaxLength(phoneCountry),
                      className:
                        "PhoneInputInput h-12 w-full rounded-lg border-0 bg-transparent px-3 text-foreground outline-none",
                    }}
                  />
                </label>
              </div>

              <label className="block text-left">
                <span className="mb-1.5 block text-sm text-muted">
                  {t.bookingNote}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t.bookingNotePlaceholder}
                  className="w-full resize-y rounded-lg border border-surface-border bg-background/70 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>

              <button
                type="submit"
                disabled={pending}
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
