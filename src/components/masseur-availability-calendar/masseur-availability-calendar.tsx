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
import luxonPlugin from '@fullcalendar/luxon3';
import ukLocale from '@fullcalendar/core/locales/uk';
import type { Country } from 'react-phone-number-input/max';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';
import { ReportUserDialog } from '@/components/report-user-dialog';
import { getMassageTypeLabel } from '@/lib/massage-types';
import { masseurBookingCreateSchema, zodErrorCode } from '@/lib/validation';
import {
	CALENDAR_SLOT_DURATION,
	CALENDAR_SLOT_MAX_TIME,
	CALENDAR_SLOT_MIN_TIME,
	DEFAULT_MASSEUR_TIME_ZONE,
	SLOT_MS,
	WEEKLY_COPY_DEFAULT_WEEKS,
} from '@/lib/booking-constants';
import {
	alignToHourIso,
	formatCalendarTimeZoneLine,
	formatHourRange,
	formatWeekTitle,
	getWeekSlotStarts,
} from '@/lib/calendar-time';
import { displayBookingClientName } from '@/lib/deleted-user';
import {
	isWithinClientBookingWindow,
	resolveTimeZone,
} from '@/lib/masseur-time';

import { SlotActionDialog } from './slot-action-dialog';
import {
	waitUntil,
	isSlotExpired,
	fillTimeHint,
	fillBookedSlotHint,
	resolveHoverAnchorRect,
	isCurrentWeekRange,
	mergeSlotsWithPending,
} from './helpers';
import {
	type AvailabilityCalendarHandle,
	type AvailabilityCalendarProps,
	type AvailabilitySlot,
	type LastCancellation,
	type SlotActionState,
	type SlotStatus,
} from './types';
export const MasseurAvailabilityCalendar = forwardRef<
	AvailabilityCalendarHandle,
	AvailabilityCalendarProps
>(function MasseurAvailabilityCalendar({ massageTypes = [] }, ref) {
		const { t, locale } = useLanguage();
		const calendarRef = useRef<FullCalendar | null>(null);
		const [serverSlots, setServerSlots] = useState<AvailabilitySlot[]>([]);
		const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(() => new Map());
		const [timeZone, setTimeZone] = useState(DEFAULT_MASSEUR_TIME_ZONE);
		const timeZoneRef = useRef(timeZone);
		timeZoneRef.current = timeZone;
		const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [loading, setLoading] = useState(false);
	const [highlightStartIso, setHighlightStartIso] = useState<string | null>(null);
	const [repeating, setRepeating] = useState(false);
	const [hoverTip, setHoverTip] = useState<{
		text: string;
		x: number;
		y: number;
	} | null>(null);
	const [slotAction, setSlotAction] = useState<SlotActionState | null>(null);
	const [bookName, setBookName] = useState('');
	const [bookPhone, setBookPhone] = useState<string | undefined>();
	const [bookPhoneCountry, setBookPhoneCountry] = useState<Country>('UA');
	const [bookMassageType, setBookMassageType] = useState('');
	const [bookPending, setBookPending] = useState(false);
	const [resolvePending, setResolvePending] = useState(false);
	const [reportBookingId, setReportBookingId] = useState<string | null>(null);

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
			return formatWeekTitle(range.from, range.to, locale, timeZone);
		}, [range, locale, timeZone]);

		const timeZoneLine = useMemo(
			() => formatCalendarTimeZoneLine(t.calendarTimeZoneLabel, timeZone),
			[t.calendarTimeZoneLabel, timeZone],
		);

		const weekSlotStarts = useMemo(
			() =>
				range
					? getWeekSlotStarts(range.from, range.to, timeZone, { fromNow: true })
					: [],
			[range, timeZone],
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
					const beyondClientWindow = !isWithinClientBookingWindow(
						new Date(slot.start),
						timeZone,
					);
					const hours = formatHourRange(
						new Date(slot.start),
						new Date(slot.end),
						locale,
						timeZone,
					);
					const clientName = slot.clientName?.trim()
						? displayBookingClientName(
								slot.clientName,
								locale === 'uk' ? 'uk' : 'en',
							)
						: '—';
					const clientPhone = slot.clientPhone?.trim() || '—';
					const massageType = slot.massageType?.trim()
						? getMassageTypeLabel(slot.massageType, locale)
						: '—';
					const label = booked
						? slot.clientName
							? `${t.availabilityBookedSlotLabel}: ${clientName}`
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
					const classNames = [
						booked ? 'fc-event-booked' : 'fc-event-available',
						...(beyondClientWindow ? ['fc-event-beyond-window'] : []),
						...(highlightStartIso === slot.start
							? ['fc-event-deep-link-pulse']
							: []),
					];
					return {
						id: slot.id,
						start: slot.start,
						end: slot.end,
						title: label,
						display: 'block' as const,
						classNames,
						borderColor: 'transparent',
						extendedProps: {
							hint,
							startIso: slot.start,
							clientName: slot.clientName ?? null,
							clientPhone: slot.clientPhone ?? null,
							clientPhoneConfirmed: Boolean(slot.clientPhoneConfirmed),
							massageType: slot.massageType ?? null,
							booked,
							beyondClientWindow,
						},
					};
				}),
			[
				slots,
				locale,
				timeZone,
				highlightStartIso,
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
						timezone?: string;
						slots?: Array<{
							id: string;
							start: string;
							end: string;
							status?: SlotStatus;
							clientName?: string | null;
							clientPhone?: string | null;
							clientPhoneConfirmed?: boolean;
							massageType?: string | null;
							bookingId?: string | null;
							clientUserId?: string | null;
							lastCancellation?: LastCancellation | null;
						}>;
					};
					if (typeof data.timezone === 'string') {
						setTimeZone(resolveTimeZone(data.timezone));
					}
					setServerSlots(
						(data.slots ?? []).map(slot => ({
							id: slot.id,
							start: slot.start,
							end: slot.end,
							status: slot.status === 'booked' ? 'booked' : 'available',
							clientName: slot.clientName ?? null,
							clientPhone: slot.clientPhone ?? null,
							clientPhoneConfirmed: Boolean(slot.clientPhoneConfirmed),
							massageType: slot.massageType ?? null,
							bookingId: slot.bookingId ?? null,
							clientUserId: slot.clientUserId ?? null,
							lastCancellation: slot.lastCancellation ?? null,
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
			const slot = slotsRef.current.find(item => item.start === startIso);
			setSlotAction({
				startIso,
				mode: 'choose',
				lastCancellation: slot?.lastCancellation ?? null,
			});
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
				clientPhoneConfirmed: Boolean(slot?.clientPhoneConfirmed),
				massageType: slot?.massageType ?? null,
				bookingId: slot?.bookingId ?? null,
				clientUserId: slot?.clientUserId ?? null,
				lastCancellation: slot?.lastCancellation ?? null,
			});
		}

		function openSlotDetailsForDeepLink(startIso: string, slot: AvailabilitySlot) {
			hideSlotTip();
			if (slot.status === 'booked') {
				setSlotAction({
					startIso,
					mode: 'booked',
					clientName: slot.clientName ?? null,
					clientPhone: slot.clientPhone ?? null,
					clientPhoneConfirmed: Boolean(slot.clientPhoneConfirmed),
					massageType: slot.massageType ?? null,
					bookingId: slot.bookingId ?? null,
					clientUserId: slot.clientUserId ?? null,
					lastCancellation: slot.lastCancellation ?? null,
				});
				return;
			}
			setBookName('');
			setBookPhone(undefined);
			setBookPhoneCountry('UA');
			setBookMassageType('');
			setSlotAction({
				startIso,
				mode: 'choose',
				lastCancellation: slot.lastCancellation ?? null,
			});
		}

		async function focusSlot(
			rawIso: string,
		): Promise<'found' | 'missing' | 'invalid'> {
			const parsed = Date.parse(rawIso);
			if (Number.isNaN(parsed)) return 'invalid';

			const ready = await waitUntil(
				() => Boolean(calendarRef.current?.getApi()),
				5000,
			);
			if (!ready) return 'invalid';

			const startIso = alignToHourIso(new Date(parsed), timeZoneRef.current);
			const api = calendarRef.current?.getApi();
			if (!api) return 'invalid';

			document
				.getElementById('masseur-availability')
				?.scrollIntoView({ behavior: 'smooth', block: 'start' });

			api.gotoDate(startIso);

			const inRange = await waitUntil(() => {
				const current = rangeRef.current;
				if (!current) return false;
				const time = Date.parse(startIso);
				return (
					time >= Date.parse(current.from) && time < Date.parse(current.to)
				);
			}, 8000);
			if (!inRange || !rangeRef.current) return 'missing';

			await loadSlots(rangeRef.current.from, rangeRef.current.to);

			const slot = slotsRef.current.find(item => item.start === startIso);
			if (!slot) return 'missing';

			setHighlightStartIso(startIso);
			window.setTimeout(() => {
				setHighlightStartIso(current =>
					current === startIso ? null : current,
				);
			}, 2500);

			openSlotDetailsForDeepLink(startIso, slot);
			return 'found';
		}

		function resolveSlotStartIso(date: Date) {
			const aligned = alignToHourIso(date, timeZoneRef.current);
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
				if (code === 'phone_country_excluded') {
					toast.error(t.bookingPhoneCountryExcluded);
				} else if (code === 'invalid_phone') {
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
					} else if (data.error === 'out_of_hours') {
						toast.error(t.availabilityOutOfHours);
					} else if (data.error === 'slot_unavailable') {
						toast.error(t.availabilityBookSlotPast);
					} else if (data.error === 'phone_country_excluded') {
						toast.error(t.bookingPhoneCountryExcluded);
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
				const data = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				if (data.error === 'out_of_hours') {
					toast.error(t.availabilityOutOfHours);
				} else if (data.error === 'slot_in_past') {
					toast.error(t.availabilityBookSlotPast);
				} else {
					toast.error(t.availabilitySaveError);
				}
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
						weeksAhead: WEEKLY_COPY_DEFAULT_WEEKS,
						template,
					}),
				});

				if (!response.ok) {
					const data = (await response.json().catch(() => ({}))) as {
						error?: string;
					};
					toast.error(
						data.error === 'out_of_hours'
							? t.availabilityRepeatOutOfHours
							: t.availabilityRepeatError,
					);
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
			async reload() {
				const currentRange = rangeRef.current;
				if (currentRange) {
					await loadSlots(currentRange.from, currentRange.to);
				}
			},
			focusSlot,
		}));

		return (
			<section
				id='masseur-availability'
				className='mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'
			>
				<div className='mb-4 text-left'>
					<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
						{t.availabilityTitle}
					</h2>
					<p className='mt-1 text-sm text-muted'>{t.availabilitySupport}</p>
					<p className='mt-1 text-xs text-muted'>{t.sessionsHistoryHint}</p>
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
										aria-label={t.calendarPreviousWeek}
									>
										‹
									</button>
									<button
										type='button'
										onClick={goToNext}
										className='AvailabilityCalendarNavBtn'
										aria-label={t.calendarNextWeek}
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

								<div className='pt-1 text-right'>
									<h3 className='text-base font-bold text-foreground sm:text-lg'>
										{viewTitle}
									</h3>
									<p className='mt-0.5 text-xs text-muted'>{timeZoneLine}</p>
								</div>
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
							const start = new Date(
								alignToHourIso(new Date(arg.date), timeZoneRef.current),
							);
							const end = new Date(start.getTime() + SLOT_MS);
							const hours = formatHourRange(
								start,
								end,
								localeRef.current,
								timeZoneRef.current,
							);
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
					<SlotActionDialog
						slotAction={slotAction}
						bookPending={bookPending}
						resolvePending={resolvePending}
						bookName={bookName}
						setBookName={setBookName}
						bookPhone={bookPhone}
						setBookPhone={setBookPhone}
						bookPhoneCountry={bookPhoneCountry}
						setBookPhoneCountry={setBookPhoneCountry}
						bookMassageType={bookMassageType}
						setBookMassageType={setBookMassageType}
						massageTypes={massageTypes}
						locale={locale}
						t={t}
						timeZone={timeZone}
						closeSlotAction={closeSlotAction}
						makeSlotUnavailable={makeSlotUnavailable}
						resolveBookedSlot={resolveBookedSlot}
						submitClientBooking={submitClientBooking}
						setSlotAction={setSlotAction}
						setReportBookingId={setReportBookingId}
					/>
				) : null}

				{!loading && slots.length === 0 ? (
					<p className='mt-3 text-sm text-muted'>{t.availabilityEmptyWeek}</p>
				) : null}

				{reportBookingId ? (
					<ReportUserDialog
						bookingId={reportBookingId}
						portal="masseur"
						open
						onClose={() => setReportBookingId(null)}
					/>
				) : null}
			</section>
		);
	},
);
