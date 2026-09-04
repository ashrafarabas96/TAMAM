'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useI18n } from '@/i18n';
import { useSession } from '@/lib/auth/session-context';
import { cn } from '@/lib/utils/cn';

import { NAV_GROUPS } from './nav';

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { permissions } = useSession();

  return (
    <nav className="flex h-full flex-col" aria-label={t('nav.main')}>
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-purple-700/40 px-4"
        onClick={onNavigate}
      >
        <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0" />
        {!collapsed ? (
          <span className="leading-tight">
            <span className="block text-base font-extrabold tracking-wide text-neutral-0">
              TAMAM
            </span>
            <span className="block text-[11px] text-purple-200">{t('app.consoleName')}</span>
          </span>
        ) : null}
      </Link>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => permissions.canAny(...item.permissions));
          if (items.length === 0) return null;
          return (
            <div key={group.labelKey} className="mb-3">
              {!collapsed ? (
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  {t(group.labelKey)}
                </p>
              ) : (
                <div className="mx-3 my-2 h-px bg-purple-700/40" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? t(item.labelKey) : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                          active
                            ? 'bg-purple-700 text-neutral-0 shadow-card'
                            : 'text-purple-100 hover:bg-purple-600/70 hover:text-neutral-0',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        {active ? (
                          <span
                            className="absolute inset-y-2 start-0 w-1 rounded-e-pill bg-accent"
                            aria-hidden
                          />
                        ) : null}
                        <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                        {!collapsed ? <span className="truncate">{t(item.labelKey)}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
