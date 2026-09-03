'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { PartnerDocumentDto } from '@tamam/shared-types';
import { type ReviewDocumentInput, reviewDocumentSchema } from '@tamam/validation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, NativeSelectField, TextareaField, TextField } from '@/components/ui/form';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';

export interface DocumentReviewSubmit {
  (docId: string, input: ReviewDocumentInput): Promise<unknown>;
}

/** Document viewer + approve/reject (rejection reason mandatory — `reviewDocumentSchema`). */
export function DocumentsPanel({ documents, onReview, onDone, canReview }: { documents: PartnerDocumentDto[]; onReview: DocumentReviewSubmit; onDone: () => Promise<unknown> | void; canReview: boolean }) {
  const { t, enumLabel } = useI18n();
  const [active, setActive] = useState<PartnerDocumentDto | null>(null);
  if (documents.length === 0) return <p className="text-xs text-text-secondary">{t('partners.noDocuments')}</p>;
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((doc) => (
          <li key={doc.id} className="card overflow-hidden">
            <div className="flex h-40 items-center justify-center bg-surface-alt">
              {/^https?:\/\//.test(doc.fileUrl) ? <img src={doc.fileUrl} alt={enumLabel('documentType', doc.type)} className="h-full w-full object-contain" /> : <FileText className="h-10 w-10 text-text-tertiary" aria-hidden />}
            </div>
            <div className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{enumLabel('documentType', doc.type)}</span>
                <StatusPill group="documentStatus" value={doc.status} />
              </div>
              <p className="text-xs text-text-secondary">
                {doc.number ? <span dir="ltr">{doc.number} · </span> : null}
                {doc.expiresAt ? <>{t('partners.expiresAt')} <DateTime value={doc.expiresAt} mode="date" /></> : t('partners.noExpiry')}
              </p>
              {doc.rejectionReason ? <p className="text-xs text-danger">{doc.rejectionReason}</p> : null}
              {doc.verifiedAt ? <p className="text-[11px] text-text-tertiary">{t('partners.reviewedAt')} <DateTime value={doc.verifiedAt} /></p> : null}
              <div className="flex gap-2">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-button border border-border px-2 text-xs hover:bg-surface-alt">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {t('common.open')}
                </a>
                {canReview && doc.status === 'PENDING' ? <Button size="sm" onClick={() => setActive(doc)}>{t('partners.review')}</Button> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ReviewDialog doc={active} onClose={() => setActive(null)} onReview={onReview} onDone={onDone} />
    </>
  );
}

export function ReviewDialog({ doc, onClose, onReview, onDone, title }: { doc: { id: string; type?: string } | null; onClose: () => void; onReview: DocumentReviewSubmit; onDone: () => Promise<unknown> | void; title?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const form = useForm<ReviewDocumentInput>({ resolver: zodResolver(reviewDocumentSchema), defaultValues: { decision: 'APPROVE' } });
  useEffect(() => {
    if (!doc) form.reset({ decision: 'APPROVE' });
  }, [doc, form]);
  const mutation = useMutation({
    mutationFn: (input: ReviewDocumentInput) => onReview(doc?.id ?? '', input),
    onSuccess: async () => {
      toast.success(t('partners.reviewSaved'));
      onClose();
      await onDone();
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const decision = form.watch('decision');
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()} title={title ?? t('partners.reviewDocument')} size="sm" locked={mutation.isPending} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button variant={decision === 'REJECT' ? 'danger' : 'primary'} loading={mutation.isPending} onClick={submit}>{t('common.apply')}</Button></>}>
      <form onSubmit={submit} className="space-y-3">
        <NativeSelectField control={form.control} name="decision" label={t('partners.decision')} options={[{ value: 'APPROVE', label: t('common.approve') }, { value: 'REJECT', label: t('common.reject') }]} required />
        {decision === 'APPROVE' ? <TextField control={form.control} name="expiresAt" label={t('partners.expiresAt')} type="date" dir="ltr" hint={t('partners.expiresHint')} /> : <TextareaField control={form.control} name="rejectionReason" label={t('partners.rejectionReason')} required placeholder={t('common.reasonPlaceholder')} />}
        {doc ? <p className="text-xs text-text-tertiary"><Badge tone="neutral">{doc.id.slice(0, 8)}</Badge></p> : null}
      </form>
    </Dialog>
  );
}
