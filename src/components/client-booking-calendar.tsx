'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ukLocale from '@fullcalendar/core/locales/uk';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

type SlotStatus = 'available' | 'booked';

type AvailabilitySlot = {
	id: string;
	start: string;
	end: string;
	status: SlotStatus;
	mine: boolean;
	bookingId: string | null;
};

type CancelTarget = {
	startIso: string;
	bookingId: string | null;
};

type ClientBookingCalendarProps = {
	masseurId: string;
	selectedStarts: string[];
	onChangeSelected: (slotStarts: string[]) => void;
	refreshKey?: number;
};

const SLOT_MS = 60 * 60 * 1000;

function getMonthName(date: Date, locale: 'en' | 'uk') {
	const localeTag = locale === 'uk' ? 'uk-UA' : 'en-GB';

	// uk-UA with a day forces the genitive month form: "вересня", "жовтня", ...
	if (locale === 'uk') {
		return (
			new Intl.DateTimeFormat(localeTag, {
				day: 'numeric',
				month: 'long',
			})
				.formatToParts(date)
				.find(part => part.type === 'month')?.value ?? ''
		);
	}

	return new Intl.DateTimeFormat(localeTag, {
		month: 'long',
	}).format(date);
}

function formatWeekTitle(fromIso: string, toIso: string, locale: 'en' | 'uk') {
	const start = new Date(fromIso);
	const end = new Date(new Date(toIso).getTime() - 1);

	const sameMonth =
		start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

	if (sameMonth) {
		const month = getMonthName(start, locale);
		return `${start.getDate()} – ${end.getDate()} ${month} ${start.getFullYear()}`;
	}

	const startMonth = getMonthName(start, locale);
	const endMonth = getMonthName(end, locale);

	if (start.getFullYear() === end.getFullYear()) {
		return `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
	}

	return `${start.getDate()} ${startMonth} ${start.getFullYear()} – ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

function formatSelectedSlot(startIso: string, locale: 'en' | 'uk') {
	const start = new Date(startIso);
	const end = new Date(start.getTime() + SLOT_MS);
	const localeTag = locale === 'uk' ? 'uk-UA' : 'en-GB';

	const datePart = new Intl.DateTimeFormat(localeTag, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	}).format(start);

	const timeFormatter = new Intl.DateTimeFormat(localeTag, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	return `${datePart}, ${timeFormatter.format(start)}-${timeFormatter.format(end)}`;
}

function formatHourRange(start: Date, end: Date, locale: 'en' | 'uk') {
	const localeTag = locale === 'uk' ? 'uk-UA' : 'en-GB';
	const formatter = new Intl.DateTimeFormat(localeTag, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	return {
		start: formatter.format(start),
		end: formatter.format(end),
	};
}

function fillTimeHint(template: string, start: string, end: string) {
	return template.replaceAll('{start}', start).replaceAll('{end}', end);
}

function alignToHourIso(date: Date) {
	const aligned = new Date(date);
	aligned.setMinutes(0, 0, 0);
	return aligned.toISOString();
}

export function ClientBookingCalendar({
	masseurId,
	selectedStarts,
	onChangeSelected,
	refreshKey = 0,
}: ClientBookingCalendarProps) {
	const { t, locale } = useLanguage();
	const calendarRef = useRef<FullCalendar | null>(null);
	const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
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
	showSlotTipRef.current = showSlotTip;
	const hideSlotTipRef = useRef(hideSlotTip);
	hideSlotTipRef.current = hideSlotTip;

	const selectedSet = useMemo(() => new Set(selectedStarts), [selectedStarts]);
	const slotsRef = useRef(slots);
	slotsRef.current = slots;
	const selectedStartsRef = useRef(selectedStarts);
	selectedStartsRef.current = selectedStarts;
	const selectedSetRef = useRef(selectedSet);
	selectedSetRef.current = selectedSet;

	const sortedSelected = useMemo(
		() => [...selectedStarts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
		[selectedStarts],
	);

	const viewTitle = useMemo(() => {
		if (!range) return '';
		return formatWeekTitle(range.from, range.to, locale);
	}, [range, locale]);

	const isCurrentWeek = useMemo(() => {
		if (!range) return false;
		const now = Date.now();
		return now >= new Date(range.from).getTime() && now < new Date(range.to).getTime();
	}, [range]);

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
				);
				const hint = booked
					? fillTimeHint(
							mine ? t.bookingBookedSlotHint : t.bookingBookedByOtherHint,
							hours.start,
							hours.end,
						)
					: undefined;
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
						hint,
					},
				};
			}),
		[
			slots,
			selectedSet,
			locale,
			t.availabilitySlotLabel,
			t.availabilityBookedSlotLabel,
			t.bookingSlotSelected,
			t.bookingBookedSlotHint,
			t.bookingBookedByOtherHint,
		],
	);

	const loadSlots = useCallback(
		async (from: string, to: string) => {
			setLoading(true);
			try {
				const response = await fetch(
					`/api/masseurs/${masseurId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
				);
				if (!response.ok) {
					toast.error(
						response.status === 401 || response.status === 403
							? t.bookingUnauthorized
							: t.availabilityLoadError,
					);
					return;
				}
				const data = (await response.json()) as {
					slots?: Array<{
						id: string;
						start: string;
						end: string;
						status?: SlotStatus;
						mine?: boolean;
						bookingId?: string | null;
					}>;
				};
				setSlots(
					(data.slots ?? []).map(slot => ({
						id: slot.id,
						start: slot.start,
						end: slot.end,
						status: slot.status === 'booked' ? 'booked' : 'available',
						mine: Boolean(slot.mine),
						bookingId: typeof slot.bookingId === 'string' ? slot.bookingId : null,
					})),
				);
			} catch {
				toast.error(t.availabilityLoadError);
			} finally {
				setLoading(false);
			}
		},
		[masseurId, t.availabilityLoadError, t.bookingUnauthorized],
	);

	useEffect(() => {
		if (!range) return;
		void loadSlots(range.from, range.to);
	}, [range, loadSlots, refreshKey]);

	// Drop selection only for slots that are visible this week and now booked.
	// Keep selections from other weeks when navigating.
	useEffect(() => {
		if (selectedStarts.length === 0 || slots.length === 0) return;

		const visibleBooked = new Set(
			slots.filter(slot => slot.status === 'booked').map(slot => slot.start),
		);
		if (visibleBooked.size === 0) return;

		const next = selectedStarts.filter(start => !visibleBooked.has(start));
		if (next.length !== selectedStarts.length) {
			onChangeSelected(next);
		}
	}, [slots, selectedStarts, onChangeSelected]);

	function toggleSelected(startIso: string) {
		const current = selectedStartsRef.current;
		const selected = selectedSetRef.current;
		if (selected.has(startIso)) {
			onChangeSelected(current.filter(start => start !== startIso));
			return;
		}
		onChangeSelected([...current, startIso]);
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
			requestCancelBooking(startIso, slot.bookingId);
			return;
		}

		toggleSelected(slot.start);
	}

	function requestCancelBooking(startIso: string, bookingId: string | null) {
		if (cancelPending || !bookingId) return;
		hideSlotTip();
		setCancelTarget({ startIso, bookingId });
	}

	function closeCancelDialog() {
		if (cancelPending) return;
		setCancelTarget(null);
	}

	async function confirmCancelBooking() {
		if (!cancelTarget || cancelPending) return;

		setCancelPending(true);
		try {
			const response = await fetch('/api/bookings/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookingId: cancelTarget.bookingId,
				}),
			});

			if (!response.ok) {
				toast.error(
					response.status === 403
						? t.bookingCancelForbidden
						: t.bookingCancelError,
				);
				return;
			}

			toast.success(t.bookingCancelSuccess);
			setCancelTarget(null);
			if (range) {
				await loadSlots(range.from, range.to);
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
		calendarRef.current?.getApi().next();
	}

	function goToToday() {
		calendarRef.current?.getApi().today();
	}

	return (
		<div className='text-left'>
			<div className={`AvailabilityCalendar ${loading ? 'opacity-80' : ''}`}>
				{sortedSelected.length > 0 ? (
					<div className='mb-5 space-y-1 text-base text-accent'>
						<p className='font-medium'>{t.bookingSelectedSlot}:</p>
						<ul className='space-y-1'>
							{sortedSelected.map(start => (
								<li key={start} className='font-medium'>
									{formatSelectedSlot(start, locale)}
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className='mb-5 text-base text-muted'>{t.bookingNoSlotSelected}</p>
				)}

				<div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
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
							className='AvailabilityCalendarNavBtn'
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

					<h4 className='pt-1 text-base font-bold text-foreground sm:text-lg'>{viewTitle}</h4>
				</div>

				<FullCalendar
					key={locale}
					ref={calendarRef}
					plugins={[timeGridPlugin, interactionPlugin]}
					initialView='timeGridWeek'
					locale={locale === 'uk' ? ukLocale : 'en'}
					headerToolbar={false}
					allDaySlot={false}
					slotMinTime='05:00:00'
					slotMaxTime='23:00:00'
					slotDuration='01:00:00'
					slotLabelInterval='01:00:00'
					slotLabelFormat={{
						hour: '2-digit',
						minute: '2-digit',
						hour12: false,
					}}
					snapDuration='01:00:00'
					height='auto'
					expandRows
					nowIndicator
					selectable
					selectMirror={false}
					selectOverlap
					unselectAuto={false}
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
						hideSlotTip();
						setRange({
							from: arg.start.toISOString(),
							to: arg.end.toISOString(),
						});
					}}
					select={arg => {
						arg.view.calendar.unselect();
						handleSlotInteraction(alignToHourIso(arg.start));
					}}
					eventClick={arg => {
						const props = arg.event.extendedProps;
						const startIso =
							typeof props.startIso === 'string'
								? props.startIso
								: alignToHourIso(arg.event.start ?? new Date());
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
				<div
					className='fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4'
					role='presentation'
					onClick={closeCancelDialog}
				>
					<div
						role='dialog'
						aria-modal='true'
						aria-labelledby='booking-cancel-title'
						className='w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]'
						onClick={event => event.stopPropagation()}
					>
						<p
							id='booking-cancel-title'
							className='text-base font-medium text-foreground'
						>
							{t.bookingCancelConfirm}
						</p>
						<p className='mt-2 text-sm text-muted'>
							{formatSelectedSlot(cancelTarget.startIso, locale)}
						</p>
						<div className='mt-5 flex flex-wrap justify-end gap-2'>
							<button
								type='button'
								disabled={cancelPending}
								onClick={closeCancelDialog}
								className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
							>
								{t.bookingCancelKeep}
							</button>
							<button
								type='button'
								disabled={cancelPending}
								onClick={() => void confirmCancelBooking()}
								className='h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
							>
								{cancelPending ? t.authPleaseWait : t.bookingCancelConfirmAction}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
