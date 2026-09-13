'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BackNavLink } from '@/components/back-nav-link';
import { ClientProfileCard } from '@/components/client-profile-card';
import { useLanguage } from '@/components/language-provider';
import { ClientSessionsCalendar } from '@/components/client-sessions-calendar';

export type MasseurCard = {
	id: string;
	slug: string | null;
	nameEn: string | null;
	nameUk: string | null;
	email: string;
	image: string | null;
	descriptionEn: string | null;
	descriptionUk: string | null;
	city: string | null;
	createdAt: string;
};

type ViewMode = 'grid' | 'table';

type LocalizedMasseur = {
	id: string;
	slug: string | null;
	name: string;
	description: string;
	image: string | null;
};

const MASSEURS_PAGE_SIZE = 9;

type MasseursResponse = {
	masseurs: MasseurCard[];
	page: number;
	pageSize: number;
	total: number;
	totalAll: number;
	totalPages: number;
	cities: string[];
};

export function ClientMasseursView() {
	const { t, locale } = useLanguage();
	const [masseurs, setMasseurs] = useState<MasseurCard[]>([]);
	const [cities, setCities] = useState<string[]>([]);
	const [total, setTotal] = useState(0);
	const [totalAll, setTotalAll] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [cityFilter, setCityFilter] = useState('all');
	const [page, setPage] = useState(1);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(false);

			try {
				const params = new URLSearchParams({
					page: String(page),
					pageSize: String(MASSEURS_PAGE_SIZE),
				});
				if (cityFilter !== 'all') {
					params.set('city', cityFilter);
				}

				const response = await fetch(`/api/masseurs?${params.toString()}`, {
					cache: 'no-store',
				});
				if (!response.ok) throw new Error('failed');

				const data = (await response.json()) as MasseursResponse;
				if (cancelled) return;

				setMasseurs(data.masseurs);
				setCities(data.cities ?? []);
				setTotal(data.total);
				setTotalAll(data.totalAll);
				setTotalPages(Math.max(1, data.totalPages));

				if (data.page !== page) {
					setPage(data.page);
				}
			} catch {
				if (!cancelled) {
					setError(true);
					toast.error(t.masseursLoadError);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [page, cityFilter, t.masseursLoadError]);

	useEffect(() => {
		if (cityFilter !== 'all' && cities.length > 0 && !cities.includes(cityFilter)) {
			setCityFilter('all');
			setPage(1);
		}
	}, [cities, cityFilter]);

	const localizedMasseurs: LocalizedMasseur[] = useMemo(
		() =>
			masseurs.map(masseur => {
				const name =
					(locale === 'uk' ? masseur.nameUk : masseur.nameEn)?.trim() || t.masseurFallbackName;
				const description =
					(locale === 'uk' ? masseur.descriptionUk : masseur.descriptionEn)?.trim() || '';

				return {
					id: masseur.id,
					slug: masseur.slug,
					name,
					description,
					image: masseur.image,
				};
			}),
		[masseurs, locale, t.masseurFallbackName],
	);

	const pageNumbers = useMemo(
		() => Array.from({ length: totalPages }, (_, index) => index + 1),
		[totalPages],
	);

	const showToolbar = !error && totalAll > 0;
	const showPagination = showToolbar && totalPages > 1 && total > 0;

	return (
		<main className='flex flex-1 flex-col bg-background py-10'>
			<div className='mx-auto w-full max-w-6xl flex-1 px-[15px]'>
				<div className='max-w-2xl space-y-3'>
					<h1 className='font-display text-4xl tracking-[-0.03em] text-foreground sm:text-5xl'>
						{t.clientPageTitle}
					</h1>
				</div>

				<ClientProfileCard />

				<section
					className='mt-10 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'
					aria-label={t.masseursGridLabel}
				>
					<div className='mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
						<div className='text-left'>
							<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
								{t.masseursGridLabel}
							</h2>
							<p className='mt-1 text-sm text-muted'>{t.clientPageSupport}</p>
						</div>

						{showToolbar ? (
							<div className='flex flex-wrap items-center gap-3 self-start sm:self-auto'>
								<select
									value={cityFilter}
									onChange={event => {
										setCityFilter(event.target.value);
										setPage(1);
									}}
									aria-label={t.masseursCityFilterLabel}
									className='h-12 min-w-[12rem] text-foreground'
								>
									<option value='all'>{t.masseursCityFilterAll}</option>
									{cities.map(city => (
										<option key={city} value={city}>
											{city}
										</option>
									))}
								</select>

								<div
									role='group'
									aria-label={t.masseursViewLabel}
									className='inline-flex h-12 items-stretch rounded-lg bg-accent-soft p-0.5'
								>
									<button
										type='button'
										aria-pressed={viewMode === 'grid'}
										onClick={() => setViewMode('grid')}
										className={`rounded-md px-4 text-sm font-medium tracking-[0.04em] transition ${
											viewMode === 'grid'
												? 'bg-background text-foreground shadow-sm'
												: 'text-muted hover:text-foreground'
										}`}
									>
										{t.masseursViewGrid}
									</button>
									<button
										type='button'
										aria-pressed={viewMode === 'table'}
										onClick={() => setViewMode('table')}
										className={`rounded-md px-4 text-sm font-medium tracking-[0.04em] transition ${
											viewMode === 'table'
												? 'bg-background text-foreground shadow-sm'
												: 'text-muted hover:text-foreground'
										}`}
									>
										{t.masseursViewTable}
									</button>
								</div>
							</div>
						) : null}
					</div>

					{loading ? (
						<p className='text-sm text-muted'>{t.masseursLoading}</p>
					) : error || totalAll === 0 ? (
						<p className='rounded-lg border border-dashed border-surface-border px-6 py-12 text-center text-muted'>
							{t.masseursEmpty}
						</p>
					) : total === 0 ? (
						<p className='rounded-lg border border-dashed border-surface-border px-6 py-12 text-center text-muted'>
							{t.masseursFilterEmpty}
						</p>
					) : viewMode === 'grid' ? (
						<ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
							{localizedMasseurs.map(masseur => (
								<li key={masseur.id}>
									<Link
										href={`/client/masseur/${masseur.slug || masseur.id}`}
										className='group flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-background/50 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
									>
										<div className='flex items-center gap-4'>
											<Avatar name={masseur.name} image={masseur.image} />
											<h3 className='min-w-0 truncate font-display text-xl tracking-[-0.02em] text-foreground'>
												{masseur.name}
											</h3>
										</div>
										{masseur.description ? (
											<p className='mt-5 text-left text-sm leading-relaxed text-muted'>
												{masseur.description}
											</p>
										) : null}
									</Link>
								</li>
							))}
						</ul>
					) : (
						<div className='overflow-x-auto rounded-lg border border-surface-border'>
							<table className='min-w-full border-collapse text-left'>
								<thead className='bg-accent-soft/60'>
									<tr>
										<th className='px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted'>
											{t.masseursTablePhoto}
										</th>
										<th className='px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted'>
											{t.profileName}
										</th>
										<th className='px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted'>
											{t.profileDescription}
										</th>
									</tr>
								</thead>
								<tbody>
									{localizedMasseurs.map(masseur => (
										<tr
											key={masseur.id}
											className='border-t border-surface-border transition hover:bg-accent-soft/30'
										>
											<td className='px-4 py-3'>
												<Link
													href={`/client/masseur/${masseur.slug || masseur.id}`}
													className='inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
												>
													<Avatar name={masseur.name} image={masseur.image} />
												</Link>
											</td>
											<td className='px-4 py-3 font-display text-lg tracking-[-0.02em] text-foreground'>
												<Link
													href={`/client/masseur/${masseur.slug || masseur.id}`}
													className='hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
												>
													{masseur.name}
												</Link>
											</td>
											<td className='max-w-xl px-4 py-3 text-sm leading-relaxed text-muted'>
												<Link
													href={`/client/masseur/${masseur.slug || masseur.id}`}
													className='block hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
												>
													{masseur.description || '—'}
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{showPagination ? (
						<nav
							className='mt-6 flex items-center justify-center gap-1.5'
							aria-label={t.masseursPaginationLabel}
						>
							<button
								type='button'
								disabled={loading || page <= 1}
								onClick={() => setPage(1)}
								aria-label={t.masseursPaginationFirst}
								className='flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-background text-base font-medium text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45'
							>
								«
							</button>
							<button
								type='button'
								disabled={loading || page <= 1}
								onClick={() => setPage(current => Math.max(1, current - 1))}
								aria-label={t.masseursPaginationPrev}
								className='flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-background text-base font-medium text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45'
							>
								‹
							</button>

							{pageNumbers.map(pageNumber => {
								const active = pageNumber === page;
								return (
									<button
										key={pageNumber}
										type='button'
										disabled={loading}
										aria-current={active ? 'page' : undefined}
										onClick={() => setPage(pageNumber)}
										className={`flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium tracking-[0.04em] transition disabled:cursor-not-allowed disabled:opacity-45 ${
											active
												? 'border-accent bg-accent text-white'
												: 'border-surface-border bg-background text-foreground hover:border-accent/40'
										}`}
									>
										{pageNumber}
									</button>
								);
							})}

							<button
								type='button'
								disabled={loading || page >= totalPages}
								onClick={() => setPage(current => Math.min(totalPages, current + 1))}
								aria-label={t.masseursPaginationNext}
								className='flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-background text-base font-medium text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45'
							>
								›
							</button>
							<button
								type='button'
								disabled={loading || page >= totalPages}
								onClick={() => setPage(totalPages)}
								aria-label={t.masseursPaginationLast}
								className='flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-background text-base font-medium text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45'
							>
								»
							</button>
						</nav>
					) : null}
				</section>

				<section className='mt-8 rounded-2xl border border-surface-border bg-surface p-4 sm:p-6'>
					<div className='mb-4 text-left'>
						<h2 className='text-xl font-bold tracking-[-0.02em] text-foreground'>
							{t.clientSessionsTitle}
						</h2>
						<p className='mt-1 text-sm text-muted'>{t.clientSessionsSupport}</p>
					</div>
					<ClientSessionsCalendar />
				</section>

				<BackNavLink href='/' className='mt-10'>
					{t.backHome}
				</BackNavLink>
			</div>
		</main>
	);
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
	const initials = (name || '?')
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map(part => part[0]?.toUpperCase())
		.join('');

	if (image) {
		return (
			<div className='relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] bg-accent-soft'>
				<Image
					src={image}
					alt={name || 'Masseur'}
					fill
					sizes='56px'
					className='object-cover'
					unoptimized={image.startsWith('/uploads/')}
				/>
			</div>
		);
	}

	return (
		<div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-sm font-medium text-accent'>
			{initials}
		</div>
	);
}
