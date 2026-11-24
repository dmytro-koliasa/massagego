import type { Dictionary } from '@/lib/i18n';
import type { CanonicalCity } from '@/lib/city';
import { cityDisplayName, isCanonicalCity } from '@/lib/city';
import type { Profile } from './types';

export function cityFromProfile(profile: Profile): CanonicalCity | null {
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

export function cityLabelFromProfile(profile: Profile, locale: 'en' | 'uk') {
	return (
		profile.cityLabel?.trim() ||
		cityDisplayName(profile, locale) ||
		profile.city?.trim() ||
		''
	);
}

export function mapPhotoError(code: string | undefined, t: Dictionary) {
	switch (code) {
		case 'invalid_type':
			return t.profilePhotoInvalidType;
		case 'too_large':
			return t.profilePhotoTooLarge;
		default:
			return t.profileSaveError;
	}
}