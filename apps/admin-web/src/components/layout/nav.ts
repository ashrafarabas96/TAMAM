import {
  Activity,
  BadgePercent,
  Bell,
  Boxes,
  ClipboardList,
  Coins,
  FileBarChart2,
  Gavel,
  Headset,
  LayoutDashboard,
  type LucideIcon,
  Map,
  MapPinned,
  Megaphone,
  Radar,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';

import { Permission } from '@tamam/shared-types';

import type { TranslationKey } from '@/i18n';

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Visible when the user holds ANY of these permissions. Empty = always visible. */
  permissions: readonly Permission[];
}

export interface NavGroup {
  labelKey: TranslationKey;
  items: NavItem[];
}

const P = Permission;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: 'nav.group.operations',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permissions: [P.ANALYTICS_READ] },
      { href: '/live-map', labelKey: 'nav.liveMap', icon: Map, permissions: [P.TRACKING_VIEW_LIVE_MAP] },
      { href: '/dispatch', labelKey: 'nav.dispatch', icon: Radar, permissions: [P.JOBS_READ_ALL] },
      { href: '/jobs', labelKey: 'nav.jobs', icon: ClipboardList, permissions: [P.JOBS_READ_ALL] },
    ],
  },
  {
    labelKey: 'nav.group.people',
    items: [
      { href: '/customers', labelKey: 'nav.customers', icon: Users, permissions: [P.CUSTOMERS_READ] },
      { href: '/partners', labelKey: 'nav.partners', icon: Truck, permissions: [P.PARTNERS_READ] },
    ],
  },
  {
    labelKey: 'nav.group.catalog',
    items: [
      { href: '/services', labelKey: 'nav.services', icon: Boxes, permissions: [P.SERVICES_READ] },
      { href: '/zones', labelKey: 'nav.zones', icon: MapPinned, permissions: [P.ZONES_READ] },
      { href: '/pricing', labelKey: 'nav.pricing', icon: Coins, permissions: [P.PRICING_READ] },
    ],
  },
  {
    labelKey: 'nav.group.growth',
    items: [
      { href: '/promotions', labelKey: 'nav.promotions', icon: BadgePercent, permissions: [P.PROMOS_MANAGE, P.REFERRALS_MANAGE] },
      { href: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone, permissions: [P.CAMPAIGNS_READ] },
      { href: '/notifications', labelKey: 'nav.notifications', icon: Bell, permissions: [P.NOTIFICATIONS_BROADCAST, P.NOTIFICATION_TEMPLATES_MANAGE] },
    ],
  },
  {
    labelKey: 'nav.group.finance',
    items: [
      { href: '/finance', labelKey: 'nav.finance', icon: Activity, permissions: [P.PAYMENTS_READ, P.LEDGER_READ, P.WITHDRAWALS_MANAGE, P.COMMISSION_MANAGE] },
      { href: '/reports', labelKey: 'nav.reports', icon: FileBarChart2, permissions: [P.ANALYTICS_READ] },
    ],
  },
  {
    labelKey: 'nav.group.trust',
    items: [
      { href: '/support', labelKey: 'nav.support', icon: Headset, permissions: [P.SUPPORT_READ] },
      { href: '/disputes', labelKey: 'nav.disputes', icon: Gavel, permissions: [P.DISPUTES_READ] },
      { href: '/risk', labelKey: 'nav.risk', icon: ShieldAlert, permissions: [P.RISK_READ] },
    ],
  },
  {
    labelKey: 'nav.group.platform',
    items: [
      { href: '/config', labelKey: 'nav.config', icon: Settings2, permissions: [P.CONFIG_READ] },
      { href: '/staff', labelKey: 'nav.staff', icon: UserCog, permissions: [P.ADMIN_USERS_MANAGE, P.ROLES_MANAGE] },
      { href: '/audit', labelKey: 'nav.audit', icon: ShieldCheck, permissions: [P.AUDIT_READ] },
    ],
  },
];

/** Page → permissions map used by the route guard (`RequirePermission`). */
export const ROUTE_PERMISSIONS: Record<string, readonly Permission[]> = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.permissions])));
