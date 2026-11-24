import { en } from './en';
import { uk } from './uk';
import type { Locale } from './types';

export type { Locale } from './types';

export const dictionaries = {
	en: en,
	uk: uk,
} as const;

export type Dictionary = (typeof dictionaries)[Locale];
