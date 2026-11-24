import type { MassageTypeValue } from '@/lib/massage-types';
import type {
	BookingLeadHours,
	CancelCutoffHours,
} from '@/lib/booking-constants';
import type { ResolvedReminderHours } from '@/lib/booking-reminder';

export type Profile = {
	id: string;
	name: string | null;
	nameEn: string | null;
	nameUk: string | null;
	slug: string | null;
	email: string;
	emailVerified?: boolean;
	phone: string | null;
	image: string | null;
	descriptionEn: string | null;
	descriptionUk: string | null;
	massageTypes: MassageTypeValue[];
	city: string | null;
	cityPlaceId?: string | null;
	cityCountryCode?: string | null;
	cityNameEn?: string | null;
	cityNameUk?: string | null;
	cityLat?: number | null;
	cityLon?: number | null;
	cityLabel?: string | null;
	address: string | null;
	timezone?: string | null;
	preferredLocale?: string | null;
	bookingLeadHours?: number;
	cancelCutoffHours?: number;
	reminderHours?: number | null;
};

export type DashboardViewProps = {
	profile: Profile;
};

export type BookingRulesState = {
	bookingLeadHours: BookingLeadHours;
	cancelCutoffHours: CancelCutoffHours;
	reminderHours: ResolvedReminderHours;
};