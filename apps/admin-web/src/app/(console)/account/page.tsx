'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import type { DeviceSessionDto } from '@tamam/shared-types';
import { type AdminChangePasswordInput, adminChangePasswordSchema } from '@tamam/validation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { applyApiFieldErrors, TextField } from '@/components/ui/form';
import { Avatar } from '@/components/ui/misc';
import { Card, KeyValue, PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { authApi } from '@/lib/api/endpoints/auth';
import { useSession } from '@/lib/auth/session-context';
import { queryKeys } from '@/lib/query-keys';

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountScreen />
    </Suspense>
  );
}

function AccountScreen() {
  const { t } = useI18n();
  const params = useSearchParams();
  const { user, logout } = useSession();
  const tab =
    params.get('tab') === 'password'
      ? 'password'
      : params.get('tab') === 'sessions'
        ? 'sessions'
        : 'profile';
  return (
    <div>
      <PageHeader
        title={t('account.title')}
        description={t('account.subtitle')}
        actions={
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            {t('nav.logout')}
          </Button>
        }
      />
      <Tabs
        defaultValue={tab}
        items={[
          {
            value: 'profile',
            label: t('account.profile'),
            content: (
              <Card title={t('account.profile')}>
                <div className="mb-4 flex items-center gap-3">
                  <Avatar
                    name={user?.fullName ?? user?.email ?? ''}
                    src={user?.profileImageUrl}
                    size="lg"
                  />
                  <div>
                    <p className="text-lg font-bold">{user?.fullName ?? '—'}</p>
                    <p className="text-sm text-text-secondary" dir="ltr">
                      {user?.email ?? user?.phone ?? ''}
                    </p>
                  </div>
                </div>
                <KeyValue
                  columns={3}
                  items={[
                    {
                      label: t('staff.roles'),
                      value: (
                        <span className="flex flex-wrap gap-1">
                          {(user?.roles ?? []).map((r) => (
                            <StatusPill key={r} group="userRole" value={r} />
                          ))}
                        </span>
                      ),
                    },
                    {
                      label: t('common.status'),
                      value: <StatusPill group="accountStatus" value={user?.accountStatus} />,
                    },
                    { label: t('common.language'), value: (user?.language ?? 'ar').toUpperCase() },
                    {
                      label: t('common.phone'),
                      value: <span dir="ltr">{user?.phone ?? '—'}</span>,
                    },
                    {
                      label: t('common.createdAt'),
                      value: <DateTime value={user?.createdAt} mode="date" />,
                    },
                  ]}
                />
              </Card>
            ),
          },
          { value: 'password', label: t('account.changePassword'), content: <PasswordTab /> },
          { value: 'sessions', label: t('account.sessions'), content: <SessionsTab /> },
        ]}
      />
    </div>
  );
}

function PasswordTab() {
  const { t } = useI18n();
  const toast = useToast();
  const { logout } = useSession();
  const form = useForm<AdminChangePasswordInput>({
    resolver: zodResolver(adminChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: AdminChangePasswordInput) => authApi.changePassword(input),
    onSuccess: async () => {
      toast.success(t('account.passwordChanged'), t('account.passwordChangedHint'));
      form.reset();
      await logout();
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  return (
    <Card title={t('account.changePassword')} description={t('account.passwordHint')}>
      <form className="max-w-md space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <TextField
          control={form.control}
          name="currentPassword"
          label={t('account.currentPassword')}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
        />
        <TextField
          control={form.control}
          name="newPassword"
          label={t('account.newPassword')}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          hint={t('account.passwordRules')}
        />
        <Button type="submit" loading={mutation.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}

function SessionsTab() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.account.sessions, queryFn: authApi.sessions });
  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: async () => {
      toast.success(t('account.sessionRevoked'));
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions });
    },
    onError: (e) => toast.fromError(e),
  });
  const columns: Column<DeviceSessionDto>[] = [
    {
      key: 'device',
      header: t('account.device'),
      cell: (s) => (
        <span>
          <span className="block font-medium">{s.deviceName ?? s.platform}</span>
          <span className="block font-mono text-[11px] text-text-tertiary" dir="ltr">
            {s.deviceId}
          </span>
        </span>
      ),
    },
    {
      key: 'platform',
      header: t('account.platform'),
      cell: (s) => <Badge tone="neutral">{s.platform}</Badge>,
    },
    {
      key: 'version',
      header: t('account.appVersion'),
      cell: (s) => <span dir="ltr">{s.appVersion ?? '—'}</span>,
    },
    {
      key: 'lastSeen',
      header: t('account.lastSeen'),
      cell: (s) => <DateTime value={s.lastSeenAt} mode="relative" />,
    },
    {
      key: 'created',
      header: t('common.createdAt'),
      cell: (s) => <DateTime value={s.createdAt} />,
    },
    {
      key: 'current',
      header: t('account.current'),
      cell: (s) => (s.current ? <Badge tone="success">{t('common.yes')}</Badge> : null),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'end',
      cell: (s) =>
        !s.current ? (
          <Button
            size="sm"
            variant="danger-soft"
            loading={revoke.isPending && revoke.variables === s.id}
            onClick={() => revoke.mutate(s.id)}
          >
            {t('account.revoke')}
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={query.data ?? []}
      rowKey={(s) => s.id}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      emptyTitle={t('account.noSessions')}
    />
  );
}
