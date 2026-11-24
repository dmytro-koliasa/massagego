'use client';

import Image from 'next/image';
import { toast } from 'sonner';
import type { Locale, Dictionary } from '@/lib/i18n';
import {
	getCustomMassageTypes,
	getMassageTypeLabel,
	MASSAGE_TYPE_IDS,
	CUSTOM_MASSAGE_TYPE_MAX_LENGTH,
	type MassageTypeValue,
} from '@/lib/massage-types';
import { GalleryCropModal } from '@/components/gallery-crop-modal';
import { NAME_MAX, DESCRIPTION_MAX } from '@/lib/validation';
import { shouldSkipImageOptimization } from '@/lib/upload-url';
import { CompactLangTabs } from './compact-lang-tabs';
import { CameraIcon } from './camera-icon';

export type ProfileGeneralSectionProps = {
	t: Dictionary;
	locale: Locale;
	email: string;
	displayName: string;
	initials: string;
	image: string | null;
	photoPending: boolean;
	photoModalOpen: boolean;
	onPhotoModalOpenChange: (open: boolean) => void;
	onSaveProfilePhoto: (payload: {
		blob: Blob;
		width: number;
		height: number;
	}) => Promise<boolean>;
	onDeletePhoto: () => void;
	nameLocale: 'en' | 'uk';
	onNameLocaleChange: (locale: 'en' | 'uk') => void;
	nameEn: string;
	onNameEnChange: (value: string) => void;
	nameUk: string;
	onNameUkChange: (value: string) => void;
	descriptionLocale: 'en' | 'uk';
	onDescriptionLocaleChange: (locale: 'en' | 'uk') => void;
	descriptionEn: string;
	onDescriptionEnChange: (value: string) => void;
	descriptionUk: string;
	onDescriptionUkChange: (value: string) => void;
	massageTypes: MassageTypeValue[];
	onToggleMassageType: (id: MassageTypeValue) => void;
	customMassageType: string;
	onCustomMassageTypeChange: (value: string) => void;
	onAddCustomMassageType: () => void;
	slug: string | null;
	saveErrorMessage: string;
};

export function ProfileGeneralSection({
	t,
	locale,
	email,
	displayName,
	initials,
	image,
	photoPending,
	photoModalOpen,
	onPhotoModalOpenChange,
	onSaveProfilePhoto,
	onDeletePhoto,
	nameLocale,
	onNameLocaleChange,
	nameEn,
	onNameEnChange,
	nameUk,
	onNameUkChange,
	descriptionLocale,
	onDescriptionLocaleChange,
	descriptionEn,
	onDescriptionEnChange,
	descriptionUk,
	onDescriptionUkChange,
	massageTypes,
	onToggleMassageType,
	customMassageType,
	onCustomMassageTypeChange,
	onAddCustomMassageType,
	slug,
	saveErrorMessage,
}: ProfileGeneralSectionProps) {
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
						onClick={() => onPhotoModalOpenChange(true)}
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
							onClick={() => onPhotoModalOpenChange(true)}
							className='h-11 w-full rounded-lg bg-accent text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60'
						>
							{image ? t.profilePhotoChange : t.profilePhotoAdd}
						</button>
						{image ? (
							<button
								type='button'
								disabled={photoPending}
								onClick={onDeletePhoto}
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
						onClose={() => onPhotoModalOpenChange(false)}
						onSave={onSaveProfilePhoto}
					/>
				</div>

				<div className='space-y-5'>
					<div className='text-left'>
						<span className='mb-1.5 block text-sm text-muted'>{t.profileName}</span>
						<CompactLangTabs
							ariaLabel={t.profileName}
							value={nameLocale}
							onChange={onNameLocaleChange}
							enLabel={t.english}
							ukLabel={t.ukrainian}
						/>
						<input
							type='text'
							value={nameLocale === 'en' ? nameEn : nameUk}
							onChange={event =>
								nameLocale === 'en'
									? onNameEnChange(event.target.value)
									: onNameUkChange(event.target.value)
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
						<span className='mb-1.5 block text-sm text-muted'>{t.profileDescription}</span>
						<CompactLangTabs
							ariaLabel={t.profileDescription}
							value={descriptionLocale}
							onChange={onDescriptionLocaleChange}
							enLabel={t.english}
							ukLabel={t.ukrainian}
						/>
						<textarea
							value={descriptionLocale === 'en' ? descriptionEn : descriptionUk}
							onChange={event =>
								descriptionLocale === 'en'
									? onDescriptionEnChange(event.target.value)
									: onDescriptionUkChange(event.target.value)
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
										onClick={() => onToggleMassageType(id)}
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
									onClick={() => onToggleMassageType(id)}
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
								onChange={event => onCustomMassageTypeChange(event.target.value)}
								onKeyDown={event => {
									if (event.key === 'Enter') {
										event.preventDefault();
										onAddCustomMassageType();
									}
								}}
								className='h-11 min-w-[12rem] flex-1 rounded-lg border border-surface-border bg-background/70 px-4 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--ring)]'
							/>
							<button
								type='button'
								onClick={onAddCustomMassageType}
								className='h-11 rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent'
							>
								{t.profileMassageTypeCustomAdd}
							</button>
						</div>
					</div>

					{slug ? (
						<div className='rounded-lg border border-surface-border bg-background/50 p-4 text-left'>
							<p className='text-sm font-medium text-foreground'>{t.profileBookingLinkTitle}</p>
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
											() => toast.error(saveErrorMessage),
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

					<p className='text-sm text-muted'>{email}</p>
				</div>
			</div>
		</section>
	);
}