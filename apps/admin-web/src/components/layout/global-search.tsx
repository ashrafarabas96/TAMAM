'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Permission } from '@tamam/shared-types';

import { SearchInput } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/spinner';
import { StatusPill } from '@/components/ui/status-pill';
import { useI18n } from '@/i18n';
import { adminApi } from '@/lib/api/endpoints/admin';
import { useSession } from '@/lib/auth/session-context';
import { formatMinor } from '@/lib/format/money';
import { queryKeys } from '@/lib/query-keys';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Top-bar search hitting `GET /admin/search`; groups only appear when the user may read them. */
export function GlobalSearch() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { permissions } = useSession();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q.trim(), 300);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const allowed = permissions.canAny(Permission.JOBS_READ_ALL, Permission.CUSTOMERS_READ, Permission.PARTNERS_READ, Permission.PAYMENTS_READ, Permission.SUPPORT_READ, Permission.DISPUTES_READ);

  const query = useQuery({
    queryKey: queryKeys.search(debounced),
    queryFn: ({ signal }) => adminApi.search(debounced, signal),
    enabled: allowed && debounced.length >= 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!allowed) return null;

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  const data = query.data;
  const hasAny = !!data && [data.jobs, data.customers, data.partners, data.vehicles, data.payments, data.tickets, data.disputes].some((g) => g && g.length > 0);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <SearchInput value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} className="w-full" />
      {open && debounced.length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-floating animate-fade-in">
          {query.isPending ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-text-secondary">
              <Spinner className="h-4 w-4" /> {t('common.loading')}
            </div>
          ) : query.isError ? (
            <p className="px-3 py-4 text-xs text-danger">{t('errors.loadFailed')}</p>
          ) : !hasAny ? (
            <p className="px-3 py-4 text-xs text-text-secondary">{t('search.noResults', { q: debounced })}</p>
          ) : (
            <div className="space-y-2">
              {data?.jobs && data.jobs.length > 0 ? (
                <Group title={t('nav.jobs')}>
                  {data.jobs.map((j) => (
                    <Row key={j.id} onClick={() => go(`/jobs/${j.id}`)} primary={j.number} secondary={<><StatusPill group="jobType" value={j.type} /> <StatusPill group="jobStatus" value={j.status} /></>} />
                  ))}
                </Group>
              ) : null}
              {data?.customers && data.customers.length > 0 ? (
                <Group title={t('nav.customers')}>
                  {data.customers.map((c) => (
                    <Row key={c.id} onClick={() => go(`/customers/${c.id}`)} primary={c.fullName ?? c.phone} secondary={<span dir="ltr">{c.phone}</span>} trailing={<StatusPill group="accountStatus" value={c.accountStatus} />} />
                  ))}
                </Group>
              ) : null}
              {data?.partners && data.partners.length > 0 ? (
                <Group title={t('nav.partners')}>
                  {data.partners.map((p) => (
                    <Row key={p.id} onClick={() => go(`/partners/${p.id}`)} primary={p.fullName ?? p.phone} secondary={<span dir="ltr">{p.phone}</span>} trailing={<><StatusPill group="verificationStatus" value={p.verificationStatus} /> <StatusPill group="availability" value={p.availability} /></>} />
                  ))}
                </Group>
              ) : null}
              {data?.vehicles && data.vehicles.length > 0 ? (
                <Group title={t('search.vehicles')}>
                  {data.vehicles.map((v) => (
                    <Row key={v.id} onClick={() => go(`/partners/${v.partnerId}?tab=vehicles`)} primary={<span dir="ltr">{v.plate}</span>} secondary={`${v.brand} ${v.model}`} trailing={<StatusPill group="verificationStatus" value={v.verificationStatus} />} />
                  ))}
                </Group>
              ) : null}
              {data?.payments && data.payments.length > 0 ? (
                <Group title={t('search.payments')}>
                  {data.payments.map((p) => (
                    <Row key={p.id} onClick={() => go(`/finance/payments/${p.id}`)} primary={formatMinor(p.amountMinor, p.currency, { locale })} secondary={p.providerRef ?? p.id} trailing={<StatusPill group="paymentStatus" value={p.status} />} />
                  ))}
                </Group>
              ) : null}
              {data?.tickets && data.tickets.length > 0 ? (
                <Group title={t('nav.support')}>
                  {data.tickets.map((tk) => (
                    <Row key={tk.id} onClick={() => go(`/support/${tk.id}`)} primary={`${tk.number} · ${tk.subject}`} trailing={<StatusPill group="ticketStatus" value={tk.status} />} />
                  ))}
                </Group>
              ) : null}
              {data?.disputes && data.disputes.length > 0 ? (
                <Group title={t('nav.disputes')}>
                  {data.disputes.map((d) => (
                    <Row key={d.id} onClick={() => go(`/disputes/${d.id}`)} primary={d.number} trailing={<StatusPill group="disputeStatus" value={d.status} />} />
                  ))}
                </Group>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ primary, secondary, trailing, onClick }: { primary: React.ReactNode; secondary?: React.ReactNode; trailing?: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm hover:bg-surface-brand-soft">
        <span className="min-w-0">
          <span className="block truncate font-medium text-text-primary">{primary}</span>
          {secondary ? <span className="block truncate text-xs text-text-secondary">{secondary}</span> : null}
        </span>
        {trailing ? <span className="flex shrink-0 items-center gap-1">{trailing}</span> : null}
      </button>
    </li>
  );
}
