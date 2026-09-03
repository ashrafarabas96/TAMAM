'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Permission } from '@tamam/shared-types';
import { type DecideDisputeInput, decideDisputeSchema, type DisputeMessageInput, disputeMessageSchema } from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, FormGrid, MinorAmountField, NativeSelectField, NumberField, SwitchField, TextareaField } from '@/components/ui/form';
import { Identifier } from '@/components/ui/misc';
import { Money } from '@/components/ui/money';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { disputesApi } from '@/lib/api/endpoints/disputes';
import { createIdempotencyKey } from '@/lib/idempotency';
import { queryKeys } from '@/lib/query-keys';

const DECISIONS = ['RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'RESOLVED_SPLIT', 'REJECTED'] as const;

export default function DisputeDetailPage() {
  return (
    <RequirePermission anyOf={[Permission.DISPUTES_READ]}>
      <DisputeDetail />
    </RequirePermission>
  );
}

function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decideOpen, setDecideOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey('dispute'));
  const dispute = useQuery({ queryKey: queryKeys.disputes.detail(id), queryFn: () => disputesApi.get(id) });

  const messageForm = useForm<DisputeMessageInput>({ resolver: zodResolver(disputeMessageSchema), defaultValues: { text: '', evidenceMediaIds: [], internal: false } });
  const decisionForm = useForm<DecideDisputeInput>({ resolver: zodResolver(decideDisputeSchema), defaultValues: { decision: 'RESOLVED_CUSTOMER', refundMinor: 0, partnerAdjustmentMinor: 0, reason: '' } });

  const reply = useMutation({
    mutationFn: (input: DisputeMessageInput) => disputesApi.addMessage(id, input),
    onSuccess: async () => {
      toast.success(t('support.messageSent'));
      messageForm.reset({ text: '', evidenceMediaIds: [], internal: false });
      await queryClient.invalidateQueries({ queryKey: queryKeys.disputes.detail(id) });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(messageForm, e)) toast.fromError(e);
    },
  });
  const decide = useMutation({
    mutationFn: (input: DecideDisputeInput) => disputesApi.decide(id, input, idempotencyKey),
    onSuccess: async () => {
      toast.success(t('disputes.decided'));
      setDecideOpen(false);
      setIdempotencyKey(createIdempotencyKey('dispute'));
      await queryClient.invalidateQueries({ queryKey: queryKeys.disputes.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(decisionForm, e)) toast.fromError(e);
    },
  });

  if (dispute.isPending) return <SkeletonCard />;
  if (dispute.isError) return <ErrorState error={dispute.error} onRetry={() => void dispute.refetch()} />;
  const d = dispute.data;
  const currency = d.refund.currency;
  const decided = !!d.decidedAt;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.disputes'), href: '/disputes' }, { label: d.number }]}
        title={d.number}
        badge={<StatusPill group="disputeStatus" value={d.status} />}
        description={d.reason}
        actions={<Can anyOf={[Permission.DISPUTES_DECIDE]}><Button variant="accent" size="sm" onClick={() => setDecideOpen(true)} disabled={decided}>{decided ? t('disputes.alreadyDecided') : t('disputes.decide')}</Button></Can>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('disputes.case')} className="lg:col-span-2">
          <p className="whitespace-pre-wrap text-sm">{d.description}</p>
          {d.evidenceUrls.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {d.evidenceUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-20 w-28 overflow-hidden rounded-sm border border-border">
                  <img src={url} alt={t('disputes.evidence')} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <ul className="mt-4 space-y-2 border-t border-border pt-3">
            {d.messages.map((m) => (
              <li key={m.id} className={`rounded-md p-3 text-sm ${m.internal ? 'bg-warning-soft/40' : 'bg-surface-alt'}`}>
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span className="flex items-center gap-2">{m.authorName ?? <Identifier value={m.authorId} />}{m.internal ? <Badge tone="warning">{t('support.internal')}</Badge> : null}</span>
                  <DateTime value={m.createdAt} />
                </div>
                <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
              </li>
            ))}
          </ul>
          <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={messageForm.handleSubmit((v) => reply.mutate(v))}>
            <TextareaField control={messageForm.control} name="text" label={t('disputes.addMessage')} required />
            <div className="flex items-center justify-between gap-3">
              <SwitchField control={messageForm.control} name="internal" label={t('support.internalNote')} />
              <Button type="submit" loading={reply.isPending}>{t('support.send')}</Button>
            </div>
          </form>
        </Card>
        <Card title={t('common.details')}>
          <KeyValue columns={1} items={[
            { label: t('jobs.job'), value: <Link className="text-primary hover:underline" href={`/jobs/${d.jobId}`}><Identifier value={d.jobId} /></Link> },
            { label: t('jobs.customer'), value: <Link className="text-primary hover:underline" href={`/customers/${d.customerId}`}><Identifier value={d.customerId} /></Link> },
            { label: t('jobs.partner'), value: <Link className="text-primary hover:underline" href={`/partners/${d.partnerId}`}><Identifier value={d.partnerId} /></Link> },
            { label: t('disputes.openedBy'), value: d.openedByRole },
            { label: t('disputes.requestedRefund'), value: <Money value={d.requestedRefund} /> },
            { label: t('disputes.refund'), value: <Money value={d.refund} /> },
            { label: t('disputes.partnerAdjustment'), value: <Money value={d.partnerAdjustment} signed /> },
            { label: t('disputes.decidedAt'), value: <DateTime value={d.decidedAt} /> },
            { label: t('disputes.decisionReason'), value: d.decisionReason ?? '—' },
          ]} />
        </Card>
      </div>

      <Dialog
        open={decideOpen}
        onOpenChange={setDecideOpen}
        title={t('disputes.decide')}
        description={t('disputes.decideHint')}
        locked={decide.isPending}
        footer={<><Button variant="ghost" onClick={() => setDecideOpen(false)}>{t('common.cancel')}</Button><Button variant="accent" loading={decide.isPending} onClick={decisionForm.handleSubmit((v) => decide.mutate(v))}>{t('disputes.submitDecision')}</Button></>}
      >
        <form className="space-y-4" onSubmit={decisionForm.handleSubmit((v) => decide.mutate(v))}>
          <NativeSelectField control={decisionForm.control} name="decision" label={t('disputes.decision')} options={DECISIONS.map((dec) => ({ value: dec, label: enumLabel('disputeDecision', dec) }))} required />
          <FormGrid cols={2}>
            <MinorAmountField control={decisionForm.control} name="refundMinor" label={t('disputes.refund')} currency={currency} hint={t('disputes.refundHint')} />
            <NumberField control={decisionForm.control} name="partnerAdjustmentMinor" label={t('disputes.partnerAdjustmentMinor')} hint={t('disputes.partnerAdjustmentHint')} />
          </FormGrid>
          <TextareaField control={decisionForm.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
          <p className="text-[11px] text-text-tertiary" dir="ltr">Idempotency-Key: {idempotencyKey}</p>
        </form>
      </Dialog>
    </div>
  );
}
