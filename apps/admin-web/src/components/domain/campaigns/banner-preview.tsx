'use client';

import { bannerPlacements, bannerThemes, tokens } from '@tamam/ui-tokens';
import type { BannerPlacement } from '@tamam/shared-types';

import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils/cn';

export interface BannerPreviewValue {
  placement: BannerPlacement;
  theme: string;
  headline?: { ar: string; en: string } | null;
  subheadline?: { ar: string; en: string } | null;
  ctaLabel?: { ar: string; en: string } | null;
  badge?: { ar: string; en: string } | null;
  imageUrl?: string | null;
}

export const placementSpec = (placement: BannerPlacement) => bannerPlacements[placement];
export const themePalette = (theme: string) =>
  bannerThemes[theme as keyof typeof bannerThemes] ?? bannerThemes.purple;

/**
 * Pixel-faithful preview of the mobile banner widgets (`BannerCreativeView` in
 * apps/customer-mobile): artwork with a bottom-up scrim, badge pill, headline (2 lines hero /
 * 1 line inline), subheadline and an accent CTA pill — all inside the placement's aspect ratio.
 */
export function BannerPreview({
  value,
  language,
  className,
}: {
  value: BannerPreviewValue;
  language: 'ar' | 'en';
  className?: string;
}) {
  const { t } = useI18n();
  const spec = placementSpec(value.placement);
  const palette = themePalette(value.theme);
  const compact = spec.aspectRatio >= 3;
  const pick = (text?: { ar: string; en: string } | null): string =>
    text ? (language === 'ar' ? text.ar : text.en) : '';
  const headline = pick(value.headline);
  const subheadline = pick(value.subheadline);
  const cta = pick(value.ctaLabel);
  const badge = pick(value.badge);
  const hasOverlay = !!(headline || subheadline || cta || badge);

  return (
    <div
      className={cn('w-full', className)}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      lang={language}
    >
      <div
        className="relative overflow-hidden rounded-banner shadow-card"
        style={{ aspectRatio: String(spec.aspectRatio), background: palette.background }}
      >
        {value.imageUrl ? (
          <img
            src={value.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {hasOverlay ? (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${palette.background}D1 0%, ${palette.background}40 55%, transparent 100%)`,
            }}
            aria-hidden
          />
        ) : null}
        {hasOverlay ? (
          <div
            className={cn('absolute inset-0 flex flex-col justify-end', compact ? 'p-3' : 'p-4')}
          >
            {badge ? (
              <span
                className="mb-auto w-fit rounded-pill px-2 py-[3px] text-[11px] font-semibold"
                style={{ background: palette.accent, color: palette.background }}
              >
                {badge}
              </span>
            ) : null}
            {headline ? (
              <p
                className={cn(
                  'font-bold leading-tight',
                  compact ? 'line-clamp-1 text-base' : 'line-clamp-2 text-lg',
                )}
                style={{ color: palette.foreground }}
              >
                {headline}
              </p>
            ) : null}
            {!compact && subheadline ? (
              <p
                className="mt-0.5 line-clamp-1 text-xs"
                style={{ color: `${palette.foreground}E6` }}
              >
                {subheadline}
              </p>
            ) : null}
            {cta ? (
              <span
                className={cn(
                  'w-fit rounded-pill px-3 py-1 text-xs font-semibold',
                  compact ? 'mt-1' : 'mt-2',
                )}
                style={{ background: palette.accent, color: palette.background }}
              >
                {cta}
              </span>
            ) : null}
          </div>
        ) : null}
        {!value.imageUrl ? (
          <span
            className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
            style={{ color: palette.foreground }}
          >
            {t('campaigns.noCreative')}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-text-tertiary" dir="ltr">
        {value.placement} · {spec.aspectRatio}:1 · {spec.style} · max {spec.maxItems}
      </p>
    </div>
  );
}

/** Phone-shaped frame around the preview so the operator sees the placement in context. */
export function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[320px] rounded-[28px] border-[10px] border-neutral-900 bg-neutral-100 p-3 shadow-floating dark:border-neutral-700 dark:bg-neutral-900',
        className,
      )}
    >
      <div
        className="mb-2 h-1.5 w-16 rounded-pill bg-neutral-300 mx-auto dark:bg-neutral-700"
        aria-hidden
      />
      <div className="rounded-xl p-1" style={{ background: tokens.color.light.background }}>
        {children}
      </div>
    </div>
  );
}
