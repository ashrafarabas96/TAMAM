'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { type AccountStatusActionInput, accountStatusActionSchema } from '@tamam/validation';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  applyApiFieldErrors,
  NativeSelectField,
  TextareaField,
  TextField,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { fromDateTimeLocalValue } from '@/lib/format/date';

const ACTIONS = ['RESTRICT', 'SUSPEND', 'REINSTATE', 'SOFT_DELETE'] as const;

/** Shared by customers and staff: POST /admin/users/:id/status & POST /admin/staff/:id/status (`accountStatusActionSchema`). */
export function AccountStatusDialog({
  open,
  onOpenChange,
  subject,
  submit,
  onDone,
  allowDelete = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subject: string;
  submit: (input: AccountStatusActionInput) => Promise<unknown>;
  onDone: () => Promise<unknown> | void;
  allowDelete?: boolean;
}) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const form = useForm<AccountStatusActionInput>({
    resolver: zodResolver(accountStatusActionSchema),
    defaultValues: { action: 'RESTRICT', reason: '', until: undefined },
  });
  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);
  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: async () => {
      toast.success(t('users.statusUpdated'));
      onOpenChange(false);
      await onDone();
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const action = form.watch('action');
  const onSubmit = form.handleSubmit((v) =>
    mutation.mutate({
      ...v,
      until: v.until ? (fromDateTimeLocalValue(v.until) ?? undefined) : undefined,
    }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('users.changeStatus')}
      description={subject}
      locked={mutation.isPending}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'REINSTATE' ? 'primary' : 'danger'}
            loading={mutation.isPending}
            onClick={onSubmit}
          >
            {t('common.apply')}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <NativeSelectField
          control={form.control}
          name="action"
          label={t('users.action')}
          options={ACTIONS.filter((a) => allowDelete || a !== 'SOFT_DELETE').map((a) => ({
            value: a,
            label: enumLabel('accountAction', a),
          }))}
          required
        />
        {action === 'RESTRICT' || action === 'SUSPEND' ? (
          <TextField
            control={form.control}
            name="until"
            label={t('users.until')}
            type="datetime-local"
            dir="ltr"
            hint={t('users.untilHint')}
          />
        ) : null}
        <TextareaField
          control={form.control}
          name="reason"
          label={t('common.reason')}
          required
          placeholder={t('common.reasonPlaceholder')}
        />
      </form>
    </Dialog>
  );
}
