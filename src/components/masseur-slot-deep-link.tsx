"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { AvailabilityCalendarHandle } from "@/components/masseur-availability-calendar";

type Props = {
  calendarRef: RefObject<AvailabilityCalendarHandle | null>;
};

function waitForHandle(
  calendarRef: RefObject<AvailabilityCalendarHandle | null>,
  timeoutMs: number,
): Promise<AvailabilityCalendarHandle | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const handle = calendarRef.current;
      if (handle) {
        resolve(handle);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

export function MasseurSlotDeepLink({ calendarRef }: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotQuery = searchParams.get("slot");
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!slotQuery) {
      handledRef.current = null;
      return;
    }
    if (handledRef.current === slotQuery) return;
    handledRef.current = slotQuery;

    let cancelled = false;
    (async () => {
      const handle = await waitForHandle(calendarRef, 5000);
      if (cancelled) return;

      const result = handle
        ? await handle.focusSlot(slotQuery)
        : ("invalid" as const);
      if (cancelled) return;

      if (result === "missing") {
        toast.error(t.recentCancellationsSlotMissing);
      } else if (result === "invalid") {
        toast.error(t.recentCancellationsSlotInvalid);
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("slot");
      const next =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams}` : "") +
        url.hash;
      router.replace(next, { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    slotQuery,
    calendarRef,
    router,
    t.recentCancellationsSlotMissing,
    t.recentCancellationsSlotInvalid,
  ]);

  return null;
}
