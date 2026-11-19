'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import ukLocale from '@fullcalendar/core/locales/uk';
import { toast } from 'sonner';
import {
	CancelBookingDialog,
	cutoffPassedMessage,
	thaiNeighborCutoffMessage,
} from '@/components/cancel-booking-dialog';
import { useLanguage } from '@/components/language-provider';
import { showPersistentThaiHint } from '@/lib/thai-hints';
import {
	CALENDAR_SLOT_DURATION,
	CALENDAR_SLOT_MAX_TIME,
	CALENDAR_SLOT_MIN_TIME,
	DEFAULT_CANCEL_CUTOFF_HOURS,
	DEFAULT_MASSEUR_TIME_ZONE,
} from '@/lib/booking-constants';
import {
	alignToHourIso,
	formatCalendarTimeZoneLine,
	formatHourRange,
	formatSlotDateTime,
	formatWeekTitle,
} from '@/lib/calendar-time';
import { isWithinClientCancelWindow } from '@/lib/client-booking-rules';
import type { ClientCancelReasonKey } from '@/lib/client-booking-rules';
import {
	clientBookingWindowExclusiveEnd,
	clientBookingWindowLastDay,
	resolveTimeZone,
} from '@/lib/masseur-time';
import { getMassageTypeLabel } from '@/lib/massage-types';

type SlotStatus = 'available' | 'booked';

type AvailabilitySlot = {
	id: string;
	start: string;
	end: string;
	status: SlotStatus;
	mine: boolean;
	bookingId: string | null;
	massageType: string | null;
};

type CancelTarget = {
	startIso: string;
	bookingId: string | null;
	massageType: string | null;
};

type ClientBookingCalendarProps = {
	masseurId: string;
	selectedStarts: string[];
	onChangeSelected: (slotStarts: string[]) => void;
	refreshKey?: number;
	onRulesLoaded?: (rules: {
		cancelCutoffHours: number;
		masseurPhone: string | null;
	}) => void;
};

function fillTimeHint(template: string, start: string, end: string) {
	return template.replaceAll('{start}', start).replaceAll('{end}', end);
}

export function ClientBookingCalendar({
	masseurId,
	selectedStarts,
	onChangeSelected,
	refreshKey = 0,
	onRulesLoaded,
}: ClientBookingCalendarProps) {
	const { t, locale } = useLanguage();
	const calendarRef = useRef<FullCalendar | null>(null);
	const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
	const [timeZone, setTimeZone] = useState(DEFAULT_MASSEUR_TIME_ZONE);
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [isCurrentWeek, setIsCurrentWeek] = useState(false);
	const [bookingWindowEnd, setBookingWindowEnd] = useState<string | null>(null);
	const [cancelCutoffHours, setCancelCutoffHours] = useState<number>(
		DEFAULT_CANCEL_CUTOFF_HOURS,
	);
	const [masseurPhone, setMasseurPhone] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [cancelPending, setCancelPending] = useState(false);
	const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
	const [hoverTip, setHoverTip] = useState<{
		text: string;
		x: number;
		y: number;
	} | null>(null);

	const showSlotTip = useCallback((text: string, el: HTMLElement) => {
		const rect = el.getBoundingClientRect();
		setHoverTip({
			text,
			x: rect.left + rect.width / 2,
			y: rect.top,
		});
	}, []);

	const hideSlotTip = useCallback(() => {
		setHoverTip(null);
	}, []);

	const showSlotTipRef = useRef(showSlotTip);
	const hideSlotTipRef = useRef(hideSlotTip);
	const timeZoneRef = useRef(timeZone);
	const slotsRef = useRef(slots);
	const selectedStartsRef = useRef(selectedStarts);
	const selectedSet = useMemo(() => new Set(selectedStarts), [selectedStarts]);
	const selectedSetRef = useRef(selectedSet);

	useEffect(() => {
		showSlotTipRef.current = showSlotTip;
		hideSlotTipRef.current = hideSlotTip;
		timeZoneRef.current = timeZone;
		slotsRef.current = slots;
		selectedStartsRef.current = selectedStarts;
		selectedSetRef.current = selectedSet;
	}, [showSlotTip, hideSlotTip, timeZone, slots, selectedStarts, selectedSet]);

	const sortedSelected = useMemo(
		() => [...selectedStarts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
		[selectedStarts],
	);

	const viewTitle = useMemo(() => {
		if (!range) return '';
		return formatWeekTitle(range.from, range.to, locale, timeZone);
	}, [range, locale, timeZone]);

	const timeZoneLine = useMemo(
		() => formatCalendarTimeZoneLine(t.calendarTimeZoneLabel, timeZone),
		[t.calendarTimeZoneLabel, timeZone],
	);

	const windowEndMs = useMemo(() => {
		if (bookingWindowEnd) return new Date(bookingWindowEnd).getTime();
		return clientBookingWindowExclusiveEnd(new Date(), timeZone).getTime();
	}, [bookingWindowEnd, timeZone]);

	const canGoNext = useMemo(() => {
		if (!range) return true;
		return new Date(range.to).getTime() < windowEndMs;
	}, [range, windowEndMs]);

	const bookingWindowMessage = useMemo(() => {
		const lastDay = clientBookingWindowLastDay(new Date(), timeZone);
		const dateLabel = new Intl.DateTimeFormat(
			locale === 'uk' ? 'uk-UA' : 'en-GB',
			{
				timeZone,
				day: 'numeric',
				month: 'short',
				year: 'numeric',
			},
		).format(lastDay);
		return t.bookingWindowLimit.replaceAll('{date}', dateLabel);
	}, [locale, timeZone, t.bookingWindowLimit]);

	const events = useMemo(
		() =>
			slots.map(slot => {
				const booked = slot.status === 'booked';
				const mine = booked && slot.mine;
				const selected = !booked && selectedSet.has(slot.start);
				const label = booked
					? t.availabilityBookedSlotLabel
					: selected
						? t.bookingSlotSelected
						: t.availabilitySlotLabel;
				const hours = formatHourRange(
					new Date(slot.start),
					new Date(slot.end),
					locale,
					timeZone,
				);
				const hint = (() => {
					if (!booked) return undefined;
					if (!mine) {
						return fillTimeHint(
							t.bookingBookedByOtherHint,
							hours.start,
							hours.end,
						);
					}
					const lines = fillTimeHint(
						t.bookingBookedSlotHint,
						hours.start,
						hours.end,
					).split('\n');
					if (slot.massageType) {
						lines.splice(
							2,
							0,
							`${t.bookingMassageType}: ${getMassageTypeLabel(slot.massageType, locale)}`,
						);
					}
					return lines.join('\n');
				})();
				return {
					id: slot.id,
					start: slot.start,
					end: slot.end,
					title: label,
					display: 'block' as const,
					classNames: booked
						? mine
							? ['fc-event-booked', 'fc-event-booked-mine']
							: ['fc-event-booked']
						: selected
							? ['fc-event-available', 'fc-event-selected']
							: ['fc-event-available'],
					borderColor: 'transparent',
					editable: false,
					extendedProps: {
						status: booked ? ('booked' as const) : ('available' as const),
						mine,
						startIso: slot.start,
						bookingId: slot.bookingId,
						massageType: slot.massageType,
						hint,
					},
				};
			}),
		[
			slots,
			selectedSet,
			locale,
			timeZone,
			t.availabilitySlotLabel,
			t.availabilityBookedSlotLabel,
			t.bookingSlotSelected,
			t.bookingBookedSlotHint,
			t.bookingBookedByOtherHint,
			t.bookingMassageType,
		],
	);

	const loadSlots = useCallback(
		async (from: string, to: string, zone: string) => {
			try {
				const response = await fetch(
					`/api/masseurs/${masseurId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
				);
				if (!response.ok) {
					const data = (await response.json().catch(() => null)) as {
						error?: string;
					} | null;
					if (data?.error === 'BOOKING_WINDOW_EXCEEDED') {
						const lastDay = clientBookingWindowLastDay(new Date(), zone);
						const dateLabel = new Intl.DateTimeFormat(
							locale === 'uk' ? 'uk-UA' : 'en-GB',
							{
								timeZone: zone,
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							},
						).format(lastDay);
						toast.error(t.bookingWindowLimit.replaceAll('{date}', dateLabel));
						return;
					}
					toast.error(
						response.status === 401 || response.status === 403
							? t.bookingUnauthorized
							: t.availabilityLoadError,
					);
					return;
				}
				const data = (await response.json()) as {
					timezone?: string;
					bookingWindowEnd?: string;
					cancelCutoffHours?: number;
					masseurPhone?: string | null;
					slots?: Array<{
						id: string;
						start: string;
						end: string;
						status?: SlotStatus;
						mine?: boolean;
						bookingId?: string | null;
						massageType?: string | null;
					}>;
				};
				if (typeof data.timezone === 'string') {
					setTimeZone(resolveTimeZone(data.timezone));
				}
				if (typeof data.bookingWindowEnd === 'string') {
					setBookingWindowEnd(data.bookingWindowEnd);
				} else {
					setBookingWindowEnd(
						clientBookingWindowExclusiveEnd(new Date(), zone).toISOString(),
					);
				}
				const cutoff =
					typeof data.cancelCutoffHours === 'number'
						? data.cancelCutoffHours
						: DEFAULT_CANCEL_CUTOFF_HOURS;
				const phone =
					typeof data.masseurPhone === 'string' && data.masseurPhone.trim()
						? data.masseurPhone.trim()
						: null;
				setCancelCutoffHours(cutoff);
				setMasseurPhone(phone);
				onRulesLoaded?.({ cancelCutoffHours: cutoff, masseurPhone: phone });
				setSlots(
					(data.slots ?? []).map(slot => ({
						id: slot.id,
						start: slot.start,
						end: slot.end,
						status: slot.status === 'booked' ? 'booked' : 'available',
						mine: Boolean(slot.mine),
						bookingId: typeof slot.bookingId === 'string' ? slot.bookingId : null,
						massageType:
							typeof slot.massageType === 'string' && slot.massageType.trim()
								? slot.massageType
								: null,
					})),
				);
			} catch {
				toast.error(t.availabilityLoadError);
			} finally {
				setLoading(false);
			}
		},
		[
			masseurId,
			locale,
			onRulesLoaded,
			t.availabilityLoadError,
			t.bookingUnauthorized,
			t.bookingWindowLimit,
		],
	);

	useEffect(() => {
		if (!range) return;
		let cancelled = false;
		(async () => {
			await Promise.resolve();
			if (cancelled) return;
			setLoading(true);
			await loadSlots(range.from, range.to, timeZone);
		})();
		return () => {
			cancelled = true;
		};
	}, [range, loadSlots, refreshKey, timeZone]);

	// Drop selection only for slots that are visible this week and now booked.
	// Keep selections from other weeks when navigating.
	const visibleBookedStarts = useMemo(
		() =>
			new Set(
				slots.filter(slot => slot.status === 'booked').map(slot => slot.start),
			),
		[slots],
	);
	const cleanedSelectedStarts = useMemo(() => {
		if (selectedStarts.length === 0 || visibleBookedStarts.size === 0) {
			return selectedStarts;
		}
		return selectedStarts.filter(start => !visibleBookedStarts.has(start));
	}, [selectedStarts, visibleBookedStarts]);
	if (cleanedSelectedStarts.length !== selectedStarts.length) {
		onChangeSelected(cleanedSelectedStarts);
	}

	function toggleSelected(startIso: string) {
		const current = selectedStartsRef.current;
		const selected = selectedSetRef.current;
		if (selected.has(startIso)) {
			onChangeSelected(current.filter(start => start !== startIso));
			return;
		}
		onChangeSelected([...current, startIso]);
	}

	function requestCancelBooking(
		startIso: string,
		bookingId: string | null,
		massageType: string | null,
	) {
		if (cancelPending || !bookingId) return;
		hideSlotTip();
		if (
			!isWithinClientCancelWindow(
				new Date(startIso),
				cancelCutoffHours,
			)
		) {
			toast.error(cutoffPassedMessage(masseurPhone, t));
			return;
		}
		setCancelTarget({ startIso, bookingId, massageType });
	}

	function handleSlotInteraction(startIso: string) {
		const slot = slotsRef.current.find(item => item.start === startIso);
		if (!slot) {
			toast.error(t.bookingSlotNotOffered);
			return;
		}

		if (slot.status === 'booked') {
			if (!slot.mine) {
				toast.error(t.bookingSlotTakenByOther);
				return;
			}
			requestCancelBooking(startIso, slot.bookingId, slot.massageType);
			return;
		}

		toggleSelected(slot.start);
	}

	function closeCancelDialog() {
		if (cancelPending) return;
		setCancelTarget(null);
	}

	async function confirmCancelBooking(input: {
		cancelReason: ClientCancelReasonKey;
		cancelReasonText: string;
	}) {
		if (!cancelTarget || cancelPending) return;

		setCancelPending(true);
		try {
			const response = await fetch('/api/bookings/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookingId: cancelTarget.bookingId,
					cancelReason: input.cancelReason,
					cancelReasonText: input.cancelReasonText || undefined,
				}),
			});

			const data = (await response.json().catch(() => null)) as {
				error?: string;
				message?: string;
				masseurPhone?: string | null;
				neighborHint?: {
					type: string;
					masseurPhone?: string | null;
				};
			} | null;

			if (!response.ok) {
				if (response.status === 429 || data?.error === 'rate_limited') {
					toast.error(data?.message || t.authRateLimited.replace('{n}', '1'));
				} else if (data?.error === 'CANCEL_CUTOFF_PASSED') {
					toast.error(
						cutoffPassedMessage(data.masseurPhone ?? masseurPhone, t),
					);
				} else if (data?.error === 'CANCEL_REASON_REQUIRED') {
					toast.error(t.bookingCancelReasonRequired);
				} else if (response.status === 404) {
					toast.error(t.bookingCancelForbidden);
				} else {
					toast.error(t.bookingCancelError);
				}
				return;
			}

			toast.success(t.bookingCancelSuccess);
			if (data?.neighborHint?.type === 'thai_cutoff') {
				showPersistentThaiHint(
					thaiNeighborCutoffMessage(
						data.neighborHint.masseurPhone ?? masseurPhone,
						t,
					),
				);
			} else if (data?.neighborHint?.type === 'thai_neighbor') {
				showPersistentThaiHint(t.bookingThaiCancelNeighborHint);
			}
			setCancelTarget(null);
			if (range) {
				await loadSlots(range.from, range.to, timeZone);
			}
		} catch {
			toast.error(t.bookingCancelError);
		} finally {
			setCancelPending(false);
		}
	}

	function goToPrev() {
		calendarRef.current?.getApi().prev();
	}

	function goToNext() {
		if (!canGoNext) return;
		calendarRef.current?.getApi().next();
	}

	function goToToday() {
		calendarRef.current?.getApi().today();
	}

	return (
		<div className='text-left'>
			<div className={`AvailabilityCalendar AvailabilityCalendar--noEmptyHover ${loading ? 'opacity-80' : ''}`}>
				{sortedSelected.length > 0 ? (
					<div className='mb-5 space-y-1 text-base text-accent'>
						<p className='font-medium'>{t.bookingSelectedSlot}:</p>
						<ul className='space-y-1'>
							{sortedSelected.map(start => (
								<li key={start} className='font-medium'>
									{formatSlotDateTime(start, locale, timeZone)}
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className='mb-5 text-base text-muted'>{t.bookingNoSlotSelected}</p>
				)}

				<div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
					<div className='flex min-w-0 flex-1 flex-col gap-1'>
						<div className='flex flex-wrap items-center gap-1'>
							<button
								type='button'
								onClick={goToPrev}
								className='AvailabilityCalendarNavBtn'
								aria-label='Previous week'
							>
								‹
							</button>
							<button
								type='button'
								onClick={goToNext}
								disabled={!canGoNext}
								className='AvailabilityCalendarNavBtn disabled:cursor-not-allowed disabled:opacity-45'
								aria-label='Next week'
							>
								›
							</button>
							<button
								type='button'
								onClick={goToToday}
								disabled={isCurrentWeek}
								className='AvailabilityCalendarNavBtn AvailabilityCalendarNavBtnWide disabled:cursor-not-allowed disabled:opacity-45'
							>
								{t.availabilityToday}
							</button>
						</div>
						{!canGoNext ? (
							<p className='max-w-md text-xs text-muted'>{bookingWindowMessage}</p>
						) : null}
					</div>

					<div className='pt-1 text-right'>
						<h4 className='text-base font-bold text-foreground sm:text-lg'>
							{viewTitle}
						</h4>
						<p className='mt-0.5 text-xs text-muted'>{timeZoneLine}</p>
					</div>
				</div>

				<FullCalendar
					key={`${locale}-${timeZone}`}
					ref={calendarRef}
					plugins={[luxonPlugin, timeGridPlugin, interactionPlugin]}
					initialView='timeGridWeek'
					timeZone={timeZone}
					locale={locale === 'uk' ? ukLocale : 'en'}
					headerToolbar={false}
					allDaySlot={false}
					slotMinTime={CALENDAR_SLOT_MIN_TIME}
					slotMaxTime={CALENDAR_SLOT_MAX_TIME}
					slotDuration={CALENDAR_SLOT_DURATION}
					slotLabelInterval={CALENDAR_SLOT_DURATION}
					slotLabelFormat={{
						hour: '2-digit',
						minute: '2-digit',
						hour12: false,
					}}
					snapDuration={CALENDAR_SLOT_DURATION}
					height='auto'
					expandRows
					nowIndicator
					selectable={false}
					editable={false}
					eventStartEditable={false}
					eventDurationEditable={false}
					events={events}
					eventDidMount={info => {
						const hint = info.event.extendedProps.hint;
						if (typeof hint !== 'string' || !hint) return;

						const onEnter = () => showSlotTipRef.current(hint, info.el);
						const onLeave = () => hideSlotTipRef.current();
						info.el.addEventListener('mouseenter', onEnter);
						info.el.addEventListener('mouseleave', onLeave);
					}}
					datesSet={arg => {
						hideSlotTipRef.current();
						const from = arg.start.toISOString();
						const to = arg.end.toISOString();
						const now = Date.now();
						setIsCurrentWeek(
							now >= arg.start.getTime() && now < arg.end.getTime(),
						);
						setRange({ from, to });
					}}
					eventClick={arg => {
						const props = arg.event.extendedProps;
						const startIso =
							typeof props.startIso === 'string'
								? props.startIso
								: alignToHourIso(
										arg.event.start ?? new Date(),
										timeZoneRef.current,
									);
						handleSlotInteraction(startIso);
					}}
					eventTextColor='#ffffff'
					slotEventOverlap={false}
					firstDay={1}
				/>
			</div>

			{hoverTip ? (
				<div
					role='tooltip'
					className='pointer-events-none fixed z-[80] max-w-xs -translate-x-1/2 -translate-y-full whitespace-pre-line rounded-lg border border-surface-border bg-background px-3 py-2 text-left text-xs leading-relaxed text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.16)]'
					style={{ left: hoverTip.x, top: hoverTip.y - 8 }}
				>
					{hoverTip.text}
				</div>
			) : null}

			{cancelTarget ? (
				<CancelBookingDialog
					startIso={cancelTarget.startIso}
					timeZone={timeZone}
					massageType={cancelTarget.massageType}
					subtitle={t.bookingBookedByYou}
					pending={cancelPending}
					onClose={closeCancelDialog}
					onConfirm={input => void confirmCancelBooking(input)}
				/>
			) : null}
		</div>
	);
}
