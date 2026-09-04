'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { type UpsertRestrictionInput, upsertRestrictionSchema } from '@tamam/validation';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  applyApiFieldErrors,
  FormGrid,
  NativeSelectField,
  TextareaField,
  TextField,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { riskApi } from '@/lib/api/endpoints/risk';
import { fromDateTimeLocalValue } from '@/lib/format/date';
import { queryKeys } from '@/lib/query-keys';

const KINDS = [
  'BLOCK_JOBS',
  'BLOCK_PROMOS',
  'BLOCK_WALLET',
  'BLOCK_LOGIN',
  'REQUIRE_REVIEW',
] as const;
const TARGETS = ['USER', 'PARTNER', 'DEVICE'] as const;

export function RestrictionDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target?: { targetType: (typeof TARGETS)[number]; targetId: string };
}) {
  const { t, enumLabel } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UpsertRestrictionInput>({
    resolver: zodResolver(upsertRestrictionSchema),
    defaultValues: {
      targetType: target?.targetType ?? 'USER',
      targetId: target?.targetId ?? '',
      kind: 'BLOCK_JOBS',
      reason: '',
      expiresAt: null,
    },
  });
  useEffect(() => {
    if (open)
      form.reset({
        targetType: target?.targetType ?? 'USER',
        targetId: target?.targetId ?? '',
        kind: 'BLOCK_JOBS',
        reason: '',
        expiresAt: null,
      });
  }, [open, target, form]);
  const mutation = useMutation({
    mutationFn: (input: UpsertRestrictionInput) =>
      riskApi.createRestriction({
        ...input,
        expiresAt: input.expiresAt ? fromDateTimeLocalValue(input.expiresAt) : null,
      }),
    onSuccess: async () => {
      toast.success(t('risk.restrictionCreated'));
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.risk.all });
    },
    onError: (e) => {
      if (!applyApiFieldErrors(form, e)) toast.fromError(e);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('risk.newRestriction')}
      size="sm"
      locked={mutation.isPending}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={submit}>
            {t('common.apply')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <FormGrid cols={2}>
          <NativeSelectField
            control={form.control}
            name="targetType"
            label={t('risk.target')}
            options={TARGETS.map((x) => ({
              value: x,
              label: enumLabel('restrictionTargetType', x),
            }))}
            required
          />
          <NativeSelectField
            control={form.control}
            name="kind"
            label={t('risk.kind')}
            options={KINDS.map((k) => ({ value: k, label: enumLabel('restrictionKind', k) }))}
            required
          />
        </FormGrid>
        <TextField
          control={form.control}
          name="targetId"
          label={t('risk.targetId')}
          dir="ltr"
          required
        />
        <TextField
          control={form.control}
          name="expiresAt"
          label={t('risk.expiresAt')}
          type="datetime-local"
          dir="ltr"
          hint={t('risk.expiresHint')}
        />
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
