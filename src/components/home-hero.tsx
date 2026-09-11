'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';

const HERO_IMAGE =
	'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=2400&q=80';

export function HomeHero() {
	const { t } = useLanguage();

	return (
		<section className='relative min-h-[calc(100dvh-4rem)] overflow-hidden'>
			<div className='absolute inset-0'>
				<Image
					src={HERO_IMAGE}
					alt={t.heroAlt}
					fill
					priority
					sizes='100vw'
					className='animate-ken-burns object-cover object-center'
				/>
				<div className='absolute inset-0' style={{ background: 'var(--hero-scrim)' }} />
				<div className='animate-soft-pulse absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[var(--glow)] blur-3xl' />
			</div>

			<div className='relative z-10 flex min-h-[calc(100dvh-4rem)] flex-col justify-end pb-10 pt-24 sm:justify-center sm:pb-16'>
				<div className='mx-auto flex w-full max-w-6xl px-[15px]'>
					<div className='flex max-w-2xl flex-col gap-10 lg:max-w-3xl'>
					<div className='space-y-5'>
						<h1
							className='animate-fade-up font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-[-0.03em] text-white'
							style={{ animationDelay: '120ms' }}
						>
							{t.headlineLine1}
							<br />
							{t.headlineLine2}
						</h1>
						<p
							className='animate-fade-up max-w-md text-base leading-relaxed text-white/78 sm:text-lg'
							style={{ animationDelay: '220ms' }}
						>
							{t.heroSupport}
						</p>
					</div>

					<div
						className='animate-fade-up grid gap-3 sm:grid-cols-2 sm:gap-4'
						style={{ animationDelay: '340ms' }}
						role='group'
						aria-label={t.roleGroupLabel}
					>
						<PathLink
							href='/masseur'
							title={t.masseurTitle}
							description={t.masseurDescription}
						/>
						<PathLink
							href='/client'
							title={t.clientTitle}
							description={t.clientDescription}
						/>
					</div>
				</div>
				</div>
			</div>
		</section>
	);
}
function PathLink({
	href,
	title,
	description,
}: {
	href: string;
	title: string;
	description: string;
}) {
	return (
		<Link
			href={href}
			className='group relative overflow-hidden rounded-lg border border-surface-border bg-surface px-5 py-5 text-foreground shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:px-6 sm:py-6'
		>
			<span className='absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-accent transition duration-500 group-hover:scale-x-100' />
			<span className='flex items-start justify-between gap-4'>
				<span>
					<span className='block font-display text-2xl tracking-[-0.02em] sm:text-[1.7rem]'>
						{title}
					</span>
					<span className='mt-2 block text-sm leading-relaxed text-muted'>{description}</span>
				</span>
				<span
					aria-hidden
					className='mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-surface-border text-accent transition duration-300 group-hover:translate-x-0.5 group-hover:bg-accent-soft'
				>
					→
				</span>
			</span>
		</Link>
	);
}
