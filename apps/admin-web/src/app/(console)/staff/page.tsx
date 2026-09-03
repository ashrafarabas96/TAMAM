'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ADMIN_ROLES, ALL_PERMISSIONS, Permission, SENSITIVE_PERMISSIONS, UserRole } from '@tamam/shared-types';
import { type CreateAdminUserInput, createAdminUserSchema, type UpdateAdminRolesInput, updateAdminRolesSchema, type UpsertRoleInput, upsertRoleSchema } from '@tamam/validation';

import { AccountStatusDialog } from '@/components/domain/users/account-status-dialog';
import { Can, RequirePermission } from '@/components/layout/require-permission';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { type Column, DataTable } from '@/components/ui/data-table';
import { DateTime } from '@/components/ui/date-time';
import { Dialog } from '@/components/ui/dialog';
import { applyApiFieldErrors, CheckboxGroupField, FormGrid, TextareaField, TextField } from '@/components/ui/form';
import { Avatar, FilterBar, Identifier, SearchInput } from '@/components/ui/misc';
import { Card, PageHeader } from '@/components/ui/page-header';
import { SkeletonRows } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { StatusPill } from '@/components/ui/status-pill';
import { Tabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { adminApi } from '@/lib/api/endpoints/admin';
import { rbacApi } from '@/lib/api/endpoints/rbac';
import type { RoleDto, StaffUserDto } from '@/lib/api/types';
import { queryKeys } from '@/lib/query-keys';
import { useCursorList } from '@/lib/query/use-cursor-list';

export default function StaffPage() {
  return (
    <RequirePermission anyOf={[Permission.ADMIN_USERS_MANAGE, Permission.ROLES_MANAGE]}>
      <StaffScreen />
    </RequirePermission>
  );
}

function StaffScreen() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('staff.title')} description={t('staff.subtitle')} />
      <Tabs
        items={[
          { value: 'users', label: t('staff.users'), content: <Can anyOf={[Permission.ADMIN_USERS_MANAGE]}><StaffUsersTab /></Can> },
          { value: 'roles', label: t('staff.roles'), content: <Can anyOf={[Permission.ROLES_MANAGE]}><RolesMatrixTab /></Can> },
        ]}
      />
    </div>
  );
}

function StaffUsersTab() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [rolesFor, setRolesFor] = useState<StaffUserDto | null>(null);
  const [statusFor, setStatusFor] = useState<StaffUserDto | null>(null);
  const [resetFor, setResetFor] = useState<StaffUserDto | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const filters = useMemo(() => ({ q: q || undefined }), [q]);
  const list = useCursorList<StaffUserDto>({ queryKey: queryKeys.staff.list(filters), fetchPage: (cursor) => adminApi.staffList({ ...filters, cursor, limit: 30 }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });

  const reset = useMutation({
    mutationFn: (input: { id: string; reason: string }) => adminApi.staffResetPassword(input.id, input.reason),
    onSuccess: async (result) => {
      setTemporaryPassword(result.temporaryPassword);
      setResetFor(null);
      toast.success(t('staff.passwordReset'), t('staff.sessionsRevoked', { count: result.revokedSessions }));
      await invalidate();
    },
    onError: (e) => toast.fromError(e),
  });

  const columns: Column<StaffUserDto>[] = [
    { key: 'name', header: t('common.name'), cell: (s) => <span className="flex items-center gap-2"><Avatar name={s.user.fullName} src={s.user.profileImageUrl} size="sm" /><span><span className="block font-medium">{s.user.fullName ?? '—'}</span><span className="block text-xs text-text-secondary" dir="ltr">{s.email ?? s.user.email ?? ''}</span></span></span> },
    { key: 'roles', header: t('staff.roles'), cell: (s) => <span className="flex flex-wrap gap-1">{s.user.roles.map((r) => <StatusPill key={r} group="userRole" value={r} />)}</span> },
    { key: 'status', header: t('common.status'), cell: (s) => <StatusPill group="accountStatus" value={s.user.accountStatus} /> },
    { key: 'mustChange', header: t('staff.mustChangePassword'), cell: (s) => (s.mustChangePassword ? <Badge tone="warning">{t('common.yes')}</Badge> : <Badge tone="neutral">{t('common.no')}</Badge>) },
    { key: 'locked', header: t('staff.lockedUntil'), cell: (s) => <DateTime value={s.lockedUntil} /> },
    { key: 'lastLogin', header: t('staff.lastLogin'), cell: (s) => <DateTime value={s.lastLoginAt} mode="relative" /> },
    { key: 'id', header: t('common.id'), cell: (s) => <Identifier value={s.user.id} /> },
    { key: 'actions', header: t('common.actions'), align: 'end', cell: (s) => (
      <div className="flex justify-end gap-1">
        <Can anyOf={[Permission.ROLES_MANAGE]}><Button size="sm" variant="ghost" onClick={() => setRolesFor(s)}>{t('staff.editRoles')}</Button></Can>
        <Button size="sm" variant="outline" onClick={() => setResetFor(s)}>{t('staff.resetPassword')}</Button>
        <Button size="sm" variant="danger-soft" onClick={() => setStatusFor(s)}>{t('users.changeStatus')}</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <FilterBar>
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('staff.searchPlaceholder')} className="min-w-[240px]" />
        <Button size="sm" className="ms-auto" onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />{t('staff.newUser')}</Button>
      </FilterBar>
      <DataTable columns={columns} rows={list.items} rowKey={(s) => s.user.id} isLoading={list.isLoading} error={list.error} onRetry={() => void list.refetch()} hasMore={list.hasMore} onLoadMore={list.loadMore} isLoadingMore={list.isLoadingMore} emptyTitle={t('staff.empty')} />
      <CreateStaffDialog open={creating} onOpenChange={setCreating} onCreated={(password) => setTemporaryPassword(password)} />
      <RolesDialog staff={rolesFor} onClose={() => setRolesFor(null)} />
      {statusFor ? <AccountStatusDialog open onOpenChange={(o) => !o && setStatusFor(null)} subject={statusFor.user.fullName ?? statusFor.email ?? ''} submit={(input) => adminApi.staffChangeStatus(statusFor.user.id, input)} onDone={invalidate} /> : null}
      <ConfirmDialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)} title={t('staff.resetPassword')} description={t('staff.resetHint')} requireReason loading={reset.isPending} tone="danger" onConfirm={(reason) => { if (resetFor) reset.mutate({ id: resetFor.user.id, reason }); }} />
      <Dialog open={!!temporaryPassword} onOpenChange={(o) => !o && setTemporaryPassword(null)} size="sm" title={t('staff.temporaryPassword')} description={t('staff.temporaryPasswordHint')} footer={<Button onClick={() => setTemporaryPassword(null)}>{t('common.close')}</Button>}>
        <p className="select-all rounded-md bg-surface-alt p-3 text-center font-mono text-lg font-bold" dir="ltr">{temporaryPassword}</p>
      </Dialog>
    </div>
  );
}

function CreateStaffDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (password: string) => void }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<CreateAdminUserInput>({ resolver: zodResolver(createAdminUserSchema), defaultValues: { email: '', fullName: '', roles: [UserRole.SUPPORT], temporaryPassword: '' } });
  useEffect(() => {
    if (open) form.reset({ email: '', fullName: '', roles: [UserRole.SUPPORT], temporaryPassword: '' });
  }, [open, form]);
  const mutation = useMutation({
    mutationFn: (input: CreateAdminUserInput) => adminApi.staffCreate(input),
    onSuccess: async () => {
      toast.success(t('staff.userCreated'));
      onCreated(form.getValues('temporaryPassword'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('staff.newUser')} description={t('staff.newUserHint')} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.create')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormGrid cols={2}>
          <TextField control={form.control} name="fullName" label={t('common.name')} required />
          <TextField control={form.control} name="email" label={t('common.email')} type="email" dir="ltr" required />
          <TextField control={form.control} name="phone" label={t('common.phone')} dir="ltr" hint="+9705…" />
          <TextField control={form.control} name="temporaryPassword" label={t('staff.temporaryPassword')} dir="ltr" required hint={t('staff.passwordHint')} />
        </FormGrid>
        <CheckboxGroupField control={form.control} name="roles" label={t('staff.roles')} options={ADMIN_ROLES.map((r) => ({ value: r, label: enumLabel('userRole', r) }))} required />
      </form>
    </Dialog>
  );
}

function RolesDialog({ staff, onClose }: { staff: StaffUserDto | null; onClose: () => void }) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UpdateAdminRolesInput>({ resolver: zodResolver(updateAdminRolesSchema), defaultValues: { roles: [], reason: '' } });
  useEffect(() => {
    if (staff) form.reset({ roles: staff.user.roles.filter((r) => (ADMIN_ROLES as readonly string[]).includes(r)), reason: '' });
  }, [staff, form]);
  const mutation = useMutation({
    mutationFn: (input: UpdateAdminRolesInput) => adminApi.staffUpdateRoles(staff?.user.id ?? '', input),
    onSuccess: async () => {
      toast.success(t('staff.rolesUpdated'));
      onClose();
      await queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={!!staff} onOpenChange={(o) => !o && onClose()} title={t('staff.editRoles')} description={staff?.user.fullName ?? staff?.email ?? undefined} locked={mutation.isPending} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <CheckboxGroupField control={form.control} name="roles" label={t('staff.roles')} options={ADMIN_ROLES.map((r) => ({ value: r, label: enumLabel('userRole', r) }))} required />
        <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
      </form>
    </Dialog>
  );
}

/** Roles × permissions matrix backed by GET/PUT /admin/rbac/roles. */
function RolesMatrixTab() {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: queryKeys.staff.roles, queryFn: rbacApi.roles });
  const permissions = useQuery({ queryKey: queryKeys.staff.permissions, queryFn: rbacApi.permissions });
  const [editing, setEditing] = useState<RoleDto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const form = useForm<UpsertRoleInput>({ resolver: zodResolver(upsertRoleSchema), defaultValues: { name: '', permissions: [], reason: '' } });

  useEffect(() => {
    if (!editing) return;
    setSelected(new Set(editing.permissions));
    form.reset({ name: editing.name, description: editing.description ?? undefined, permissions: editing.permissions, reason: '' });
  }, [editing, form]);

  const mutation = useMutation({
    mutationFn: (input: UpsertRoleInput) => rbacApi.upsertRole(input),
    onSuccess: async () => {
      toast.success(t('staff.roleSaved'));
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.staff.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });

  const catalog = permissions.data ?? ALL_PERMISSIONS.map((key) => ({ key, sensitive: (SENSITIVE_PERMISSIONS as readonly string[]).includes(key) }));
  const groups = useMemo(() => {
    const map = new Map<string, Array<{ key: string; sensitive: boolean }>>();
    for (const entry of catalog) {
      const group = entry.key.split('.')[0] ?? 'other';
      map.set(group, [...(map.get(group) ?? []), entry]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  if (roles.isPending) return <SkeletonRows rows={6} />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />;

  return (
    <div className="space-y-4">
      <Card title={t('staff.matrix')} description={t('staff.matrixHint')} padded={false}>
        <div className="scrollbar-thin overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-surface-alt text-[11px] uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-2 text-start">{t('staff.permission')}</th>
                {roles.data.map((role) => (
                  <th key={role.id} className="px-3 py-2 text-center">
                    <span className="block font-semibold">{enumLabel('userRole', role.name)}</span>
                    <span className="block text-[10px] font-normal text-text-tertiary">{t('staff.userCount', { count: role.userCount })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, entries]) => (
                <Fragment key={group}>
                  <tr className="bg-surface-alt/60">
                    <td className="px-4 py-1.5 text-xs font-bold text-text-secondary" colSpan={roles.data.length + 1}>{group}</td>
                  </tr>
                  {entries.map((entry) => (
                    <tr key={entry.key} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs" dir="ltr">{entry.key}</span>
                        {entry.sensitive ? <Badge tone="danger" className="ms-2">{t('staff.sensitive')}</Badge> : null}
                      </td>
                      {roles.data.map((role) => (
                        <td key={role.id} className="px-3 py-2 text-center">
                          {role.name === UserRole.SUPER_ADMIN || role.permissions.includes(entry.key) ? <Check className="mx-auto h-4 w-4 text-success" aria-label={t('common.yes')} /> : <X className="mx-auto h-4 w-4 text-text-tertiary" aria-label={t('common.no')} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        {roles.data.map((role) => (
          <Button key={role.id} size="sm" variant="outline" disabled={role.name === UserRole.SUPER_ADMIN} onClick={() => setEditing(role)}>
            {t('staff.editRole', { role: enumLabel('userRole', role.name) })}
          </Button>
        ))}
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        size="xl"
        title={t('staff.editRolePermissions')}
        description={editing ? enumLabel('userRole', editing.name) : undefined}
        locked={mutation.isPending}
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button loading={mutation.isPending} onClick={form.handleSubmit((v) => mutation.mutate({ ...v, permissions: [...selected] }))}>{t('common.save')}</Button></>}
      >
        <div className="space-y-4">
          {groups.map(([group, entries]) => (
            <div key={group}>
              <p className="mb-1 text-xs font-bold uppercase text-text-secondary">{group}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry) => (
                  <Checkbox
                    key={entry.key}
                    checked={selected.has(entry.key)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(entry.key);
                        else next.delete(entry.key);
                        return next;
                      })
                    }
                    label={<span className="font-mono text-xs" dir="ltr">{entry.key}</span>}
                    description={entry.sensitive ? t('staff.sensitive') : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
          <TextareaField control={form.control} name="reason" label={t('common.reason')} required placeholder={t('common.reasonPlaceholder')} />
        </div>
      </Dialog>
    </div>
  );
}
