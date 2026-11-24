import type { MassageTypeValue } from '@/lib/massage-types';

export type AvailabilityCalendarHandle = {
	save: () => Promise<boolean>;
	reload: () => Promise<void>;
	/** Deep-link helper: goto week, open details if present, pulse. */
	focusSlot: (slotIso: string) => Promise<'found' | 'missing' | 'invalid'>;
};

export type SlotStatus = 'available' | 'booked';

export type LastCancellation = {
	reason: string;
	reasonText: string | null;
	cancelledAt: string;
};

export type AvailabilitySlot = {
	id: string;
	start: string;
	end: string;
	status: SlotStatus;
	clientName?: string | null;
	clientPhone?: string | null;
	clientPhoneConfirmed?: boolean;
	massageType?: string | null;
	bookingId?: string | null;
	clientUserId?: string | null;
	lastCancellation?: LastCancellation | null;
};

export type SlotActionState = {
	startIso: string;
	mode: 'choose' | 'book' | 'booked';
	clientName?: string | null;
	clientPhone?: string | null;
	clientPhoneConfirmed?: boolean;
	massageType?: string | null;
	bookingId?: string | null;
	clientUserId?: string | null;
	lastCancellation?: LastCancellation | null;
};

export type AvailabilityCalendarProps = {
	massageTypes?: MassageTypeValue[];
};