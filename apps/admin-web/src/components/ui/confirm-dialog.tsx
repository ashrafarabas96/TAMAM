'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { useT } from '@/i18n';

import { Button } from './button';
import { Dialog } from './dialog';
import { Textarea } from './input';
import { Label } from './label';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Ask for a free-text reason (sent to the API for the audit trail). */
  requireReason?: boolean;
  reasonMinLength?: number;
  reasonLabel?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
  children?: ReactNode;
}

/** Every sensitive mutation goes through this: explicit confirm, optional reason, no double submit. */
export function ConfirmDialog({ open, onOpenChange, title, description, requireReason = false, reasonMinLength = 5, reasonLabel, confirmLabel, tone = 'primary', loading = false, onConfirm, children }: ConfirmDialogProps) {
  const t = useT();
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);
  const reasonValid = !requireReason || reason.trim().length >= reasonMinLength;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      locked={loading}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} disabled={!reasonValid} onClick={() => void onConfirm(reason.trim())}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {children}
      {requireReason ? (
        <div className="mt-2">
          <Label htmlFor="confirm-reason" required>
            {reasonLabel ?? t('common.reason')}
          </Label>
          <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('common.reasonPlaceholder')} maxLength={500} autoFocus />
          <p className="mt-1 text-xs text-text-tertiary">{t('common.reasonHint', { min: reasonMinLength })}</p>
        </div>
      ) : null}
    </Dialog>
  );
}
