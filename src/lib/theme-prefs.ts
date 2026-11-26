export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'serein-theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: string | null | undefined): value is Theme {
	return value === 'light' || value === 'dark';
}

export function readThemeCookie(value: string | undefined): Theme {
	return isTheme(value) ? value : 'light';
}
