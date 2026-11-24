'use client';

import { FormEvent } from 'react';
import PhoneInput, { type Country } from 'react-phone-number-input/max';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import type { Locale, Dictionary } from '@/lib/i18n';
import type { CanonicalCity } from '@/lib/city';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { DEFAULT_MASSEUR_TIME_ZONE } from '@/lib/booking-constants';
import {
	clampInternationalPhone,
	nationalPhoneInsert,
} from '@/lib/phone';
import { PHONE_COUNTRIES_ALLOWED } from '@/lib/phone-countries';
import { ADDRESS_MAX } from '@/lib/validation';

export type ProfileAddressSectionProps = {
	t: Dictionary;
	locale: Locale;
	phone: string | undefined;
	onPhoneChange: (value: string | undefined) => void;
	phoneCountry: Country;
	onPhoneCountryChange: (country: Country) => void;
	timezone: string;
	onTimezoneChange: (value: string) => void;
	showTimezoneMismatch: boolean;
	showAddressForm: boolean;
	hasSavedAddress: boolean;
	editingAddress: boolean;
	city: string;
	onCityChange: (value: string) => void;
	onSelectCity: (city: CanonicalCity | null) => void;
	address: string;
	onAddressChange: (value: string) => void;
	savedCity: string;
	savedAddress: string;
	addressPending: boolean;
	onSaveAddress: () => void;
	onCancelEditAddress: () => void;
	onStartEditAddress: () => void;
};

export function ProfileAddressSection({
	t,
	locale,
	phone,
	onPhoneChange,
	phoneCountry,
	onPhoneCountryChange,
	timezone,
	onTimezoneChange,
	showTimezoneMismatch,
	showAddressForm,
	hasSavedAddress,
	editingAddress,
	city,
	onCityChange,
	onSelectCity,
	address,
	onAddressChange,
	savedCity,
	savedAddress,
	addressPending,
	onSaveAddress,
	onCancelEditAddress,
	onStartEditAddress,
}: ProfileAddressSectionProps) {
	return (
		<section className='mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8'>
			<div className='mb-6 text-left'>
				<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
					{t.profileAddressTitle}
				</h2>
			</div>

			<div className='mb-6 space-y-5'>
				<label className='block text-left'>
					<span className='mb-1.5 block text-sm text-muted'>{t.profilePhone}</span>
					<PhoneInput
						international
						countryCallingCodeEditable={false}
						defaultCountry='UA'
						countries={[...PHONE_COUNTRIES_ALLOWED]}
						addInternationalOption={false}
						flags={flags}
						limitMaxLength
						value={phone}
						onChange={value => onPhoneChange(clampInternationalPhone(value, phoneCountry))}
						onCountryChange={country => {
							if (!country) return;
							onPhoneCountryChange(country);
							onPhoneChange(clampInternationalPhone(phone, country));
						}}
						className='PhoneInputField'
						numberInputProps={{
							name: 'tel',
							autoComplete: 'tel',
							required: true,
							className:
								'PhoneInputInput h-12 w-full rounded-lg border-0 bg-transparent pr-3 pl-1.5 text-foreground outline-none',
							onBeforeInput: (event: FormEvent<HTMLInputElement>) => {
								const inserted = (event.nativeEvent as InputEvent).data ?? '';
								const input = event.currentTarget;
								const start = input.selectionStart ?? input.value.length;
								const end = input.selectionEnd ?? input.value.length;
								const next = nationalPhoneInsert(
									input.value,
									start,
									end,
									inserted,
									phoneCountry,
								);
								if (!next.exceeds) return;
								event.preventDefault();
								onPhoneChange(next.value);
							},
						}}
					/>
					<span className='mt-1.5 block text-xs text-muted'>{t.profilePhonePublicNotice}</span>
				</label>

				<label className='block text-left'>
					<span className='mb-1.5 block text-sm text-muted'>{t.profileTimezone}</span>
					<input
						type='text'
						value={timezone}
						onChange={event => onTimezoneChange(event.target.value)}
						placeholder={DEFAULT_MASSEUR_TIME_ZONE}
						className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
					/>
					{showTimezoneMismatch ? (
						<span className='mt-1.5 block text-xs text-muted'>
							{t.profileTimezoneDeviceMismatch.replaceAll('{profile}', timezone)}
						</span>
					) : null}
				</label>
			</div>

			{showAddressForm ? (
				<div className='space-y-5'>
					<div className='grid gap-5 sm:grid-cols-2'>
						<CityAutocomplete
							value={city}
							onChange={onCityChange}
							onSelectCity={onSelectCity}
							label={t.profileCity}
							placeholder={t.profileCityPlaceholder}
							lang={locale === 'en' ? 'en' : 'uk'}
							portal='masseur'
							required
						/>

						<label className='block text-left sm:col-span-2'>
							<span className='mb-1.5 block text-sm text-muted'>
								{t.profileAddress}
								<span className='text-accent' aria-hidden>
									{' '}
									*
								</span>
							</span>
							<input
								type='text'
								required
								value={address}
								onChange={event => onAddressChange(event.target.value)}
								placeholder={t.profileAddressPlaceholder}
								maxLength={ADDRESS_MAX}
								className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
							/>
						</label>
					</div>

					<div className='flex flex-wrap items-center gap-3'>
						<button
							type='button'
							disabled={addressPending}
							onClick={onSaveAddress}
							className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
						>
							{addressPending ? t.authPleaseWait : t.profileAddressSave}
						</button>
						{hasSavedAddress && editingAddress ? (
							<button
								type='button'
								disabled={addressPending}
								onClick={onCancelEditAddress}
								className='h-11 rounded-lg border border-surface-border px-5 text-sm font-medium text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-60'
							>
								{t.profileAddressCancel}
							</button>
						) : null}
					</div>
				</div>
			) : (
				<div className='space-y-4 text-left'>
					<div>
						<p className='text-sm text-muted'>{t.profileCity}</p>
						<p className='mt-1 text-base text-foreground'>{savedCity}</p>
					</div>
					<div>
						<p className='text-sm text-muted'>{t.profileAddress}</p>
						<p className='mt-1 text-base text-foreground'>{savedAddress}</p>
					</div>
					<button
						type='button'
						onClick={onStartEditAddress}
						className='h-11 rounded-lg border border-surface-border px-5 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent'
					>
						{t.profileAddressEdit}
					</button>
				</div>
			)}
		</section>
	);
}