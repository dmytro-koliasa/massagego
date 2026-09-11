import type { Metadata } from 'next';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { Roboto } from 'next/font/google';
import { AppToaster } from '@/components/app-toaster';
import { LanguageProvider } from '@/components/language-provider';
import { AuthSessionProvider } from '@/components/auth-session-provider';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import type { Locale } from '@/lib/i18n';
import './globals.css';

const roboto = Roboto({
	variable: '--font-roboto',
	subsets: ['latin', 'cyrillic'],
	weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
	title: 'MassageGo — Massage for masseurs and clients',
	description:
		'A calm place for masseurs and clients to meet. Sign in as a masseur for your personal page, or continue as a client.',
};

const prefsInitScript = `
(() => {
  try {
    const storedTheme = localStorage.getItem("serein-theme");
    const theme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;

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

	return (
		<html
			lang={initialLocale === 'uk' ? 'uk' : 'en'}
			suppressHydrationWarning
			className={`${roboto.variable} h-full antialiased`}
		>
			<body className='min-h-full flex flex-col bg-background font-sans text-foreground'>
				<Script id='serein-prefs-init' strategy='beforeInteractive'>
					{prefsInitScript}
				</Script>
				<ThemeProvider>
					<LanguageProvider initialLocale={initialLocale}>
						<AuthSessionProvider>
							<SiteHeader />
							{children}
							<AppToaster />
						</AuthSessionProvider>
					</LanguageProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
