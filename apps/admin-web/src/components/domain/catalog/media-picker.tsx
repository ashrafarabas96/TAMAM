'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

import type { MediaUploadIntentInput } from '@tamam/validation';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { uploadMedia } from '@/lib/api/endpoints/media';
import { cn } from '@/lib/utils/cn';

export interface MediaPickerProps {
  /** Media id currently selected (null when none). */
  value: string | null;
  onChange: (mediaId: string | null, previewUrl: string | null) => void;
  purpose: MediaUploadIntentInput['purpose'];
  previewUrl?: string | null;
  /** Enforced client-side before upload; the API validates again. */
  aspectRatio?: number;
  aspectTolerance?: number;
  label?: string;
  className?: string;
  accept?: string;
}

/**
 * Upload intent → signed PUT → confirm, with optional aspect-ratio validation (banner creatives
 * must match the placement ratio from `@tamam/ui-tokens`).
 */
export function MediaPicker({ value, onChange, purpose, previewUrl, aspectRatio, aspectTolerance = 0.06, label, className, accept = 'image/png,image/jpeg,image/webp' }: MediaPickerProps) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const preview = localPreview ?? previewUrl ?? null;

  const measure = (file: File): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });

  const handle = async (file: File) => {
    setBusy(true);
    try {
      if (aspectRatio) {
        const { width, height } = await measure(file);
        const ratio = width / height;
        if (Math.abs(ratio - aspectRatio) / aspectRatio > aspectTolerance) {
          toast.error(t('media.aspectMismatch'), t('media.aspectExpected', { expected: aspectRatio.toFixed(2), actual: ratio.toFixed(2) }));
          return;
        }
      }
      const asset = await uploadMedia(file, purpose, 'IMAGE');
      setLocalPreview(asset.mediumUrl ?? asset.url);
      onChange(asset.id, asset.mediumUrl ?? asset.url);
      toast.success(t('media.uploaded'));
    } catch (error) {
      toast.fromError(error, t('media.uploadFailed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('min-w-0', className)}>
      {label ? <p className="mb-1.5 text-xs font-semibold text-text-secondary">{label}</p> : null}
      <div className="relative flex items-center gap-3 rounded-md border border-dashed border-border-strong bg-surface-alt/50 p-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface" style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}>
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-text-tertiary" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1 text-xs text-text-secondary">
          <p>{value ? t('media.selected') : t('media.none')}</p>
          {aspectRatio ? <p className="text-[11px] text-text-tertiary" dir="ltr">{t('media.ratioHint', { ratio: aspectRatio.toFixed(2) })}</p> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} loading={busy}>
            {value ? t('media.replace') : t('media.upload')}
          </Button>
          {value ? (
            <Button size="icon-sm" variant="ghost" onClick={() => { setLocalPreview(null); onChange(null, null); }} aria-label={t('common.remove')}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        {busy ? <span className="absolute inset-0 flex items-center justify-center rounded-md bg-surface/70"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /></span> : null}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          lang={locale}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
          }}
        />
      </div>
    </div>
  );
}
