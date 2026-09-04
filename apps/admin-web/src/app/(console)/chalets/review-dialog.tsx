'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ChaletApprovalStatus } from '@tamam/shared-types';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useI18n } from '@/i18n';
import { chaletsApi } from '@/lib/api/endpoints/chalets';
import { queryKeys } from '@/lib/query-keys';

/**
 * One chalet, and the decision.
 *
 * A rejection has to say why: an owner told only "rejected" cannot fix
 * anything, and will either resubmit the same chalet or give up. The reason
 * field is required by the API, and the button here stays disabled until it is
 * long enough to be useful — the reviewer finds that out before submitting
 * rather than through a 422.
 */
export function ChaletReviewDialog({
  chaletId,
  onClose,
}: {
  chaletId: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const chalet = useQuery({
    queryKey: queryKeys.chalets.detail(chaletId),
    queryFn: () => chaletsApi.get(chaletId),
  });

  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      chaletsApi.decide(chaletId, approve ? { approve } : { approve, reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.chalets.all });
      onClose();
    },
  });

  const data = chalet.data;
  const alreadyApproved = data?.approvalStatus === ChaletApprovalStatus.APPROVED;
  // The API requires at least five characters; matching it here means the
  // reviewer is told before they submit rather than by a rejected request.
  const canReject = reason.trim().length >= 5;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      locked={decide.isPending}
      title={data ? (locale === 'ar' ? data.nameAr : data.nameEn) : t('chalets.review')}
      description={data?.addressLine}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={!canReject || decide.isPending}
            onClick={() => decide.mutate(false)}
          >
            {t('chalets.reject')}
          </Button>
          <Button
            disabled={alreadyApproved || decide.isPending}
            onClick={() => decide.mutate(true)}
          >
            {t('chalets.approve')}
          </Button>
        </div>
      }
    >
      {chalet.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chalet.isError || !data ? (
        <ErrorState error={chalet.error} onRetry={() => void chalet.refetch()} />
      ) : (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 text-sm">
            <Field label={t('chalets.owner')}>
              {data.ownerName ?? '—'}
              <span className="block font-mono text-[11px] text-text-tertiary" dir="ltr">
                {data.ownerPhone}
              </span>
            </Field>
            <Field label={t('chalets.capacity')}>{data.maximumGuests}</Field>
            <Field label={t('chalets.rate')}>
              <span dir="ltr">
                {(data.baseHourlyRate.amount / 100).toFixed(2)} {data.baseHourlyRate.currency}
              </span>
            </Field>
            <Field label={t('chalets.floor')}>
              <span dir="ltr">
                {(data.minimumHourlyRate.amount / 100).toFixed(2)}{' '}
                {data.minimumHourlyRate.currency}
              </span>
              <span className="block text-[11px] text-text-tertiary">
                {t('chalets.priceFloorNote')}
              </span>
            </Field>
          </section>

          {data.descriptionAr || data.descriptionEn ? (
            <p className="text-sm text-text-secondary">
              {locale === 'ar' ? data.descriptionAr : data.descriptionEn}
            </p>
          ) : null}

          <section className="space-y-1 text-sm">
            <h3 className="font-medium">{t('chalets.scheduling')}</h3>
            <p className="text-text-secondary">
              {t('chalets.openingHours')
                .replace('{open}', data.scheduling.openingTime)
                .replace('{close}', data.scheduling.closingTime)}
            </p>
            <p className="text-text-secondary">
              {t('chalets.interval').replace(
                '{minutes}',
                String(data.scheduling.bookingIntervalMinutes),
              )}
            </p>
            <p className="text-text-secondary">
              {t('chalets.cleaning').replace(
                '{minutes}',
                String(data.scheduling.defaultCleaningDurationMinutes),
              )}
            </p>
            <p className="text-text-secondary">
              {t('chalets.duration')
                .replace('{min}', String(data.scheduling.minimumBookingDurationMinutes))
                .replace('{max}', String(data.scheduling.maximumBookingDurationMinutes))}
            </p>
          </section>

          {data.amenities.length > 0 ? (
            <section className="space-y-1 text-sm">
              <h3 className="font-medium">{t('chalets.amenities')}</h3>
              <p className="text-text-secondary">
                {data.amenities
                  .map((a) => (locale === 'ar' ? a.nameAr : a.nameEn))
                  .join('، ')}
              </p>
            </section>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('chalets.rejectReason')}</span>
            <textarea
              className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('chalets.rejectReasonHint')}
            />
            <span className="block text-[11px] text-text-tertiary">
              {t('chalets.rejectReasonHint')}
            </span>
          </label>

          {decide.isError ? <ErrorState error={decide.error} /> : null}
        </div>
      )}
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-text-tertiary">{label}</span>
      <span className="block">{children}</span>
    </div>
  );
}
