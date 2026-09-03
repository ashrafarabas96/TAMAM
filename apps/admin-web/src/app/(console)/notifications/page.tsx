'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { BannerAudience, NotificationChannel, NotificationEvent, Permission } from '@tamam/shared-types';
import { type BroadcastNotificationInput, broadcastNotificationSchema, type UpsertNotificationTemplateInput, upsertNotificationTemplateSchema } from '@tamam/validation';

import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, CheckboxGroupField, FormGrid, LocalizedTextField, NativeSelectField, SwitchField, TextField } from '@/components/ui/form';
import { Card, PageHeader } from '@/components/ui/page-header';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { notificationsApi } from '@/lib/api/endpoints/notifications';
import type { NotificationTemplateRow } from '@/lib/api/types';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';
import { useZoneOptions } from '@/lib/query/reference-data';

export default function NotificationsPage() {
  return (
    <RequirePermission anyOf={[Permission.NOTIFICATION_TEMPLATES_MANAGE, Permission.NOTIFICATIONS_BROADCAST]}>
      <NotificationsScreen />
    </RequirePermission>
  );
}

function NotificationsScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('notifications.title')} description={t('notifications.subtitle')} />
      <Tabs
        items={[
          { value: 'templates', label: t('notifications.templates'), content: <Can anyOf={[Permission.NOTIFICATION_TEMPLATES_MANAGE]}><TemplatesTab /></Can> },
          { value: 'broadcast', label: t('notifications.broadcast'), content: <Can anyOf={[Permission.NOTIFICATIONS_BROADCAST]}><BroadcastTab /></Can> },
        ]}
      />
    </div>
  );
}

function TemplatesTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<NotificationTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: queryKeys.notifications.templates, queryFn: notificationsApi.templates });
  const form = useForm<UpsertNotificationTemplateInput>({ resolver: zodResolver(upsertNotificationTemplateSchema), defaultValues: { event: NotificationEvent.JOB_CREATED, channel: NotificationChannel.PUSH, title: { ar: '', en: '' }, body: { ar: '', en: '' }, isActive: true } });
  useEffect(() => {
    if (!editing && !creating) return;
    form.reset(
      editing
        ? { event: editing.event as UpsertNotificationTemplateInput['event'], channel: editing.channel as UpsertNotificationTemplateInput['channel'], title: { ar: editing.titleAr, en: editing.titleEn }, body: { ar: editing.bodyAr, en: editing.bodyEn }, isActive: editing.isActive }
        : { event: NotificationEvent.JOB_CREATED, channel: NotificationChannel.PUSH, title: { ar: '', en: '' }, body: { ar: '', en: '' }, isActive: true },
    );
  }, [editing, creating, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertNotificationTemplateInput) => notificationsApi.upsertTemplate(input),
    onSuccess: async () => {
      toast.success(t('notifications.templateSaved'));
      setEditing(null);
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  const columns: Column<NotificationTemplateRow>[] = [
    { key: 'event', header: t('notifications.event'), cell: (row) => <span className="font-mono text-xs" dir="ltr">{row.event}</span> },
    { key: 'channel', header: t('notifications.channel'), cell: (row) => <Badge tone="brand">{enumLabel('notificationChannel', row.channel)}</Badge> },
    { key: 'titleAr', header: `${t('notifications.templateTitle')} (AR)`, cell: (row) => <span className="line-clamp-1 max-w-[200px]" dir="rtl">{row.titleAr}</span> },
    { key: 'titleEn', header: `${t('notifications.templateTitle')} (EN)`, cell: (row) => <span className="line-clamp-1 max-w-[200px]" dir="ltr">{row.titleEn}</span> },
    { key: 'active', header: t('common.active'), cell: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? t('common.yes') : t('common.no')}</Badge> },
    { key: 'updated', header: t('common.updatedAt'), cell: (row) => <DateTime value={row.updatedAt} mode="relative" /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (row) => <Button size="sm" variant="outline" onClick={() => setEditing(row)}>{t('common.edit')}</Button> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating(true)}>{t('notifications.newTemplate')}</Button></div>
      <DataTable columns={columns} rows={query.data ?? []} rowKey={(row) => row.id} isLoading={query.isPending} error={query.error} onRetry={() => void query.refetch()} emptyTitle={t('notifications.noTemplates')} />
      <Dialog open={!!editing || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false); } }} size="lg" title={editing ? t('notifications.editTemplate') : t('notifications.newTemplate')} description={t('notifications.templateHint')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
        <form onSubmit={submit} className="space-y-4">
          <FormGrid cols={2}>
            <NativeSelectField control={form.control} name="event" label={t('notifications.event')} options={Object.values(NotificationEvent).map((e) => ({ value: e, label: e }))} required />
            <NativeSelectField control={form.control} name="channel" label={t('notifications.channel')} options={Object.values(NotificationChannel).map((c) => ({ value: c, label: enumLabel('notificationChannel', c) }))} required />
          </FormGrid>
          <LocalizedTextField control={form.control} name="title" label={t('notifications.templateTitle')} required />
          <LocalizedTextField control={form.control} name="body" label={t('notifications.templateBody')} multiline required />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </form>
      </Dialog>
    </div>
  );
}

function BroadcastTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const zones = useZoneOptions();
  const [confirming, setConfirming] = useState(false);
  const form = useForm<BroadcastNotificationInput>({
    resolver: zodResolver(broadcastNotificationSchema),
    defaultValues: { audiences: [BannerAudience.CUSTOMER], zoneIds: [], channels: [NotificationChannel.PUSH, NotificationChannel.IN_APP], title: { ar: '', en: '' }, body: { ar: '', en: '' }, reason: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: BroadcastNotificationInput) => notificationsApi.broadcast({ ...input, scheduledFor: input.scheduledFor ? (fromDateTimeLocalValue(input.scheduledFor) ?? undefined) : undefined }),
    onSuccess: () => {
      toast.success(t('notifications.broadcastQueued'));
      setConfirming(false);
      form.reset();
    },
    onError: (e) => {
      setConfirming(false);
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  return (
    <Card title={t('notifications.broadcast')} description={t('notifications.broadcastHint')}>
      <form className="space-y-4" onSubmit={form.handleSubmit(() => setConfirming(true))}>
        <CheckboxGroupField control={form.control} name="audiences" label={t('campaigns.audiences')} options={Object.values(BannerAudience).map((a) => ({ value: a, label: enumLabel('bannerAudience', a) }))} required />
        <CheckboxGroupField control={form.control} name="channels" label={t('notifications.channels')} options={Object.values(NotificationChannel).map((c) => ({ value: c, label: enumLabel('notificationChannel', c) }))} required />
        <CheckboxGroupField control={form.control} name="zoneIds" label={t('common.zones')} options={zones.options} hint={t('campaigns.emptyMeansAll')} />
        <LocalizedTextField control={form.control} name="title" label={t('notifications.templateTitle')} required />
        <LocalizedTextField control={form.control} name="body" label={t('notifications.templateBody')} multiline required />
        <FormGrid cols={2}>
          <TextField control={form.control} name="deepLink" label={t('notifications.deepLink')} dir="ltr" hint={t('campaigns.actionHint.DEEP_LINK')} />
          <TextField control={form.control} name="scheduledFor" label={t('notifications.scheduledFor')} type="datetime-local" dir="ltr" />
        </FormGrid>
        <TextField control={form.control} name="reason" label={t('common.reason')} required />
        <Button type="submit" variant="accent">{t('notifications.review')}</Button>
      </form>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('notifications.confirmTitle')}
        description={t('notifications.confirmDescription')}
        loading={mutation.isPending}
        confirmLabel={t('notifications.send')}
        onConfirm={() => mutation.mutate(form.getValues())}
      />
    </Card>
  );
}
