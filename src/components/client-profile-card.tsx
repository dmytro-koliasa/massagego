'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { GalleryCropModal } from '@/components/gallery-crop-modal';
import { useLanguage } from '@/components/language-provider';

type ClientProfile = {
	id: string;
	name: string | null;
	nameEn: string | null;
	nameUk: string | null;
	email: string;
	image: string | null;
};

export function ClientProfileCard() {
	const { t } = useLanguage();
	const { data: session, status, update: updateSession } = useSession();
	const [profile, setProfile] = useState<ClientProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [nameEn, setNameEn] = useState('');
	const [nameUk, setNameUk] = useState('');
	const [image, setImage] = useState<string | null>(null);
	const [nameLocale, setNameLocale] = useState<'en' | 'uk'>('uk');
	const [pending, setPending] = useState(false);
	const [photoPending, setPhotoPending] = useState(false);
	const [photoModalOpen, setPhotoModalOpen] = useState(false);

	useEffect(() => {
		if (status !== 'authenticated' || !session?.user) {
			setLoading(false);
			setProfile(null);
			return;
		}

		let cancelled = false;

		async function load() {
			setLoading(true);
			try {
				const response = await fetch('/api/client/profile', { cache: 'no-store' });
				if (!response.ok) {
					if (!cancelled) setProfile(null);
					return;
				}
				const data = (await response.json()) as { user: ClientProfile };
				if (cancelled) return;
				const fallbackName = data.user.name?.trim() || '';
				const nextNameEn = data.user.nameEn?.trim() || fallbackName;
				const nextNameUk = data.user.nameUk?.trim() || fallbackName;
				setProfile(data.user);
				setNameEn(nextNameEn);
				setNameUk(nextNameUk);
				setNameLocale(
					data.user.nameUk?.trim()
						? 'uk'
						: data.user.nameEn?.trim()
							? 'en'
							: 'uk',
				);
				setImage(data.user.image);
			} catch {
				if (!cancelled) setProfile(null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [status, session?.user?.id]);

	async function saveName() {
		if (!profile) return;
		setPending(true);
		try {
			const response = await fetch('/api/client/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ nameEn, nameUk }),
			});

			if (!response.ok) {
				toast.error(t.profileSaveError);
				return;
			}

			const data = (await response.json()) as { user: ClientProfile };
			setProfile(data.user);
			setNameEn(data.user.nameEn ?? '');
			setNameUk(data.user.nameUk ?? '');
			toast.success(t.profileSaved);
			await updateSession();
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setPending(false);
		}
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

			const response = await fetch('/api/client/profile', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				toast.error(mapPhotoError(data?.error, t));
				return false;
			}

			const data = (await response.json()) as { user: ClientProfile };
			setProfile(data.user);
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
			const response = await fetch('/api/client/profile', {
				method: 'DELETE',
			});

			if (!response.ok) {
				toast.error(t.profileSaveError);
				return;
			}

			const data = (await response.json()) as { user: ClientProfile };
			setProfile(data.user);
			setImage(data.user.image);
			toast.success(t.profilePhotoRemoved);
			await updateSession();
		} catch {
			toast.error(t.profileSaveError);
		} finally {
			setPhotoPending(false);
		}
	}

	if (status === 'loading') {
		return null;
	}

	if (status !== 'authenticated') {
		return null;
	}

	if (loading) {
		return (
			<section className='mt-10 rounded-2xl border border-surface-border bg-surface p-6 sm:p-8'>
				<div className='h-40 animate-pulse rounded-lg bg-accent-soft' />
			</section>
		);
	}

	if (!profile) {
		return null;
	}

	const displayName = nameEn || nameUk || profile.email || '?';
	const initials = displayName
		.split(' ')
		.filter(Boolean)
		.slice(0, 2)
		.map(part => part[0]?.toUpperCase())
		.join('');

	return (
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
								unoptimized={image.startsWith('/uploads/')}
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
								onClick={() => void deletePhoto()}
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
							className='mt-2 h-12 w-full rounded-lg border border-surface-border bg-background/70 px-4 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
						/>
					</div>

					<p className='text-sm text-muted'>{profile.email}</p>

					<button
						type='button'
						disabled={pending}
						onClick={() => void saveName()}
						className='h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
					>
						{pending ? t.authPleaseWait : t.profileSave}
					</button>
				</div>
			</div>
		</section>
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
			className='inline-flex rounded-md bg-accent-soft p-0.5'
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

function mapPhotoError(
	code: string | undefined,
	t: ReturnType<typeof useLanguage>['t'],
) {
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
			<circle cx='12' cy='13' r='3.2' stroke='currentColor' strokeWidth='1.8' />
		</svg>
	);
}
