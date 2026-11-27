'use client';

import { Suspense, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { Country } from 'react-phone-number-input/max';
import { useLanguage } from '@/components/language-provider';
import {
	getMassageTypeLabel,
	hasSameMassageTypeLabel,
	makeCustomMassageType,
	MASSAGE_TYPE_IDS,
	type MassageTypeValue,
} from '@/lib/massage-types';
import {
	MasseurAvailabilityCalendar,
	type AvailabilityCalendarHandle,
} from '@/components/masseur-availability-calendar';
import { DeleteAccountSection } from '@/components/delete-account-section';
import { MasseurGallery } from '@/components/masseur-gallery';
import { MasseurBulkCancel } from '@/components/masseur-bulk-cancel';
import { MasseurRecentCancellations } from '@/components/masseur-recent-cancellations';
import { MasseurSlotDeepLink } from '@/components/masseur-slot-deep-link';
import { NotificationNavLink } from '@/components/notification-nav-link';
import {
	DEFAULT_MASSEUR_TIME_ZONE,
	type BookingLeadHours,
	type CancelCutoffHours,
} from '@/lib/booking-constants';
import { resolveBookingSettings } from '@/lib/booking-settings';
import type { ResolvedReminderHours } from '@/lib/booking-reminder';
import type { CanonicalCity } from '@/lib/city';
import { deviceTimeZone } from '@/lib/timezone';
import { portalRequestHeaders } from '@/lib/portals';
import { masseurProfileSchema, zodErrorCode } from '@/lib/validation';
import { cityFromProfile, cityLabelFromProfile, mapPhotoError } from './helpers';
import type { DashboardViewProps, Profile } from './types';
import { EmailVerifyBanner } from './email-verify-banner';
import { ProfileGeneralSection } from './profile-general-section';
import { ProfileAddressSection } from './profile-address-section';
import { BookingRulesSection } from './booking-rules-section';

export function DashboardView({ profile }: DashboardViewProps) {
	const { t, locale } = useLanguage();
	const { update: updateSession } = useSession();
	const availabilityRef = useRef<AvailabilityCalendarHandle>(null);
	const initialSettings = resolveBookingSettings(profile);
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
	const [resendPending, setResendPending] = useState(false);
	const emailVerified = Boolean(profile.emailVerified);
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

	async function resendVerification() {
		setResendPending(true);
		try {
			const response = await fetch('/api/auth/verify-email/resend', {
				method: 'POST',
				headers: portalRequestHeaders('masseur'),
			});
			if (!response.ok) {
				toast.error(t.profileSaveError);
				return;
			}
			toast.success(t.authVerifyEmailSent);
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setResendPending(false);
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
						<NotificationNavLink href='/masseur/notifications' portal='masseur' />
					</p>
				</div>

				{!emailVerified ? (
					<EmailVerifyBanner
						t={t}
						resendPending={resendPending}
						onResend={() => void resendVerification()}
					/>
				) : null}

				<ProfileGeneralSection
					t={t}
					locale={locale}
					email={profile.email}
					displayName={displayName}
					initials={initials}
					image={image}
					photoPending={photoPending}
					photoModalOpen={photoModalOpen}
					onPhotoModalOpenChange={setPhotoModalOpen}
					onSaveProfilePhoto={saveProfilePhoto}
					onDeletePhoto={() => void deletePhoto()}
					nameLocale={nameLocale}
					onNameLocaleChange={setNameLocale}
					nameEn={nameEn}
					onNameEnChange={setNameEn}
					nameUk={nameUk}
					onNameUkChange={setNameUk}
					descriptionLocale={descriptionLocale}
					onDescriptionLocaleChange={setDescriptionLocale}
					descriptionEn={descriptionEn}
					onDescriptionEnChange={setDescriptionEn}
					descriptionUk={descriptionUk}
					onDescriptionUkChange={setDescriptionUk}
					massageTypes={massageTypes}
					onToggleMassageType={toggleMassageType}
					customMassageType={customMassageType}
					onCustomMassageTypeChange={setCustomMassageType}
					onAddCustomMassageType={addCustomMassageType}
					slug={slug}
					saveErrorMessage={t.profileSaveError}
				/>

				<ProfileAddressSection
					t={t}
					locale={locale}
					phone={phone}
					onPhoneChange={setPhone}
					phoneCountry={phoneCountry}
					onPhoneCountryChange={setPhoneCountry}
					timezone={timezone}
					onTimezoneChange={setTimezone}
					showTimezoneMismatch={showTimezoneMismatch}
					showAddressForm={showAddressForm}
					hasSavedAddress={hasSavedAddress}
					editingAddress={editingAddress}
					city={city}
					onCityChange={setCity}
					onSelectCity={applyCitySelection}
					address={address}
					onAddressChange={setAddress}
					savedCity={savedCity}
					savedAddress={savedAddress}
					addressPending={addressPending}
					onSaveAddress={() => void saveAddress()}
					onCancelEditAddress={cancelEditAddress}
					onStartEditAddress={startEditAddress}
				/>

				<BookingRulesSection
					t={t}
					bookingLeadHours={bookingLeadHours}
					onBookingLeadHoursChange={setBookingLeadHours}
					cancelCutoffHours={cancelCutoffHours}
					onCancelCutoffHoursChange={setCancelCutoffHours}
					reminderHours={reminderHours}
					onReminderHoursChange={setReminderHours}
					bookingRulesPending={bookingRulesPending}
					onSaveBookingRules={() => void saveBookingRules()}
				/>

				<MasseurGallery editable />

				<MasseurBulkCancel
					onCancelled={() => {
						void availabilityRef.current?.reload();
					}}
				/>

				<MasseurAvailabilityCalendar
					ref={availabilityRef}
					massageTypes={massageTypes}
				/>
				<Suspense fallback={null}>
					<MasseurSlotDeepLink calendarRef={availabilityRef} />
				</Suspense>

				<MasseurRecentCancellations timeZone={timezone} />

				<DeleteAccountSection portal='masseur' />
			</div>

			<div className='fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-background/90 py-3 backdrop-blur-md'>
				<div className='mx-auto flex w-full max-w-6xl flex-wrap items-center justify-start gap-3 px-[15px]'>
					<button
						type='button'
						disabled={pending}
						onClick={() => void saveProfile()}
						className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60'
					>
						{pending ? t.authPleaseWait : t.profileSave}
					</button>
				</div>
			</div>
		</main>
	);
}