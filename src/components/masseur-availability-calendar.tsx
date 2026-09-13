'use client';

import {
	forwardRef,
	FormEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ukLocale from '@fullcalendar/core/locales/uk';
import PhoneInput, { type Country } from 'react-phone-number-input/max';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import { PHONE_COUNTRIES_EU_UA } from '@/lib/phone-countries';
import {
	clampInternationalPhone,
	nationalPhoneInsert,
} from '@/lib/phone';
import {
	getMassageTypeLabel,
	type MassageTypeValue,
} from '@/lib/massage-types';
import {
	masseurBookingCreateSchema,
	NAME_MAX,
	zodErrorCode,
} from '@/lib/validation';

const SLOT_MS = 60 * 60 * 1000;
const DAY_START_HOUR = 5;
const DAY_END_HOUR = 23;
const REPEAT_WEEKS_AHEAD = 12;

export type AvailabilityCalendarHandle = {
	save: () => Promise<boolean>;
};

type SlotStatus = 'available' | 'booked';

type AvailabilitySlot = {
	id: string;
	start: string;
	end: string;
	status: SlotStatus;
	clientName?: string | null;
	clientPhone?: string | null;
	massageType?: string | null;
	bookingId?: string | null;
};

function alignToHourIso(date: Date) {
	const aligned = new Date(date);
	aligned.setMinutes(0, 0, 0);
	return aligned.toISOString();
}

/** Slot can no longer be edited once its start time has begun (e.g. 8:01 for 8:00–9:00). */
function isSlotExpired(startIso: string) {
	const startMs = Date.parse(startIso);
	if (Number.isNaN(startMs)) return false;
	return startMs <= Date.now();
}

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

function fillBookedSlotHint(
	template: string,
	hours: { start: string; end: string },
	details: {
		clientLabel: string;
		clientName: string;
		typeLabel: string;
		massageType: string;
		phoneLabel: string;
		clientPhone: string;
	},
) {
	return fillTimeHint(template, hours.start, hours.end)
		.replaceAll('{client}', `${details.clientLabel}: ${details.clientName}`)
		.replaceAll('{type}', `${details.typeLabel}: ${details.massageType}`)
		.replaceAll('{phone}', `${details.phoneLabel}: ${details.clientPhone}`);
}

/** Slot lanes span the full week; pin the tip to the day column under the pointer. */
function resolveHoverAnchorRect(el: HTMLElement, clientX: number) {
	const elRect = el.getBoundingClientRect();

	if (el.classList.contains('fc-timegrid-slot-lane')) {
		const root = el.closest('.fc');
		if (root) {
			const cols = root.querySelectorAll<HTMLElement>('.fc-timegrid-col.fc-day');
			for (const col of cols) {
				const colRect = col.getBoundingClientRect();
				if (clientX >= colRect.left && clientX < colRect.right) {
					return {
						left: colRect.left,
						top: elRect.top,
						width: colRect.width,
						height: elRect.height,
					};
				}
			}
		}
	}

	return {
		left: elRect.left,
		top: elRect.top,
		width: elRect.width,
		height: elRect.height,
	};
}

function isCurrentWeekRange(fromIso: string, toIso: string) {
	const now = Date.now();
	return now >= new Date(fromIso).getTime() && now < new Date(toIso).getTime();
}

function getWeekSlotStarts(fromIso: string, toIso: string, options?: { fromNow?: boolean }) {
	const starts: string[] = [];
	const cursor = new Date(fromIso);
	cursor.setMinutes(0, 0, 0);
	const endMs = new Date(toIso).getTime();

	let minMs = Number.NEGATIVE_INFINITY;
	if (options?.fromNow) {
		const nowAligned = new Date();
		nowAligned.setMinutes(0, 0, 0);
		minMs = nowAligned.getTime();
	}

	while (cursor.getTime() < endMs) {
		const hour = cursor.getHours();
		if (hour >= DAY_START_HOUR && hour < DAY_END_HOUR && cursor.getTime() >= minMs) {
			starts.push(cursor.toISOString());
		}
		cursor.setHours(cursor.getHours() + 1);
	}

	return starts;
}

function mergeSlotsWithPending(
	serverSlots: AvailabilitySlot[],
	pending: Map<string, boolean>,
	fromIso: string,
	toIso: string,
	bookedStarts: Set<string>,
) {
	const fromMs = new Date(fromIso).getTime();
	const toMs = new Date(toIso).getTime();
	const byStart = new Map(serverSlots.map(slot => [slot.start, slot]));

	for (const [start, active] of pending) {
		const time = new Date(start).getTime();
		if (Number.isNaN(time) || time < fromMs || time >= toMs) continue;
		if (bookedStarts.has(start)) continue;

		if (active) {
			if (!byStart.has(start)) {
				byStart.set(start, {
					id: `draft-${start}`,
					start,
					end: new Date(time + SLOT_MS).toISOString(),
					status: 'available',
					clientName: null,
					clientPhone: null,
					massageType: null,
				});
			}
		} else {
			byStart.delete(start);
		}
	}

	return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export type AvailabilityCalendarProps = {
	massageTypes?: MassageTypeValue[];
};

export const MasseurAvailabilityCalendar = forwardRef<
	AvailabilityCalendarHandle,
	AvailabilityCalendarProps
>(function MasseurAvailabilityCalendar({ massageTypes = [] }, ref) {
		const { t, locale } = useLanguage();
		const calendarRef = useRef<FullCalendar | null>(null);
		const [serverSlots, setServerSlots] = useState<AvailabilitySlot[]>([]);
		const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(() => new Map());
		const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [loading, setLoading] = useState(false);
	const [repeating, setRepeating] = useState(false);
	const [hoverTip, setHoverTip] = useState<{
		text: string;
		x: number;
		y: number;
	} | null>(null);
	const [slotAction, setSlotAction] = useState<{
		startIso: string;
		mode: 'choose' | 'book' | 'booked';
		clientName?: string | null;
		clientPhone?: string | null;
		massageType?: string | null;
	} | null>(null);
	const [bookName, setBookName] = useState('');
	const [bookPhone, setBookPhone] = useState<string | undefined>();
	const [bookPhoneCountry, setBookPhoneCountry] = useState<Country>('UA');
	const [bookMassageType, setBookMassageType] = useState('');
	const [bookPending, setBookPending] = useState(false);
	const [resolvePending, setResolvePending] = useState(false);

	const showSlotTip = useCallback((text: string, el: HTMLElement, clientX: number) => {
		const rect = resolveHoverAnchorRect(el, clientX);
		setHoverTip({
			text,
			x: rect.left + rect.width / 2,
			y: rect.top,
		});
	}, []);

	const hideSlotTip = useCallback(() => {
		setHoverTip(null);
	}, []);

	const emptyHintRef = useRef(t.availabilitySlotEmptyHint);
	emptyHintRef.current = t.availabilitySlotEmptyHint;
	const localeRef = useRef(locale);
	localeRef.current = locale;
	const showSlotTipRef = useRef(showSlotTip);
	showSlotTipRef.current = showSlotTip;
	const hideSlotTipRef = useRef(hideSlotTip);
	hideSlotTipRef.current = hideSlotTip;

	const pendingChangesRef = useRef(pendingChanges);
	pendingChangesRef.current = pendingChanges;

		const bookedStarts = useMemo(
			() =>
				new Set(serverSlots.filter(slot => slot.status === 'booked').map(slot => slot.start)),
			[serverSlots],
		);
		const bookedStartsRef = useRef(bookedStarts);
		bookedStartsRef.current = bookedStarts;

		const rangeRef = useRef(range);
		rangeRef.current = range;

		const showRepeatButton = useMemo(
			() => (range ? isCurrentWeekRange(range.from, range.to) : false),
			[range],
		);

		const viewTitle = useMemo(() => {
			if (!range) return '';
			return formatWeekTitle(range.from, range.to, locale);
		}, [range, locale]);

		const weekSlotStarts = useMemo(
			() => (range ? getWeekSlotStarts(range.from, range.to, { fromNow: true }) : []),
			[range],
		);

		const slots = useMemo(() => {
			if (!range) return [];
			return mergeSlotsWithPending(
				serverSlots,
				pendingChanges,
				range.from,
				range.to,
				bookedStarts,
			);
		}, [serverSlots, pendingChanges, range, bookedStarts]);

		const slotsRef = useRef(slots);
		slotsRef.current = slots;

		const allWeekAvailable = useMemo(() => {
			if (weekSlotStarts.length === 0) return false;
			const active = new Set(slots.map(slot => slot.start));
			return weekSlotStarts.every(start => active.has(start));
		}, [weekSlotStarts, slots]);

		const events = useMemo(
			() =>
				slots.map(slot => {
					const booked = slot.status === 'booked';
					const hours = formatHourRange(
						new Date(slot.start),
						new Date(slot.end),
						locale,
					);
					const clientName = slot.clientName?.trim() || '—';
					const clientPhone = slot.clientPhone?.trim() || '—';
					const massageType = slot.massageType?.trim()
						? getMassageTypeLabel(slot.massageType, locale)
						: '—';
					const label = booked
						? slot.clientName
							? `${t.availabilityBookedSlotLabel}: ${slot.clientName}`
							: t.availabilityBookedSlotLabel
						: t.availabilitySlotLabel;
					const hint = booked
						? fillBookedSlotHint(t.availabilitySlotBookedHint, hours, {
								clientLabel: t.availabilityBookClientName,
								clientName,
								typeLabel: t.bookingMassageType,
								massageType,
								phoneLabel: t.availabilityBookClientPhone,
								clientPhone,
							})
						: fillTimeHint(
								t.availabilitySlotAvailableHint,
								hours.start,
								hours.end,
							);
					return {
						id: slot.id,
						start: slot.start,
						end: slot.end,
						title: label,
						display: 'block' as const,
						classNames: booked ? ['fc-event-booked'] : ['fc-event-available'],
						borderColor: 'transparent',
						extendedProps: {
							hint,
							startIso: slot.start,
							clientName: slot.clientName ?? null,
							clientPhone: slot.clientPhone ?? null,
							massageType: slot.massageType ?? null,
							booked,
						},
					};
				}),
			[
				slots,
				locale,
				t.availabilitySlotLabel,
				t.availabilityBookedSlotLabel,
				t.availabilitySlotAvailableHint,
				t.availabilitySlotBookedHint,
				t.availabilityBookClientName,
				t.availabilityBookClientPhone,
				t.bookingMassageType,
			],
		);

		const loadSlots = useCallback(
			async (from: string, to: string) => {
				setLoading(true);
				try {
					const response = await fetch(
						`/api/masseur/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
					);
					if (!response.ok) {
						toast.error(t.availabilityLoadError);
						return;
					}
					const data = (await response.json()) as {
						slots?: Array<{
							id: string;
							start: string;
							end: string;
							status?: SlotStatus;
							clientName?: string | null;
							clientPhone?: string | null;
							massageType?: string | null;
							bookingId?: string | null;
						}>;
					};
					setServerSlots(
						(data.slots ?? []).map(slot => ({
							id: slot.id,
							start: slot.start,
							end: slot.end,
							status: slot.status === 'booked' ? 'booked' : 'available',
							clientName: slot.clientName ?? null,
							clientPhone: slot.clientPhone ?? null,
							massageType: slot.massageType ?? null,
							bookingId: slot.bookingId ?? null,
						})),
					);
				} catch {
					toast.error(t.availabilityLoadError);
				} finally {
					setLoading(false);
				}
			},
			[t.availabilityLoadError],
		);

		useEffect(() => {
			if (!range) return;
			void loadSlots(range.from, range.to);
		}, [range, loadSlots]);

		function toggleSlot(startIso: string) {
			if (bookedStarts.has(startIso)) {
				toast.error(t.availabilitySlotBookedLocked);
				return;
			}
			if (isSlotExpired(startIso)) {
				toast.error(t.availabilityBookSlotPast);
				return;
			}

			const isActive = slots.some(slot => slot.start === startIso);
			setPendingChanges(current => {
				const next = new Map(current);
				next.set(startIso, !isActive);
				return next;
			});
		}

		function openAvailableSlotActions(startIso: string) {
			if (bookedStarts.has(startIso)) {
				openBookedSlotActions(startIso);
				return;
			}
			if (isSlotExpired(startIso)) {
				toast.error(t.availabilityBookSlotPast);
				return;
			}
			hideSlotTip();
			setBookName('');
			setBookPhone(undefined);
			setBookPhoneCountry('UA');
			setBookMassageType('');
			setSlotAction({ startIso, mode: 'choose' });
		}

		function openBookedSlotActions(startIso: string) {
			if (isSlotExpired(startIso)) {
				toast.error(t.availabilityBookSlotPast);
				return;
			}
			const slot = slotsRef.current.find(item => item.start === startIso);
			hideSlotTip();
			setSlotAction({
				startIso,
				mode: 'booked',
				clientName: slot?.clientName ?? null,
				clientPhone: slot?.clientPhone ?? null,
				massageType: slot?.massageType ?? null,
			});
		}

		function resolveSlotStartIso(date: Date) {
			const aligned = alignToHourIso(date);
			const exact = slotsRef.current.find(slot => slot.start === aligned);
			if (exact) return exact.start;

			const time = date.getTime();
			const covering = slotsRef.current.find(slot => {
				const start = Date.parse(slot.start);
				return (
					!Number.isNaN(start) &&
					time >= start - 1000 &&
					time < start + SLOT_MS
				);
			});
			return covering?.start ?? aligned;
		}

		function closeSlotAction() {
			if (bookPending || resolvePending) return;
			setSlotAction(null);
		}

		function makeSlotUnavailable() {
			if (!slotAction || slotAction.mode === 'booked') return;
			const startIso = slotAction.startIso;
			if (isSlotExpired(startIso)) {
				toast.error(t.availabilityBookSlotPast);
				setSlotAction(null);
				return;
			}
			setSlotAction(null);
			setPendingChanges(current => {
				const next = new Map(current);
				next.set(startIso, false);
				return next;
			});
		}

		async function resolveBookedSlot(availability: 'available' | 'unavailable') {
			if (!slotAction || slotAction.mode !== 'booked' || resolvePending) return;
			if (isSlotExpired(slotAction.startIso)) {
				toast.error(t.availabilityBookSlotPast);
				setSlotAction(null);
				return;
			}

			setResolvePending(true);
			try {
				const response = await fetch('/api/masseur/bookings/resolve', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						slotStart: slotAction.startIso,
						availability,
					}),
				});
				if (!response.ok) {
					const data = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					if (data.error === 'slot_unavailable') {
						toast.error(t.availabilityBookSlotPast);
					} else {
						toast.error(t.availabilityBookedResolveError);
					}
					return;
				}

				setPendingChanges(current => {
					const next = new Map(current);
					next.delete(slotAction.startIso);
					return next;
				});
				setSlotAction(null);
				toast.success(
					availability === 'available'
						? t.availabilityBookedResolveSuccessAvailable
						: t.availabilityBookedResolveSuccessUnavailable,
				);
				const currentRange = rangeRef.current;
				if (currentRange) {
					await loadSlots(currentRange.from, currentRange.to);
				}
			} catch {
				toast.error(t.availabilityBookedResolveError);
			} finally {
				setResolvePending(false);
			}
		}

		async function submitClientBooking(event: FormEvent<HTMLFormElement>) {
			event.preventDefault();
			if (!slotAction) return;

			const parsed = masseurBookingCreateSchema.safeParse({
				clientName: bookName,
				clientPhone: bookPhone ?? '',
				slotStart: slotAction.startIso,
				massageType: massageTypes.length > 0 ? bookMassageType : undefined,
			});
			if (!parsed.success) {
				const code = zodErrorCode(parsed.error);
				if (code === 'invalid_phone') {
					toast.error(t.bookingInvalidPhone);
				} else if (code === 'invalid_massage_type' || massageTypes.length > 0 && !bookMassageType) {
					toast.error(t.bookingMassageTypeRequired);
				} else {
					toast.error(t.availabilityBookClientNameRequired);
				}
				return;
			}

			setBookPending(true);
			try {
				const response = await fetch('/api/masseur/bookings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(parsed.data),
				});
				if (!response.ok) {
					const data = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					if (data.error === 'slot_taken') {
						toast.error(t.bookingSlotTaken);
					} else if (data.error === 'slot_unavailable') {
						toast.error(t.availabilityBookSlotPast);
					} else if (data.error === 'invalid_phone') {
						toast.error(t.bookingInvalidPhone);
					} else if (data.error === 'invalid_massage_type') {
						toast.error(t.bookingMassageTypeRequired);
					} else if (
						data.error === 'unauthorized' ||
						data.error === 'forbidden'
					) {
						toast.error(t.availabilityBookUnauthorized);
					} else {
						toast.error(t.availabilityBookError);
					}
					return;
				}

				setPendingChanges(current => {
					const next = new Map(current);
					next.delete(slotAction.startIso);
					return next;
				});
				setSlotAction(null);
				toast.success(t.availabilityBookSuccess);
				const currentRange = rangeRef.current;
				if (currentRange) {
					await loadSlots(currentRange.from, currentRange.to);
				}
			} catch {
				toast.error(t.availabilityBookError);
			} finally {
				setBookPending(false);
			}
		}

		function setAllWeekAvailable(active: boolean) {
			setPendingChanges(current => {
				const next = new Map(current);
				for (const start of weekSlotStarts) {
					if (bookedStarts.has(start)) continue;
					next.set(start, active);
				}
				return next;
			});
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

		async function persistPendingChanges() {
			const booked = bookedStartsRef.current;
			const changes = [...pendingChangesRef.current.entries()]
				.filter(([start]) => !booked.has(start))
				.map(([start, active]) => ({ start, active }));

			if (changes.length === 0) return true;

			const response = await fetch('/api/masseur/availability', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ changes }),
			});

			if (!response.ok) {
				toast.error(t.availabilitySaveError);
				return false;
			}

			setPendingChanges(new Map());
			return true;
		}

		async function repeatCurrentWeek() {
			if (!range || !showRepeatButton || repeating || loading) return;

			const confirmed = window.confirm(t.availabilityRepeatConfirm);
			if (!confirmed) return;

			const template = slotsRef.current.map(slot => slot.start);
			if (template.length === 0) {
				toast.error(t.availabilityRepeatEmpty);
				return;
			}

			setRepeating(true);
			try {
				// Persist draft toggles first so this week and copies stay in sync.
				const saved = await persistPendingChanges();
				if (!saved) return;

				const response = await fetch('/api/masseur/availability', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						from: range.from,
						to: range.to,
						weeksAhead: REPEAT_WEEKS_AHEAD,
						template,
					}),
				});

				if (!response.ok) {
					toast.error(t.availabilityRepeatError);
					return;
				}

				toast.success(t.availabilityRepeatSuccess);
				await loadSlots(range.from, range.to);
			} catch {
				toast.error(t.availabilityRepeatError);
			} finally {
				setRepeating(false);
			}
		}

		useImperativeHandle(ref, () => ({
			async save() {
				try {
					const saved = await persistPendingChanges();
					if (!saved) return false;

					const currentRange = rangeRef.current;
					if (currentRange) {
						await loadSlots(currentRange.from, currentRange.to);
					}
					return true;
				} catch {
					toast.error(t.availabilitySaveError);
					return false;
				}
			},
		}));

		return (
			<section className='mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'>
				<div className='mb-4 text-left'>
					<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
						{t.availabilityTitle}
					</h2>
					<p className='mt-1 text-sm text-muted'>{t.availabilitySupport}</p>
				</div>

				<div className={`AvailabilityCalendar ${loading || repeating ? 'opacity-80' : ''}`}>
					<div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
						<div className='flex w-full flex-col items-stretch gap-3'>
							<div className='flex flex-wrap items-start justify-between gap-3'>
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
										disabled={showRepeatButton}
										className='AvailabilityCalendarNavBtn AvailabilityCalendarNavBtnWide disabled:cursor-not-allowed disabled:opacity-45'
									>
										{t.availabilityToday}
									</button>
								</div>

								<h3 className='pt-1 text-base font-bold text-foreground sm:text-lg'>
									{viewTitle}
								</h3>
							</div>

							<div className='mt-2 mb-3 flex min-h-11 w-full flex-wrap items-center justify-between gap-3'>
								<label className='flex cursor-pointer items-center gap-2 py-1 text-sm text-foreground'>
									<input
										type='checkbox'
										checked={allWeekAvailable}
										onChange={event => setAllWeekAvailable(event.target.checked)}
										className='h-4 w-4 accent-[var(--accent)]'
									/>
									<span>{t.availabilityMarkAllWeek}</span>
								</label>

								<div
									className={`group relative shrink-0 ${showRepeatButton ? '' : 'invisible pointer-events-none'}`}
									aria-hidden={!showRepeatButton}
								>
									<button
										type='button'
										disabled={!showRepeatButton || loading || repeating}
										title={t.availabilityRepeatHint}
										aria-describedby='availability-repeat-hint'
										tabIndex={showRepeatButton ? 0 : -1}
										onClick={() => void repeatCurrentWeek()}
										className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent disabled:opacity-60'
									>
										{repeating ? t.authPleaseWait : t.availabilityRepeat}
									</button>
									<span
										id='availability-repeat-hint'
										role='tooltip'
										className='pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-surface-border bg-background px-3 py-2 text-left text-xs leading-relaxed text-muted opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100'
									>
										{t.availabilityRepeatHint}
									</span>
								</div>
							</div>
						</div>
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
						slotLaneDidMount={arg => {
							if (!arg.date) return;
							const start = new Date(arg.date);
							start.setMinutes(0, 0, 0);
							const end = new Date(start.getTime() + SLOT_MS);
							const hours = formatHourRange(start, end, localeRef.current);
							const text = fillTimeHint(
								emptyHintRef.current,
								hours.start,
								hours.end,
							);

							const onMove = (e: MouseEvent) =>
								showSlotTipRef.current(text, arg.el, e.clientX);
							const onLeave = () => hideSlotTipRef.current();
							arg.el.addEventListener('mouseenter', onMove);
							arg.el.addEventListener('mousemove', onMove);
							arg.el.addEventListener('mouseleave', onLeave);
						}}
						eventDidMount={info => {
							const hint = info.event.extendedProps.hint;
							if (typeof hint === 'string' && hint) {
								const onMove = (e: MouseEvent) =>
									showSlotTipRef.current(hint, info.el, e.clientX);
								const onLeave = () => hideSlotTipRef.current();
								info.el.addEventListener('mouseenter', onMove);
								info.el.addEventListener('mousemove', onMove);
								info.el.addEventListener('mouseleave', onLeave);
							}

							if (
								!info.el.classList.contains('fc-event-available') &&
								!info.el.classList.contains('fc-event-booked')
							) {
								return;
							}
							const main = info.el.querySelector('.fc-event-main');
							if (!main || main.querySelector('.fc-event-edit-icon')) return;
							const icon = document.createElement('span');
							icon.className = 'fc-event-edit-icon';
							icon.setAttribute('aria-hidden', 'true');
							main.appendChild(icon);
						}}
						datesSet={arg => {
							hideSlotTip();
							const from = arg.start.toISOString();
							const to = arg.end.toISOString();
							setRange(current => {
								if (current?.from === from && current?.to === to) return current;
								return { from, to };
							});
						}}
						select={arg => {
							arg.view.calendar.unselect();
							const startIso = resolveSlotStartIso(arg.start);
							if (bookedStartsRef.current.has(startIso)) {
								openBookedSlotActions(startIso);
								return;
							}
							const isActive = slotsRef.current.some(slot => slot.start === startIso);
							if (isActive) {
								openAvailableSlotActions(startIso);
								return;
							}
							toggleSlot(startIso);
						}}
						eventClick={arg => {
							const fromProps = arg.event.extendedProps.startIso;
							const startIso =
								typeof fromProps === 'string' && fromProps
									? fromProps
									: resolveSlotStartIso(arg.event.start ?? new Date());
							if (
								arg.el.classList.contains('fc-event-booked') ||
								arg.event.extendedProps.booked
							) {
								openBookedSlotActions(startIso);
								return;
							}
							openAvailableSlotActions(startIso);
						}}
						eventTextColor='#ffffff'
						eventBorderColor='transparent'
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

				{slotAction ? (
					<div
						className='fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4'
						role='presentation'
						onClick={closeSlotAction}
					>
						<div
							role='dialog'
							aria-modal='true'
							aria-labelledby='availability-slot-action-title'
							className='w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]'
							onClick={event => event.stopPropagation()}
						>
							{(() => {
								const start = new Date(slotAction.startIso);
								const end = new Date(start.getTime() + SLOT_MS);
								const hours = formatHourRange(start, end, locale);
								const dayLabel = new Intl.DateTimeFormat(
									locale === 'uk' ? 'uk-UA' : 'en-GB',
									{
										weekday: 'short',
										day: 'numeric',
										month: 'short',
									},
								).format(start);
								return (
									<>
										<p
											id='availability-slot-action-title'
											className='text-base font-medium text-foreground'
										>
											{slotAction.mode === 'book'
												? t.availabilityBookForClient
												: slotAction.mode === 'booked'
													? t.availabilityBookedSlotActionTitle
													: t.availabilitySlotActionTitle}
										</p>
										<p className='mt-1 text-sm text-muted'>
											{dayLabel}, {hours.start} - {hours.end}
										</p>
										{slotAction.mode === 'booked' ? (
											<div className='mt-2 space-y-0.5 text-sm text-muted'>
												{slotAction.clientName?.trim() ? (
													<p>
														{t.availabilityBookClientName}:{' '}
														{slotAction.clientName.trim()}
													</p>
												) : null}
												{slotAction.massageType?.trim() ? (
													<p>
														{t.bookingMassageType}:{' '}
														{getMassageTypeLabel(
															slotAction.massageType,
															locale,
														)}
													</p>
												) : null}
												{slotAction.clientPhone?.trim() ? (
													<p>
														{t.availabilityBookClientPhone}:{' '}
														{slotAction.clientPhone.trim()}
													</p>
												) : null}
											</div>
										) : null}
									</>
								);
							})()}

							{slotAction.mode === 'booked' ? (
								<div className='mt-5 flex flex-col gap-2'>
									<button
										type='button'
										disabled={resolvePending}
										onClick={() => void resolveBookedSlot('available')}
										className='flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
									>
										{resolvePending
											? t.authPleaseWait
											: t.availabilityMakeAvailable}
									</button>
									<button
										type='button'
										disabled={resolvePending}
										onClick={() => void resolveBookedSlot('unavailable')}
										className='flex h-11 w-full items-center justify-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
									>
										{t.availabilityMakeUnavailable}
									</button>
									<button
										type='button'
										disabled={resolvePending}
										onClick={closeSlotAction}
										className='mt-1 flex h-10 w-full items-center justify-center text-sm text-muted transition hover:text-foreground disabled:opacity-60'
									>
										{t.availabilityBookCancel}
									</button>
								</div>
							) : slotAction.mode === 'choose' ? (
								<div className='mt-5 flex flex-col gap-2'>
									<button
										type='button'
										onClick={makeSlotUnavailable}
										className='flex h-11 w-full items-center justify-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40'
									>
										{t.availabilityMakeUnavailable}
									</button>
									<button
										type='button'
										onClick={() =>
											setSlotAction(current =>
												current ? { ...current, mode: 'book' } : current,
											)
										}
										className='flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90'
									>
										{t.availabilityBookForClient}
									</button>
									<button
										type='button'
										onClick={closeSlotAction}
										className='mt-1 flex h-10 w-full items-center justify-center text-sm text-muted transition hover:text-foreground'
									>
										{t.availabilityBookCancel}
									</button>
								</div>
							) : (
								<form onSubmit={submitClientBooking} className='mt-5 space-y-3' noValidate>
									{massageTypes.length > 0 ? (
										<label className='block text-left'>
											<span className='mb-1.5 block text-sm text-muted'>
												{t.bookingMassageType}
											</span>
											<select
												required
												value={bookMassageType}
												onChange={event => setBookMassageType(event.target.value)}
												className='h-11 w-full text-foreground'
											>
												<option value=''>{t.bookingMassageTypePlaceholder}</option>
												{massageTypes.map(id => (
													<option key={id} value={id}>
														{getMassageTypeLabel(id, locale)}
													</option>
												))}
											</select>
										</label>
									) : null}

									<label className='block text-left'>
										<span className='mb-1.5 block text-sm text-muted'>
											{t.availabilityBookClientName}
										</span>
										<input
											required
											type='text'
											value={bookName}
											maxLength={NAME_MAX}
											onChange={event => setBookName(event.target.value)}
											className='h-11 w-full rounded-lg border border-surface-border bg-background px-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
										/>
									</label>

									<label className='block text-left'>
										<span className='mb-1.5 block text-sm text-muted'>
											{t.availabilityBookClientPhone}
										</span>
										<PhoneInput
											international
											countryCallingCodeEditable={false}
											defaultCountry='UA'
											countries={[...PHONE_COUNTRIES_EU_UA]}
											addInternationalOption={false}
											flags={flags}
											limitMaxLength
											value={bookPhone}
											onChange={value =>
												setBookPhone(
													clampInternationalPhone(value, bookPhoneCountry),
												)
											}
											onCountryChange={country => {
												if (!country) return;
												setBookPhoneCountry(country);
												setBookPhone(current =>
													clampInternationalPhone(current, country),
												);
											}}
											className='PhoneInputField'
											numberInputProps={{
												name: 'tel',
												autoComplete: 'tel',
												required: true,
												className:
													'PhoneInputInput h-11 w-full rounded-lg border-0 bg-transparent pr-3 pl-1.5 text-foreground outline-none',
												onBeforeInput: (event: FormEvent<HTMLInputElement>) => {
													const inserted =
														(event.nativeEvent as InputEvent).data ?? '';
													const input = event.currentTarget;
													const start =
														input.selectionStart ?? input.value.length;
													const end =
														input.selectionEnd ?? input.value.length;
													const next = nationalPhoneInsert(
														input.value,
														start,
														end,
														inserted,
														bookPhoneCountry,
													);
													if (!next.exceeds) return;
													event.preventDefault();
													setBookPhone(next.value);
												},
											}}
										/>
									</label>

									<div className='flex flex-wrap justify-end gap-2 pt-2'>
										<button
											type='button'
											disabled={bookPending}
											onClick={() =>
												setSlotAction(current =>
													current ? { ...current, mode: 'choose' } : current,
												)
											}
											className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
										>
											{t.availabilityBookBack}
										</button>
										<button
											type='submit'
											disabled={bookPending}
											className='h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
										>
											{bookPending ? t.authPleaseWait : t.availabilityBookSubmit}
										</button>
									</div>
								</form>
							)}
						</div>
					</div>
				) : null}

				{!loading && slots.length === 0 ? (
					<p className='mt-3 text-sm text-muted'>{t.availabilityEmptyWeek}</p>
				) : null}
			</section>
		);
	},
);
