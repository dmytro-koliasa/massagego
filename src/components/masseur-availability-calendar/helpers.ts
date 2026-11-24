import { SLOT_MS } from '@/lib/booking-constants';
import type { AvailabilitySlot } from './types';

export function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
	return new Promise(resolve => {
		const started = Date.now();
		const tick = () => {
			if (predicate()) {
				resolve(true);
				return;
			}
			if (Date.now() - started >= timeoutMs) {
				resolve(false);
				return;
			}
			window.setTimeout(tick, 40);
		};
		tick();
	});
}

/** Slot can no longer be edited once its start time has begun (e.g. 8:01 for 8:00–9:00). */
export function isSlotExpired(startIso: string) {
	const startMs = Date.parse(startIso);
	if (Number.isNaN(startMs)) return false;
	return startMs <= Date.now();
}

export function fillTimeHint(template: string, start: string, end: string) {
	return template.replaceAll('{start}', start).replaceAll('{end}', end);
}

export function fillBookedSlotHint(
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
export function resolveHoverAnchorRect(el: HTMLElement, clientX: number) {
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
						height: colRect.height,
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

export function isCurrentWeekRange(fromIso: string, toIso: string) {
	const now = Date.now();
	return now >= new Date(fromIso).getTime() && now < new Date(toIso).getTime();
}

export function mergeSlotsWithPending(
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