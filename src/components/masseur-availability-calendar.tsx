'use client';

import {
	forwardRef,
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
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

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
};

function alignToHourIso(date: Date) {
	const aligned = new Date(date);
	aligned.setMinutes(0, 0, 0);
	return aligned.toISOString();
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
				});
			}
		} else {
			byStart.delete(start);
		}
	}

	return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export const MasseurAvailabilityCalendar = forwardRef<AvailabilityCalendarHandle, object>(
	function MasseurAvailabilityCalendar(_, ref) {
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
					const label = booked
						? slot.clientName
							? `${t.availabilityBookedSlotLabel}: ${slot.clientName}`
							: t.availabilityBookedSlotLabel
						: t.availabilitySlotLabel;
					const hint = booked
						? `${label} ${hours.start} - ${hours.end}`
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
						extendedProps: { hint },
					};
				}),
			[
				slots,
				locale,
				t.availabilitySlotLabel,
				t.availabilityBookedSlotLabel,
				t.availabilitySlotAvailableHint,
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
						}>;
					};
					setServerSlots(
						(data.slots ?? []).map(slot => ({
							id: slot.id,
							start: slot.start,
							end: slot.end,
							status: slot.status === 'booked' ? 'booked' : 'available',
							clientName: slot.clientName ?? null,
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

			const isActive = slots.some(slot => slot.start === startIso);
			setPendingChanges(current => {
				const next = new Map(current);
				next.set(startIso, !isActive);
				return next;
			});
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
							if (typeof hint !== 'string' || !hint) return;

							const onMove = (e: MouseEvent) =>
								showSlotTipRef.current(hint, info.el, e.clientX);
							const onLeave = () => hideSlotTipRef.current();
							info.el.addEventListener('mouseenter', onMove);
							info.el.addEventListener('mousemove', onMove);
							info.el.addEventListener('mouseleave', onLeave);
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
							toggleSlot(alignToHourIso(arg.start));
						}}
						eventClick={arg => {
							toggleSlot(alignToHourIso(arg.event.start ?? new Date()));
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

				{!loading && slots.length === 0 ? (
					<p className='mt-3 text-sm text-muted'>{t.availabilityEmptyWeek}</p>
				) : null}
			</section>
		);
	},
);
