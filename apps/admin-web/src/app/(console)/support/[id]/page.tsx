'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { Permission, TicketCategory, TicketPriority, TicketStatus } from '@tamam/shared-types';
import {
  type TicketMessageInput,
  ticketMessageSchema,
  type UpdateTicketInput,
  updateTicketSchema,
} from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTime } from '@/components/ui/date-time';
import {
  applyApiFieldErrors,
  FormGrid,
  NativeSelectField,
  SwitchField,
  TextareaField,
} from '@/components/ui/form';
import { Identifier } from '@/components/ui/misc';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { supportApi } from '@/lib/api/endpoints/support';
import { queryKeys } from '@/lib/query-keys';

export default function SupportTicketPage() {
  return (
    <RequirePermission anyOf={[Permission.SUPPORT_READ]}>
      <TicketDetail />
    </RequirePermission>
  );
}

function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const ticket = useQuery({
    queryKey: queryKeys.support.ticket(id),
    queryFn: () => supportApi.get(id),
  });

  const updateForm = useForm<UpdateTicketInput>({
    resolver: zodResolver(updateTicketSchema),
    values: ticket.data
      ? {
          status: ticket.data.status,
          priority: ticket.data.priority,
          category: ticket.data.category,
          assignedAgentId: ticket.data.assignedAgentId,
        }
      : undefined,
  });
  const messageForm = useForm<TicketMessageInput>({
    resolver: zodResolver(ticketMessageSchema),
    defaultValues: { text: '', attachmentMediaIds: [], internal: false },
  });

  const update = useMutation({
    mutationFn: (input: UpdateTicketInput) => supportApi.update(id, input),
    onSuccess: async () => {
      toast.success(t('support.ticketUpdated'));
      await queryClient.invalidateQueries({ queryKey: queryKeys.support.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(updateForm, e)) toast.fromError(e);
    },
  });
  const reply = useMutation({
    mutationFn: (input: TicketMessageInput) => supportApi.addMessage(id, input),
    onSuccess: async () => {
      toast.success(t('support.messageSent'));
      messageForm.reset({ text: '', attachmentMediaIds: [], internal: false });
      await queryClient.invalidateQueries({ queryKey: queryKeys.support.ticket(id) });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(messageForm, e)) toast.fromError(e);
    },
  });

  if (ticket.isPending) return <SkeletonCard />;
  if (ticket.isError)
    return <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />;
  const data = ticket.data;

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[{ label: t('nav.support'), href: '/support' }, { label: data.number }]}
        title={data.subject}
        badge={
          <>
            <StatusPill group="ticketStatus" value={data.status} />
            <StatusPill group="ticketPriority" value={data.priority} />
          </>
        }
        description={`${data.number} · ${enumLabel('ticketCategory', data.category)}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={t('support.conversation')} className="lg:col-span-2" padded={false}>
          <ul className="divide-y divide-border">
            <li className="px-5 py-3">
              <p className="text-xs text-text-tertiary">{t('support.originalMessage')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{data.description}</p>
            </li>
            {data.messages.map((m) => (
              <li key={m.id} className={`px-5 py-3 ${m.internal ? 'bg-warning-soft/40' : ''}`}>
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span className="flex items-center gap-2">
                    <Badge tone={m.authorRole === 'AGENT' ? 'brand' : 'neutral'}>
                      {m.authorRole === 'AGENT' ? t('support.agent') : t('support.user')}
                    </Badge>
                    {m.authorName ?? <Identifier value={m.authorId} />}
                    {m.internal ? <Badge tone="warning">{t('support.internal')}</Badge> : null}
                  </span>
                  <DateTime value={m.createdAt} />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.text}</p>
                {m.attachmentUrls.length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-2">
                    {m.attachmentUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        {t('support.attachment')}
                      </a>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <Can anyOf={[Permission.SUPPORT_MANAGE]}>
            <form
              className="space-y-3 border-t border-border p-5"
              onSubmit={messageForm.handleSubmit((v) => reply.mutate(v))}
            >
              <TextareaField
                control={messageForm.control}
                name="text"
                label={t('support.reply')}
                required
              />
              <div className="flex items-center justify-between gap-3">
                <SwitchField
                  control={messageForm.control}
                  name="internal"
                  label={t('support.internalNote')}
                  description={t('support.internalHint')}
                />
                <Button type="submit" loading={reply.isPending}>
                  {t('support.send')}
                </Button>
              </div>
            </form>
          </Can>
        </Card>
        <div className="space-y-4">
          <Card title={t('common.details')}>
            <KeyValue
              columns={1}
              items={[
                { label: t('support.ticketNumber'), value: data.number },
                {
                  label: t('jobs.customer'),
                  value: data.customerId ? (
                    <Link
                      className="text-primary hover:underline"
                      href={`/customers/${data.customerId}`}
                    >
                      <Identifier value={data.customerId} />
                    </Link>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: t('jobs.partner'),
                  value: data.partnerId ? (
                    <Link
                      className="text-primary hover:underline"
                      href={`/partners/${data.partnerId}`}
                    >
                      <Identifier value={data.partnerId} />
                    </Link>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: t('jobs.job'),
                  value: data.jobId ? (
                    <Link className="text-primary hover:underline" href={`/jobs/${data.jobId}`}>
                      <Identifier value={data.jobId} />
                    </Link>
                  ) : (
                    '—'
                  ),
                },
                { label: t('common.createdAt'), value: <DateTime value={data.createdAt} /> },
                { label: t('common.updatedAt'), value: <DateTime value={data.updatedAt} /> },
              ]}
            />
          </Card>
          <Can anyOf={[Permission.SUPPORT_MANAGE]}>
            <Card title={t('support.manage')}>
              <form
                className="space-y-3"
                onSubmit={updateForm.handleSubmit((v) => update.mutate(v))}
              >
                <FormGrid cols={1}>
                  <NativeSelectField
                    control={updateForm.control}
                    name="status"
                    label={t('common.status')}
                    options={Object.values(TicketStatus).map((s) => ({
                      value: s,
                      label: enumLabel('ticketStatus', s),
                    }))}
                  />
                  <NativeSelectField
                    control={updateForm.control}
                    name="priority"
                    label={t('support.priority')}
                    options={Object.values(TicketPriority).map((p) => ({
                      value: p,
                      label: enumLabel('ticketPriority', p),
                    }))}
                  />
                  <NativeSelectField
                    control={updateForm.control}
                    name="category"
                    label={t('support.category')}
                    options={Object.values(TicketCategory).map((c) => ({
                      value: c,
                      label: enumLabel('ticketCategory', c),
                    }))}
                  />
                </FormGrid>
                <Button type="submit" className="w-full" loading={update.isPending}>
                  {t('common.save')}
                </Button>
              </form>
            </Card>
          </Can>
        </div>
      </div>
    </div>
  );
}
