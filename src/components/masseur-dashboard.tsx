'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import PhoneInput, { type Country } from 'react-phone-number-input/max';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';
import { useLanguage } from '@/components/language-provider';
import {
	getCustomMassageTypes,
	getMassageTypeLabel,
	hasSameMassageTypeLabel,
	makeCustomMassageType,
	MASSAGE_TYPE_IDS,
	CUSTOM_MASSAGE_TYPE_MAX_LENGTH,
	type MassageTypeValue,
} from '@/lib/massage-types';
import {
	MasseurAvailabilityCalendar,
	type AvailabilityCalendarHandle,
} from '@/components/masseur-availability-calendar';
import { DeleteAccountSection } from '@/components/delete-account-section';
import { GalleryCropModal } from '@/components/gallery-crop-modal';
import { MasseurGallery } from '@/components/masseur-gallery';
import { MasseurBulkCancel } from '@/components/masseur-bulk-cancel';
import { MasseurRecentCancellations } from '@/components/masseur-recent-cancellations';
import { NotificationNavLink } from '@/components/notification-nav-link';
import { CityAutocomplete } from '@/components/city-autocomplete';
import {
	BOOKING_LEAD_HOURS_OPTIONS,
	CANCEL_CUTOFF_HOURS_OPTIONS,
	DEFAULT_MASSEUR_TIME_ZONE,
	REMINDER_HOURS_OPTIONS,
	type BookingLeadHours,
	type CancelCutoffHours,
	type ReminderHours,
} from '@/lib/booking-constants';
import { resolveBookingSettings } from '@/lib/booking-settings';
import type { ResolvedReminderHours } from '@/lib/booking-reminder';
import type { CanonicalCity } from '@/lib/city';
import { cityDisplayName, isCanonicalCity } from '@/lib/city';
import {
	clampInternationalPhone,
	nationalPhoneInsert,
} from '@/lib/phone';
import { PHONE_COUNTRIES_ALLOWED } from '@/lib/phone-countries';
import { deviceTimeZone } from '@/lib/timezone';
import {
	ADDRESS_MAX,
	DESCRIPTION_MAX,
	NAME_MAX,
	masseurProfileSchema,
	zodErrorCode,
} from '@/lib/validation';
import { shouldSkipImageOptimization } from '@/lib/upload-url';

type Profile = {
	id: string;
	name: string | null;
	nameEn: string | null;
	nameUk: string | null;
	slug: string | null;
	email: string;
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

function cityFromProfile(profile: Profile): CanonicalCity | null {
	const candidate = {
		placeId: profile.cityPlaceId ?? '',
		countryCode: profile.cityCountryCode ?? '',
		nameEn: profile.cityNameEn ?? profile.city ?? '',
		nameUk: profile.cityNameUk ?? profile.city ?? '',
		lat: profile.cityLat,
		lon: profile.cityLon,
	};
	return isCanonicalCity(candidate) ? candidate : null;
}

function cityLabelFromProfile(profile: Profile, locale: 'en' | 'uk') {
	return (
		profile.cityLabel?.trim() ||
		cityDisplayName(profile, locale) ||
		profile.city?.trim() ||
		''
	);
}

export function DashboardView({ profile }: { profile: Profile }) {
	const { t, locale } = useLanguage();
	const { update: updateSession } = useSession();
	const availabilityRef = useRef<AvailabilityCalendarHandle>(null);
	const [bulkCancelAutoOpen, setBulkCancelAutoOpen] = useState(false);
	const initialSettings = resolveBookingSettings(profile);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.location.hash === '#bulk-cancel') {
			setBulkCancelAutoOpen(true);
		}
	}, []);
	const initialCity = cityFromProfile(profile);
	const initialCityLabel = cityLabelFromProfile(profile, locale);
	const [nameEn, setNameEn] = useState(profile.nameEn ?? profile.name ?? '');
	const [nameUk, setNameUk] = useState(profile.nameUk ?? '');
	const [descriptionEn, setDescriptionEn] = useState(profile.descriptionEn ?? '');
	const [descriptionUk, setDescriptionUk] = useState(profile.descriptionUk ?? '');
	const [massageTypes, setMassageTypes] = useState<MassageTypeValue[]>(profile.massageTypes);
	const [customMassageType, setCustomMassageType] = useState('');
	const [savedCity, setSavedCity] = useState(initialCityLabel);
	const [savedCityObj, setSavedCityObj] = useState<CanonicalCity | null>(initialCity);
	const [savedAddress, setSavedAddress] = useState(profile.address ?? '');
	const [city, setCity] = useState(initialCityLabel);
	const [selectedCity, setSelectedCity] = useState<CanonicalCity | null>(initialCity);
	const [address, setAddress] = useState(profile.address ?? '');
	const [phone, setPhone] = useState<string | undefined>(profile.phone ?? undefined);
	const [phoneCountry, setPhoneCountry] = useState<Country>('UA');
	const [timezone, setTimezone] = useState(
		profile.timezone?.trim() || DEFAULT_MASSEUR_TIME_ZONE,
	);
	const [editingAddress, setEditingAddress] = useState(
		!Boolean(initialCity && profile.address?.trim()),
	);
	const [image, setImage] = useState(profile.image);
	const [slug, setSlug] = useState(profile.slug);
	const [bookingLeadHours, setBookingLeadHours] = useState<BookingLeadHours>(
		initialSettings.bookingLeadHours,
	);
	const [cancelCutoffHours, setCancelCutoffHours] = useState<CancelCutoffHours>(
		initialSettings.cancelCutoffHours,
	);
	const [reminderHours, setReminderHours] = useState<ResolvedReminderHours>(
		initialSettings.reminderHours,
	);
	const [bookingRulesPending, setBookingRulesPending] = useState(false);
	const [nameLocale, setNameLocale] = useState<'en' | 'uk'>('uk');
	const [descriptionLocale, setDescriptionLocale] = useState<'en' | 'uk'>('uk');
	const [pending, setPending] = useState(false);
	const [addressPending, setAddressPending] = useState(false);
	const [photoPending, setPhotoPending] = useState(false);
	const [photoModalOpen, setPhotoModalOpen] = useState(false);

	const hasSavedAddress = Boolean(savedCityObj && savedAddress.trim());
	const showAddressForm = editingAddress || !hasSavedAddress;
	const deviceTz = deviceTimeZone();
	const showTimezoneMismatch = Boolean(timezone && deviceTz && timezone !== deviceTz);

	function applyCitySelection(next: CanonicalCity | null) {
		setSelectedCity(next);
		if (!next) return;
		const suggested = next.timeZone?.trim();
		if (
			suggested &&
			(!timezone.trim() || timezone === DEFAULT_MASSEUR_TIME_ZONE)
		) {
			setTimezone(suggested);
		}
	}

	function syncProfileCityFields(user: Profile) {
		const nextCity = cityFromProfile(user);
		const nextLabel = cityLabelFromProfile(user, locale);
		setSavedCity(nextLabel);
		setSavedCityObj(nextCity);
		setCity(nextLabel);
		setSelectedCity(nextCity);
		setSavedAddress(user.address ?? '');
		setAddress(user.address ?? '');
		setPhone(user.phone ?? undefined);
		setTimezone(user.timezone?.trim() || DEFAULT_MASSEUR_TIME_ZONE);
	}

	function buildProfilePayload(cityObj: CanonicalCity | null, addressValue: string) {
		return masseurProfileSchema.safeParse({
			nameEn,
			nameUk,
			descriptionEn,
			descriptionUk,
			massageTypes,
			city: cityObj,
			address: addressValue,
			phone: phone ?? '',
			timezone,
			preferredLocale: locale,
		});
	}

	function toggleMassageType(id: MassageTypeValue) {
		setMassageTypes(current =>
			current.includes(id) ? current.filter(item => item !== id) : [...current, id],
		);
	}

	function addCustomMassageType() {
		const trimmed = customMassageType.trim().replace(/\s+/g, ' ');
		if (!trimmed) return;

		const matchingPreset = MASSAGE_TYPE_IDS.find(
			id => getMassageTypeLabel(id, locale).toLowerCase() === trimmed.toLowerCase(),
		);

		if (matchingPreset) {
			if (massageTypes.includes(matchingPreset)) {
				toast.error(t.profileMassageTypeCustomExists);
				return;
			}
			setMassageTypes(current => [...current, matchingPreset]);
			setCustomMassageType('');
			return;
		}

		if (hasSameMassageTypeLabel(massageTypes, trimmed, locale)) {
			toast.error(t.profileMassageTypeCustomExists);
			return;
		}

		const next = makeCustomMassageType(trimmed);
		if (!next) return;

		setMassageTypes(current => [...current, next]);
		setCustomMassageType('');
	}

	async function saveProfile() {
		const cityObj = showAddressForm ? selectedCity : savedCityObj;
		const addressToSave = showAddressForm ? address.trim() : savedAddress.trim();
		const parsed = buildProfilePayload(cityObj, addressToSave);

		if (!parsed.success) {
			const code = zodErrorCode(parsed.error);
			toast.error(
				code === 'address_required' ||
					code === 'invalid_type' ||
					!cityObj
					? t.profileAddressRequired
					: code === 'phone_country_excluded'
						? t.authPhoneCountryExcluded
						: code === 'invalid_phone'
							? t.authInvalidPhone
							: t.profileSaveError,
			);
			return;
		}

		setPending(true);

		try {
			const availabilitySaved = await availabilityRef.current?.save();
			if (availabilitySaved === false) {
				return;
			}

			const response = await fetch('/api/masseur/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed.data),
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				toast.error(
					data?.error === 'address_required' ? t.profileAddressRequired : t.profileSaveError,
				);
				return;
			}

			const data = (await response.json()) as { user: Profile };
			setNameEn(data.user.nameEn ?? '');
			setNameUk(data.user.nameUk ?? '');
			setDescriptionEn(data.user.descriptionEn ?? '');
			setDescriptionUk(data.user.descriptionUk ?? '');
			setMassageTypes(data.user.massageTypes ?? []);
			syncProfileCityFields(data.user);
			setSlug(data.user.slug);
			setEditingAddress(false);
			toast.success(t.profileSaved);
			await updateSession();
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setPending(false);
		}
	}

	async function saveAddress() {
		const parsed = buildProfilePayload(selectedCity, address.trim());

		if (!parsed.success) {
			const code = zodErrorCode(parsed.error);
			toast.error(
				!selectedCity || code === 'address_required' || code === 'invalid_type'
					? t.profileAddressRequired
					: code === 'phone_country_excluded'
						? t.authPhoneCountryExcluded
						: code === 'invalid_phone'
							? t.authInvalidPhone
							: t.profileSaveError,
			);
			return;
		}

		setAddressPending(true);

		try {
			const response = await fetch('/api/masseur/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed.data),
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				toast.error(
					data?.error === 'address_required' ? t.profileAddressRequired : t.profileSaveError,
				);
				return;
			}

			const data = (await response.json()) as { user: Profile };
			syncProfileCityFields(data.user);
			setSlug(data.user.slug);
			setEditingAddress(false);
			toast.success(t.profileAddressSaved);
			await updateSession();
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setAddressPending(false);
		}
	}

	async function saveBookingRules() {
		setBookingRulesPending(true);
		try {
			const response = await fetch('/api/masseur/booking-settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookingLeadHours,
					cancelCutoffHours,
					reminderHours,
				}),
			});
			const data = (await response.json().catch(() => null)) as {
				error?: string;
				cutoffRaised?: boolean;
				settings?: {
					bookingLeadHours: BookingLeadHours;
					cancelCutoffHours: CancelCutoffHours;
					reminderHours: ResolvedReminderHours;
				};
			} | null;

			if (!response.ok || !data?.settings) {
				toast.error(t.bookingRulesSaveError);
				return;
			}

			setBookingLeadHours(data.settings.bookingLeadHours);
			setCancelCutoffHours(data.settings.cancelCutoffHours);
			setReminderHours(data.settings.reminderHours);
			if (data.cutoffRaised) {
				toast.success(
					t.bookingRulesCutoffRaised.replaceAll(
						'{n}',
						String(data.settings.cancelCutoffHours),
					),
				);
			} else {
				toast.success(t.bookingRulesSaved);
			}
		} catch {
			toast.error(t.bookingRulesSaveError);
		} finally {
			setBookingRulesPending(false);
		}
	}

	function startEditAddress() {
		setCity(savedCity);
		setSelectedCity(savedCityObj);
		setAddress(savedAddress);
		setEditingAddress(true);
	}

	function cancelEditAddress() {
		setCity(savedCity);
		setSelectedCity(savedCityObj);
		setAddress(savedAddress);
		setEditingAddress(false);
	}

	async function saveProfilePhoto(payload: {
		blob: Blob;
		width: number;
		height: number;
	}) {
		setPhotoPending(true);

		try {
			const formData = new FormData();
			formData.append('photo', payload.blob, 'profile.jpg');

			const response = await fetch('/api/masseur/profile', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				toast.error(mapPhotoError(data.error, t));
				return false;
			}

			const data = (await response.json()) as { user: Profile };
			setImage(data.user.image);
			toast.success(t.profilePhotoUpdated);
			await updateSession();
			return true;
		} catch {
			toast.error(t.profileSaveError);
			return false;
		} finally {
			setPhotoPending(false);
		}
	}

	async function deletePhoto() {
		setPhotoPending(true);

		try {
			const response = await fetch('/api/masseur/profile', {
				method: 'DELETE',
			});

			if (!response.ok) {
				toast.error(t.profileSaveError);
				return;
			}

			const data = (await response.json()) as { user: Profile };
			setImage(data.user.image);
			toast.success(t.profilePhotoRemoved);
			await updateSession();
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setPhotoPending(false);
		}
	}

	const displayName = nameEn || nameUk || profile.email || '?';
	const initials = displayName
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map(part => part[0]?.toUpperCase())
		.join('');

	return (
		<main className='flex flex-1 flex-col bg-background py-10 pb-28'>
			<div className='mx-auto w-full max-w-6xl px-[15px]'>
				<div className='max-w-2xl space-y-3'>
					<h1 className='font-display text-4xl tracking-[-0.03em] text-foreground sm:text-5xl'>
						{t.masseurPageTitle}
					</h1>
					<p>
						<NotificationNavLink href='/masseur/notifications' />
					</p>
				</div>

				<section className='mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8'>
					<div className='mb-6 text-left'>
						<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
							{t.profileGeneralTitle}
						</h2>
					</div>

					<div className='grid gap-8 sm:grid-cols-[220px_1fr]'>
						<div className='mx-auto flex w-full max-w-[220px] flex-col gap-4 sm:mx-0'>
							<button
								type='button'
								disabled={photoPending}
								onClick={() => setPhotoModalOpen(true)}
								aria-label={image ? t.profilePhotoChange : t.profilePhotoAdd}
								className='group relative aspect-square w-full overflow-hidden rounded-xl border border-surface-border bg-accent-soft outline-none transition hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60'
							>
								{image ? (
									<Image
										src={image}
										alt={displayName}
										fill
										sizes='220px'
										className='object-cover'
										unoptimized={shouldSkipImageOptimization(image)}
									/>
								) : (
									<div className='flex h-full w-full items-center justify-center text-3xl font-medium text-accent'>
										{initials}
									</div>
								)}
								<span className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100'>
									<span className='flex h-11 w-11 items-center justify-center rounded-lg border border-white bg-accent/55 text-white'>
										<CameraIcon />
									</span>
								</span>
							</button>

							<div className='flex w-full flex-col gap-2'>
								<button
									type='button'
									disabled={photoPending}
									onClick={() => setPhotoModalOpen(true)}
									className='h-11 w-full rounded-lg bg-accent text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
								>
									{image ? t.profilePhotoChange : t.profilePhotoAdd}
								</button>
								{image ? (
									<button
										type='button'
										disabled={photoPending}
										onClick={deletePhoto}
										className='h-11 w-full rounded-lg border border-surface-border text-sm font-medium text-muted transition hover:border-accent/40 hover:text-foreground disabled:opacity-60'
									>
										{t.profilePhotoDelete}
									</button>
								) : null}
							</div>

							<GalleryCropModal
								open={photoModalOpen}
								pending={photoPending}
								remainingSlots={1}
								multiple={false}
								initialAspect='1:1'
								lockAspect
								title={t.profileCropTitle}
								selectHint={t.gallerySelectPhoto}
								addButtonLabel={image ? t.profilePhotoChange : t.profilePhotoAdd}
								onClose={() => setPhotoModalOpen(false)}
								onSave={saveProfilePhoto}
							/>
						</div>

						<div className='space-y-5'>
							<div className='text-left'>
								<span className='mb-1.5 block text-sm text-muted'>{t.profileName}</span>
								<CompactLangTabs
									ariaLabel={t.profileName}
									value={nameLocale}
									onChange={setNameLocale}
									enLabel={t.english}
									ukLabel={t.ukrainian}
								/>
								<input
									type='text'
									value={nameLocale === 'en' ? nameEn : nameUk}
									onChange={event =>
										nameLocale === 'en'
											? setNameEn(event.target.value)
											: setNameUk(event.target.value)
									}
									placeholder={
										nameLocale === 'en'
											? t.profileNamePlaceholderEn
											: t.profileNamePlaceholderUk
									}
									maxLength={NAME_MAX}
									className='mt-2 h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
								/>
							</div>

							<div className='text-left'>
								<span className='mb-1.5 block text-sm text-muted'>
									{t.profileDescription}
								</span>
								<CompactLangTabs
									ariaLabel={t.profileDescription}
									value={descriptionLocale}
									onChange={setDescriptionLocale}
									enLabel={t.english}
									ukLabel={t.ukrainian}
								/>
								<textarea
									value={descriptionLocale === 'en' ? descriptionEn : descriptionUk}
									onChange={event =>
										descriptionLocale === 'en'
											? setDescriptionEn(event.target.value)
											: setDescriptionUk(event.target.value)
									}
									rows={6}
									maxLength={DESCRIPTION_MAX}
									placeholder={
										descriptionLocale === 'en'
											? t.profileDescriptionPlaceholderEn
											: t.profileDescriptionPlaceholderUk
									}
									className='mt-2 w-full resize-y rounded-lg border border-surface-border bg-background/70 px-4 py-3 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
								/>
							</div>

							<div className='text-left'>
								<h3 className='mb-1 text-xl font-bold tracking-[-0.02em] text-foreground'>
									{t.profileMassageTypes}
								</h3>
								<p className='mb-3 text-sm text-muted'>{t.profileMassageTypesSupport}</p>

								<div className='flex flex-wrap gap-2'>
									{MASSAGE_TYPE_IDS.map(id => {
										const selected = massageTypes.includes(id);
										return (
											<button
												key={id}
												type='button'
												aria-pressed={selected}
												onClick={() => toggleMassageType(id)}
												className={`rounded-lg px-3 py-1.5 text-center text-xs font-medium transition ${
													selected
														? 'bg-accent text-white'
														: 'border border-surface-border bg-background/70 text-foreground hover:border-accent/50 hover:text-accent'
												}`}
											>
												{getMassageTypeLabel(id, locale)}
											</button>
										);
									})}
									{getCustomMassageTypes(massageTypes).map(id => (
										<button
											key={id}
											type='button'
											aria-pressed
											onClick={() => toggleMassageType(id)}
											className='rounded-lg bg-accent px-3 py-1.5 text-center text-xs font-medium text-white transition hover:opacity-90'
										>
											{getMassageTypeLabel(id, locale)}
										</button>
									))}
								</div>

								<div className='mt-3 flex flex-wrap gap-2'>
									<input
										type='text'
										value={customMassageType}
										maxLength={CUSTOM_MASSAGE_TYPE_MAX_LENGTH}
										placeholder={t.profileMassageTypeCustomPlaceholder}
										onChange={event => {
											setCustomMassageType(event.target.value);
										}}
										onKeyDown={event => {
											if (event.key === 'Enter') {
												event.preventDefault();
												addCustomMassageType();
											}
										}}
										className='h-11 min-w-[12rem] flex-1 rounded-lg border border-surface-border bg-background/70 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
									/>
									<button
										type='button'
										onClick={addCustomMassageType}
										className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent'
									>
										{t.profileMassageTypeCustomAdd}
									</button>
								</div>
							</div>

							{slug ? (
								<div className='rounded-lg border border-surface-border bg-background/50 p-4 text-left'>
									<p className='text-sm font-medium text-foreground'>
										{t.profileBookingLinkTitle}
									</p>
									<p className='mt-1 text-sm text-muted'>{t.profileBookingLinkSupport}</p>
									<div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-center'>
										<code className='min-w-0 flex-1 truncate rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-foreground'>
											{`/client/masseur/${slug}`}
										</code>
										<button
											type='button'
											onClick={() => {
												const path = `/client/masseur/${slug}`;
												const url =
													typeof window !== 'undefined'
														? `${window.location.origin}${path}`
														: path;
												void navigator.clipboard.writeText(url).then(
													() => toast.success(t.profileBookingLinkCopied),
													() => toast.error(t.profileSaveError),
												);
											}}
											className='h-11 shrink-0 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent'
										>
											{t.profileBookingLinkCopy}
										</button>
									</div>
								</div>
							) : (
								<p className='text-sm text-muted'>{t.profileBookingLinkMissing}</p>
							)}

							<p className='text-sm text-muted'>{profile.email}</p>
						</div>
					</div>
				</section>

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
								onChange={value =>
									setPhone(clampInternationalPhone(value, phoneCountry))
								}
								onCountryChange={country => {
									if (!country) return;
									setPhoneCountry(country);
									setPhone(current => clampInternationalPhone(current, country));
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
										setPhone(next.value);
									},
								}}
							/>
							<span className='mt-1.5 block text-xs text-muted'>
								{t.profilePhonePublicNotice}
							</span>
						</label>

						<label className='block text-left'>
							<span className='mb-1.5 block text-sm text-muted'>{t.profileTimezone}</span>
							<input
								type='text'
								value={timezone}
								onChange={event => setTimezone(event.target.value)}
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
									onChange={setCity}
									onSelectCity={applyCitySelection}
									label={t.profileCity}
									placeholder={t.profileCityPlaceholder}
									lang={locale === 'en' ? 'en' : 'uk'}
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
										onChange={event => setAddress(event.target.value)}
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
									onClick={() => void saveAddress()}
									className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
								>
									{addressPending ? t.authPleaseWait : t.profileAddressSave}
								</button>
								{hasSavedAddress && editingAddress ? (
									<button
										type='button'
										disabled={addressPending}
										onClick={cancelEditAddress}
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
								onClick={startEditAddress}
								className='h-11 rounded-lg border border-surface-border px-5 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent'
							>
								{t.profileAddressEdit}
							</button>
						</div>
					)}
				</section>

				<section className='mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8'>
					<div className='mb-6 text-left'>
						<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
							{t.bookingRulesTitle}
						</h2>
						<p className='mt-2 text-sm text-muted'>{t.bookingRulesSupport}</p>
					</div>

					<div className='grid gap-5 sm:grid-cols-2'>
						<label className='block text-left'>
							<span className='mb-1.5 block text-sm text-muted'>
								{t.bookingLeadHoursLabel}
							</span>
							<select
								value={bookingLeadHours}
								onChange={event => {
									const next = Number(event.target.value) as BookingLeadHours;
									setBookingLeadHours(next);
									if (cancelCutoffHours < next) {
										setCancelCutoffHours(next);
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
							<span className='mt-1.5 block text-xs text-muted'>
								{t.bookingLeadHoursSupport}
							</span>
						</label>

						<label className='block text-left'>
							<span className='mb-1.5 block text-sm text-muted'>
								{t.cancelCutoffHoursLabel}
							</span>
							<select
								value={cancelCutoffHours}
								onChange={event =>
									setCancelCutoffHours(
										Number(event.target.value) as CancelCutoffHours,
									)
								}
								className='h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
							>
								{CANCEL_CUTOFF_HOURS_OPTIONS.filter(
									hours => hours >= bookingLeadHours,
								).map(hours => (
									<option key={hours} value={hours}>
										{t.bookingRulesHours.replaceAll('{n}', String(hours))}
									</option>
								))}
							</select>
							<span className='mt-1.5 block text-xs text-muted'>
								{t.cancelCutoffHoursSupport}
							</span>
						</label>

						<label className='block text-left sm:col-span-2'>
							<span className='mb-1.5 block text-sm text-muted'>
								{t.reminderHoursLabel}
							</span>
							<select
								value={reminderHours === null ? 'off' : String(reminderHours)}
								onChange={event => {
									const raw = event.target.value;
									if (raw === 'off') {
										setReminderHours(null);
										return;
									}
									setReminderHours(Number(raw) as ReminderHours);
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
							<span className='mt-1.5 block text-xs text-muted'>
								{t.reminderHoursSupport}
							</span>
						</label>
					</div>

					<div className='mt-5'>
						<button
							type='button'
							disabled={bookingRulesPending}
							onClick={() => void saveBookingRules()}
							className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
						>
							{bookingRulesPending ? t.authPleaseWait : t.bookingRulesSave}
						</button>
					</div>
				</section>

				<MasseurGallery editable />

				<MasseurBulkCancel
					autoOpen={bulkCancelAutoOpen}
					onCancelled={() => {
						void availabilityRef.current?.reload();
					}}
				/>

				<MasseurAvailabilityCalendar
					ref={availabilityRef}
					massageTypes={massageTypes}
				/>

				<MasseurRecentCancellations timeZone={timezone} />

				<DeleteAccountSection portal='masseur' />
			</div>

			<div className='fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-background/90 py-3 backdrop-blur-md'>
				<div className='mx-auto flex w-full max-w-6xl flex-wrap items-center justify-start gap-3 px-[15px]'>
					<button
						type='button'
						disabled={pending}
						onClick={() => void saveProfile()}
						className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
					>
						{pending ? t.authPleaseWait : t.profileSave}
					</button>
				</div>
			</div>
		</main>
	);
}

function CompactLangTabs({
	ariaLabel,
	value,
	onChange,
	enLabel,
	ukLabel,
}: {
	ariaLabel: string;
	value: 'en' | 'uk';
	onChange: (value: 'en' | 'uk') => void;
	enLabel: string;
	ukLabel: string;
}) {
	return (
		<div
			role='tablist'
			aria-label={ariaLabel}
			className='inline-flex items-center rounded bg-accent-soft p-0.5'
		>
			<button
				type='button'
				role='tab'
				aria-selected={value === 'uk'}
				onClick={() => onChange('uk')}
				className={`rounded-sm px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] transition ${
					value === 'uk'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted hover:text-foreground'
				}`}
			>
				{ukLabel}
			</button>
			<button
				type='button'
				role='tab'
				aria-selected={value === 'en'}
				onClick={() => onChange('en')}
				className={`rounded-sm px-2.5 py-1 text-[11px] font-medium tracking-[0.06em] transition ${
					value === 'en'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted hover:text-foreground'
				}`}
			>
				{enLabel}
			</button>
		</div>
	);
}

function mapPhotoError(code: string | undefined, t: ReturnType<typeof useLanguage>['t']) {
	switch (code) {
		case 'invalid_type':
			return t.profilePhotoInvalidType;
		case 'too_large':
			return t.profilePhotoTooLarge;
		default:
			return t.profileSaveError;
	}
}

function CameraIcon() {
	return (
		<svg width='22' height='22' viewBox='0 0 24 24' fill='none' aria-hidden>
			<path
				d='M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6A1.5 1.5 0 0 1 10 3.8h4a1.5 1.5 0 0 1 1.2.6L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z'
				stroke='currentColor'
				strokeWidth='1.8'
				strokeLinejoin='round'
			/>
			<circle
				cx='12'
				cy='13'
				r='3.2'
				stroke='currentColor'
				strokeWidth='1.8'
			/>
		</svg>
	);
}
