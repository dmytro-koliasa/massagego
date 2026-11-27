import type { Dictionary } from '@/lib/i18n';
import {
	BOOKING_LEAD_HOURS_OPTIONS,
	CANCEL_CUTOFF_HOURS_OPTIONS,
	REMINDER_HOURS_OPTIONS,
	type BookingLeadHours,
	type CancelCutoffHours,
	type ReminderHours,
} from '@/lib/booking-constants';
import type { ResolvedReminderHours } from '@/lib/booking-reminder';

export type BookingRulesSectionProps = {
	t: Dictionary;
	bookingLeadHours: BookingLeadHours;
	onBookingLeadHoursChange: (value: BookingLeadHours) => void;
	cancelCutoffHours: CancelCutoffHours;
	onCancelCutoffHoursChange: (value: CancelCutoffHours) => void;
	reminderHours: ResolvedReminderHours;
	onReminderHoursChange: (value: ResolvedReminderHours) => void;
	bookingRulesPending: boolean;
	onSaveBookingRules: () => void;
};

export function BookingRulesSection({
	t,
	bookingLeadHours,
	onBookingLeadHoursChange,
	cancelCutoffHours,
	onCancelCutoffHoursChange,
	reminderHours,
	onReminderHoursChange,
	bookingRulesPending,
	onSaveBookingRules,
}: BookingRulesSectionProps) {
	return (
		<section className='mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8'>
			<div className='mb-6 text-left'>
				<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
					{t.bookingRulesTitle}
				</h2>
				<p className='mt-2 text-sm text-muted'>{t.bookingRulesSupport}</p>
			</div>

			<div className='grid gap-5 sm:grid-cols-2'>
				<label className='block text-left'>
					<span className='mb-1.5 block text-sm text-muted'>{t.bookingLeadHoursLabel}</span>
					<select
						value={bookingLeadHours}
						onChange={event => {
							const next = Number(event.target.value) as BookingLeadHours;
							onBookingLeadHoursChange(next);
							if (cancelCutoffHours < next) {
								onCancelCutoffHoursChange(next);
							}
						}}
						className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
					>
						{BOOKING_LEAD_HOURS_OPTIONS.map(hours => (
							<option key={hours} value={hours}>
								{t.bookingRulesHours.replaceAll('{n}', String(hours))}
							</option>
						))}
					</select>
					<span className='mt-1.5 block text-xs text-muted'>{t.bookingLeadHoursSupport}</span>
				</label>

				<label className='block text-left'>
					<span className='mb-1.5 block text-sm text-muted'>{t.cancelCutoffHoursLabel}</span>
					<select
						value={cancelCutoffHours}
						onChange={event =>
							onCancelCutoffHoursChange(Number(event.target.value) as CancelCutoffHours)
						}
						className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
					>
						{CANCEL_CUTOFF_HOURS_OPTIONS.filter(hours => hours >= bookingLeadHours).map(
							hours => (
								<option key={hours} value={hours}>
									{t.bookingRulesHours.replaceAll('{n}', String(hours))}
								</option>
							),
						)}
					</select>
					<span className='mt-1.5 block text-xs text-muted'>{t.cancelCutoffHoursSupport}</span>
				</label>

				<label className='block text-left sm:col-span-2'>
					<span className='mb-1.5 block text-sm text-muted'>{t.reminderHoursLabel}</span>
					<select
						value={reminderHours === null ? 'off' : String(reminderHours)}
						onChange={event => {
							const raw = event.target.value;
							if (raw === 'off') {
								onReminderHoursChange(null);
								return;
							}
							onReminderHoursChange(Number(raw) as ReminderHours);
						}}
						className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)] sm:max-w-md'
					>
						<option value='off'>{t.reminderHoursOff}</option>
						{REMINDER_HOURS_OPTIONS.map(hours => (
							<option key={hours} value={hours}>
								{t.bookingRulesHours.replaceAll('{n}', String(hours))}
							</option>
						))}
					</select>
					<span className='mt-1.5 block text-xs text-muted'>{t.reminderHoursSupport}</span>
				</label>
			</div>

			<div className='mt-5'>
				<button
					type='button'
					disabled={bookingRulesPending}
					onClick={onSaveBookingRules}
					className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60'
				>
					{bookingRulesPending ? t.authPleaseWait : t.bookingRulesSave}
				</button>
			</div>
		</section>
	);
}