'use client';

import type { Country } from 'react-phone-number-input/max';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import PhoneInput from 'react-phone-number-input/max';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import { ModalDialog } from '@/components/modal-dialog';
import { PHONE_COUNTRIES_ALLOWED } from '@/lib/phone-countries';
import {
	clampInternationalPhone,
	nationalPhoneInsert,
} from '@/lib/phone';
import { getMassageTypeLabel, type MassageTypeValue } from '@/lib/massage-types';
import { NAME_MAX } from '@/lib/validation';
import { SLOT_MS } from '@/lib/booking-constants';
import { formatHourRange } from '@/lib/calendar-time';
import { displayBookingClientName } from '@/lib/deleted-user';
import { isWithinClientBookingWindow } from '@/lib/masseur-time';
import type { Dictionary, Locale } from '@/lib/i18n';
import { isSlotExpired } from './helpers';
import type { SlotActionState } from './types';

export type SlotActionDialogProps = {
	slotAction: SlotActionState;
	bookPending: boolean;
	resolvePending: boolean;
	bookName: string;
	setBookName: Dispatch<SetStateAction<string>>;
	bookPhone: string | undefined;
	setBookPhone: Dispatch<SetStateAction<string | undefined>>;
	bookPhoneCountry: Country;
	setBookPhoneCountry: Dispatch<SetStateAction<Country>>;
	bookMassageType: string;
	setBookMassageType: Dispatch<SetStateAction<string>>;
	massageTypes: MassageTypeValue[];
	locale: Locale;
	t: Dictionary;
	timeZone: string;
	closeSlotAction: () => void;
	makeSlotUnavailable: () => void;
	resolveBookedSlot: (
		availability: 'available' | 'unavailable',
	) => void | Promise<void>;
	submitClientBooking: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
	setSlotAction: Dispatch<SetStateAction<SlotActionState | null>>;
	setReportBookingId: Dispatch<SetStateAction<string | null>>;
};

export function SlotActionDialog({
	slotAction,
	bookPending,
	resolvePending,
	bookName,
	setBookName,
	bookPhone,
	setBookPhone,
	bookPhoneCountry,
	setBookPhoneCountry,
	bookMassageType,
	setBookMassageType,
	massageTypes,
	locale,
	t,
	timeZone,
	closeSlotAction,
	makeSlotUnavailable,
	resolveBookedSlot,
	submitClientBooking,
	setSlotAction,
	setReportBookingId,
}: SlotActionDialogProps) {
	return (
		<ModalDialog
			open
			onClose={closeSlotAction}
			closeDisabled={bookPending || resolvePending}
			labelledBy='availability-slot-action-title'
			overlayClassName='fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4'
			panelClassName='w-full max-w-sm rounded-xl border border-surface-border bg-background p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]'
		>
			{(() => {
				const start = new Date(slotAction.startIso);
				const end = new Date(start.getTime() + SLOT_MS);
				const hours = formatHourRange(start, end, locale, timeZone);
				const dayLabel = new Intl.DateTimeFormat(
					locale === 'uk' ? 'uk-UA' : 'en-GB',
					{
						timeZone,
						weekday: 'short',
						day: 'numeric',
						month: 'short',
					},
				).format(start);
				const slotExpiredNotice = isSlotExpired(slotAction.startIso);
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
						{!isWithinClientBookingWindow(start, timeZone) ? (
							<p className='mt-2 text-sm text-muted'>
								{t.availabilityNotYetVisibleToClients}
							</p>
						) : null}
						{slotExpiredNotice ? (
							<p className='mt-2 text-sm text-muted'>
								{t.availabilityBookSlotPast}
							</p>
						) : null}
						{slotAction.mode === 'booked' ? (
							<div className='mt-2 space-y-0.5 text-sm text-muted'>
								{slotAction.clientName?.trim() ? (
									<p>
										{t.availabilityBookClientName}:{' '}
										{displayBookingClientName(
											slotAction.clientName,
											locale === 'uk' ? 'uk' : 'en',
										)}
										{slotAction.clientPhoneConfirmed ? (
											<span className='ml-2 inline-flex items-center gap-1 text-xs font-medium text-foreground'>
												<span aria-hidden='true'>✓</span>
												{t.phoneConfirmedBadge}
											</span>
										) : null}
									</p>
								) : null}
								{slotAction.massageType?.trim() ? (
									<p>
										{t.bookingMassageType}:{' '}
										{getMassageTypeLabel(slotAction.massageType, locale)}
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
						{slotAction.lastCancellation ? (
							<p className='mt-2 text-sm text-muted'>
								{t.availabilityLastCancellation}:{' '}
								{(() => {
									const key =
										`cancelReason_${slotAction.lastCancellation.reason}` as keyof typeof t;
									const label =
										typeof t[key] === 'string'
											? (t[key] as string)
											: slotAction.lastCancellation.reason;
									const other =
										slotAction.lastCancellation.reason === 'other' &&
										slotAction.lastCancellation.reasonText?.trim()
											? `: ${slotAction.lastCancellation.reasonText.trim()}`
											: '';
									return `${label}${other}`;
								})()}
							</p>
						) : null}
					</>
				);
			})()}

			{slotAction.mode === 'booked' ? (
				<div className='mt-5 flex flex-col gap-2'>
					<button
						type='button'
						disabled={resolvePending || isSlotExpired(slotAction.startIso)}
						onClick={() => void resolveBookedSlot('available')}
						className='flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
					>
						{resolvePending ? t.authPleaseWait : t.availabilityMakeAvailable}
					</button>
					<button
						type='button'
						disabled={resolvePending || isSlotExpired(slotAction.startIso)}
						onClick={() => void resolveBookedSlot('unavailable')}
						className='flex h-11 w-full items-center justify-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
					>
						{t.availabilityMakeUnavailable}
					</button>
					{slotAction.bookingId && slotAction.clientUserId ? (
						<button
							type='button'
							disabled={resolvePending}
							onClick={() => {
								const bookingId = slotAction.bookingId;
								if (!bookingId) return;
								setSlotAction(null);
								setReportBookingId(bookingId);
							}}
							className='flex h-11 w-full items-center justify-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
						>
							{t.complaintReportAction}
						</button>
					) : null}
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
						disabled={isSlotExpired(slotAction.startIso)}
						onClick={makeSlotUnavailable}
						className='flex h-11 w-full items-center justify-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/40 disabled:opacity-60'
					>
						{t.availabilityMakeUnavailable}
					</button>
					<button
						type='button'
						disabled={isSlotExpired(slotAction.startIso)}
						onClick={() =>
							setSlotAction(current =>
								current ? { ...current, mode: 'book' } : current,
							)
						}
						className='flex h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
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
							countries={[...PHONE_COUNTRIES_ALLOWED]}
							addInternationalOption={false}
							flags={flags}
							limitMaxLength
							value={bookPhone}
							onChange={value =>
								setBookPhone(clampInternationalPhone(value, bookPhoneCountry))
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
									const start = input.selectionStart ?? input.value.length;
									const end = input.selectionEnd ?? input.value.length;
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
		</ModalDialog>
	);
}