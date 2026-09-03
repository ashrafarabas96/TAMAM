'use client';

import { KeyRound, Languages, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { StatusPill } from '@/components/ui/status-pill';
import { Tooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { useSession } from '@/lib/auth/session-context';
import { useTheme } from '@/lib/theme';

import { GlobalSearch } from './global-search';

export function Topbar({ collapsed, onToggleSidebar, onOpenMobile }: { collapsed: boolean; onToggleSidebar: () => void; onOpenMobile: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { resolved, toggle } = useTheme();
  const { user, logout } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label={t('nav.openMenu')}>
        <Menu className="h-5 w-5" aria-hidden />
      </Button>
      <Tooltip content={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}>
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}>
          {collapsed ? <PanelLeftOpen className="h-5 w-5 rtl:-scale-x-100" aria-hidden /> : <PanelLeftClose className="h-5 w-5 rtl:-scale-x-100" aria-hidden />}
        </Button>
      </Tooltip>
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-1">
        <Tooltip content={locale === 'ar' ? 'English' : 'العربية'}>
          <Button variant="ghost" size="icon" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} aria-label={t('nav.toggleLanguage')}>
            <Languages className="h-5 w-5" aria-hidden />
          </Button>
        </Tooltip>
        <Tooltip content={resolved === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('nav.toggleTheme')}>
            {resolved === 'dark' ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </Button>
        </Tooltip>
        <DropdownMenu
          align="end"
          trigger={
            <button type="button" className="ms-1 flex items-center gap-2 rounded-pill p-1 pe-3 hover:bg-surface-alt" aria-label={t('nav.staffMenu')}>
              <Avatar name={user?.fullName ?? user?.email ?? ''} src={user?.profileImageUrl} size="sm" />
              <span className="hidden text-start md:block">
                <span className="block max-w-[160px] truncate text-xs font-semibold text-text-primary">{user?.fullName ?? user?.email ?? '—'}</span>
                <span className="block text-[10px] text-text-tertiary">{user?.roles.length ? <StatusPill group="userRole" value={user.roles[0]} className="px-1.5 py-0 text-[10px]" /> : null}</span>
              </span>
            </button>
          }
          items={[
            { key: 'account', label: <Link href="/account">{t('nav.account')}</Link>, icon: <UserRound />, href: '/account' },
            { key: 'password', label: t('account.changePassword'), icon: <KeyRound />, href: '/account?tab=password' },
            { key: 'logout', label: t('nav.logout'), icon: <LogOut />, danger: true, separatorBefore: true, onSelect: () => void logout() },
          ]}
        />
      </div>
    </header>
  );
}
