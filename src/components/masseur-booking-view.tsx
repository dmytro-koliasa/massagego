"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import PhoneInput, {
  type Country,
} from "react-phone-number-input/max";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { ClientBookingCalendar } from "@/components/client-booking-calendar";
import { BackNavLink } from "@/components/back-nav-link";
import { MasseurGallery } from "@/components/masseur-gallery";
import { PHONE_COUNTRIES_EU_UA } from "@/lib/phone-countries";
import {
  clampInternationalPhone,
  nationalPhoneInsert,
} from "@/lib/phone";
import { parsePhoneNumber } from "libphonenumber-js/max";
import {
  bookingCreateSchema,
  NAME_MAX,
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

function resolveClientDisplayName(
  client: ClientBookingProfile | undefined,
  locale: "en" | "uk",
) {
  if (!client) return "";
  const primary = (locale === "uk" ? client.nameUk : client.nameEn)?.trim();
  const secondary = (locale === "uk" ? client.nameEn : client.nameUk)?.trim();
  return primary || secondary || client.name?.trim() || "";
}

function resolveInitialPhone(client: ClientBookingProfile | undefined): {
  phone: string | undefined;
  country: Country;
} {
  const raw = client?.phone?.trim();
  if (!raw) return { phone: undefined, country: "UA" };
  try {
    const parsed = parsePhoneNumber(raw);
    const country = (parsed.country as Country | undefined) ?? "UA";
    return {
      phone: parsed.format("E.164"),
      country,
    };
  } catch {
    return { phone: raw.startsWith("+") ? raw : undefined, country: "UA" };
  }
}

export function MasseurBookingView({
  masseur,
  clientProfile,
}: {
  masseur: MasseurProfile;
  clientProfile?: ClientBookingProfile;
}) {
  const { t, locale } = useLanguage();
  const initialPhone = resolveInitialPhone(clientProfile);
  const [clientName, setClientName] = useState(() =>
    resolveClientDisplayName(clientProfile, locale),
  );
  const [clientPhone, setClientPhone] = useState<string | undefined>(
    () => initialPhone.phone,
  );
  const [phoneCountry, setPhoneCountry] = useState<Country>(
    () => initialPhone.country,
  );
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

    const parsed = bookingCreateSchema.safeParse({
      masseurId: masseur.id,
      clientName,
      clientPhone: clientPhone ?? "",
      massageType: hasMassageTypes ? massageType : undefined,
      slotStarts: selectedSlotStarts,
      note,
    });

    if (!parsed.success) {
      const code = zodErrorCode(parsed.error);
      if (code === "invalid_phone") {
        toast.error(t.bookingInvalidPhone);
      } else if (code === "invalid_slot" || parsed.error.issues.some((i) => i.path[0] === "slotStarts")) {
        toast.error(t.bookingSlotRequired);
      } else if (
        code === "invalid_massage_type" ||
        parsed.error.issues.some((i) => i.path[0] === "massageType")
      ) {
        toast.error(t.bookingMassageTypeRequired);
      } else if (parsed.error.issues.some((i) => i.path[0] === "clientName")) {
        toast.error(t.bookingClientNameRequired);
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
          clientName: parsed.data.clientName,
          clientPhone: parsed.data.clientPhone,
          massageType: hasMassageTypes ? parsed.data.massageType : undefined,
          slotStarts: parsed.data.slotStarts,
          note: parsed.data.note,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (data.error === "missing_fields") {
          toast.error(t.bookingMissingFields);
        } else if (data.error === "invalid_phone") {
          toast.error(t.bookingInvalidPhone);
        } else if (data.error === "invalid_massage_type") {
          toast.error(t.bookingMassageTypeRequired);
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
                    maxLength={NAME_MAX}
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
                    countryCallingCodeEditable={false}
                    defaultCountry="UA"
                    countries={[...PHONE_COUNTRIES_EU_UA]}
                    addInternationalOption={false}
                    flags={flags}
                    limitMaxLength
                    value={clientPhone}
                    onChange={(value) =>
                      setClientPhone(clampInternationalPhone(value, phoneCountry))
                    }
                    onCountryChange={(country) => {
                      if (!country) return;
                      setPhoneCountry(country);
                      setClientPhone((current) =>
                        clampInternationalPhone(current, country),
                      );
                    }}
                    className="PhoneInputField"
                    numberInputProps={{
                      name: "tel",
                      autoComplete: "tel",
                      required: true,
                      className:
                        "PhoneInputInput h-12 w-full rounded-lg border-0 bg-transparent pr-3 pl-1.5 text-foreground outline-none",
                      onBeforeInput: (
                        event: FormEvent<HTMLInputElement>,
                      ) => {
                        const inserted =
                          (event.nativeEvent as InputEvent).data ?? "";
                        const input = event.currentTarget;
                        const start =
                          input.selectionStart ?? input.value.length;
                        const end = input.selectionEnd ?? input.value.length;
                        const next = nationalPhoneInsert(
                          input.value,
                          start,
                          end,
                          inserted,
                          phoneCountry,
                        );
                        if (!next.exceeds) return;
                        event.preventDefault();
                        setClientPhone(next.value);
                      },
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
                  maxLength={NOTE_MAX}
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
