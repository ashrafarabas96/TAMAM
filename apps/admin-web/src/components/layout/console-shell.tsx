'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { useSession } from '@/lib/auth/session-context';
import { cn } from '@/lib/utils/cn';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const SIDEBAR_KEY = 'tamam_sidebar_collapsed';

export function ConsoleShell({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-text-secondary">
        <Spinner /> {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 hidden bg-purple-800 transition-[width] duration-base lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-overlay"
            onClick={() => setMobileOpen(false)}
            aria-label={t('common.close')}
          />
          <aside className="absolute inset-y-0 start-0 w-72 bg-purple-800 shadow-floating animate-slide-in-end">
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-1 flex-col transition-[margin] duration-base',
          collapsed ? 'lg:ms-[72px]' : 'lg:ms-64',
        )}
      >
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={toggle}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
