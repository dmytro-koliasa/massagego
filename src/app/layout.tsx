import { cookies } from 'next/headers';
import { Manrope, Unbounded } from 'next/font/google';
import { LanguageProvider } from '@/components/language-provider';
import { ThemeProvider } from '@/components/theme-provider';
import type { Locale } from '@/lib/i18n';
import { rootMetadata } from '@/lib/seo/public-metadata';
import {
	THEME_STORAGE_KEY,
	readThemeCookie,
} from '@/lib/theme-prefs';
import './globals.css';

const display = Unbounded({
	variable: '--font-display-family',
	subsets: ['latin', 'cyrillic'],
	weight: ['500', '600', '700', '800'],
	display: 'swap',
});

const sans = Manrope({
	variable: '--font-sans-family',
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700'],
	display: 'swap',
});

export const metadata = rootMetadata();

const prefsInitScript = `
(() => {
  try {
    // Lock home scroll before first paint (useEffect is too late and shows a gutter scrollbar).
    const isHome = location.pathname === "/";
    if (isHome) {
      document.documentElement.style.overflow = "hidden";
      const lockBody = () => {
        if (document.body) document.body.style.overflow = "hidden";
      };
      lockBody();
      document.addEventListener("DOMContentLoaded", lockBody, { once: true });
    }

    const storedTheme = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.cookie = "${THEME_STORAGE_KEY}=" + theme + ";path=/;max-age=31536000;samesite=lax";

    const storedLocale = localStorage.getItem("serein-locale");
    const locale = storedLocale === "uk" || storedLocale === "en" ? storedLocale : "en";
    document.documentElement.lang = locale === "uk" ? "uk" : "en";
    document.cookie = "serein-locale=" + locale + ";path=/;max-age=31536000;samesite=lax";
  } catch {}
})();
`;

function readLocaleCookie(value: string | undefined): Locale {
	return value === 'uk' || value === 'en' ? value : 'en';
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
	const cookieStore = await cookies();
	const initialLocale = readLocaleCookie(cookieStore.get('serein-locale')?.value);
	const initialTheme = readThemeCookie(cookieStore.get(THEME_STORAGE_KEY)?.value);

	return (
		<html
			lang={initialLocale === 'uk' ? 'uk' : 'en'}
			suppressHydrationWarning
			className={`${display.variable} ${sans.variable} h-full antialiased${
				initialTheme === 'dark' ? ' dark' : ''
			}`}
			style={{ colorScheme: initialTheme }}
		>
			<head>
				<script
					id='serein-prefs-init'
					dangerouslySetInnerHTML={{ __html: prefsInitScript }}
				/>
			</head>
			<body className='flex min-h-dvh flex-col bg-background font-sans text-foreground'>
				<ThemeProvider initialTheme={initialTheme}>
					<LanguageProvider initialLocale={initialLocale}>
						{children}
					</LanguageProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
