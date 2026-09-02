import { UserRole } from './enums';

/**
 * Fine-grained permissions. Roles are bundles of permissions; the API guards on
 * permissions (never on role names) so admin roles can be re-shaped without code changes.
 */
export const Permission = {
  // customers
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_RESTRICT: 'customers.restrict',
  CUSTOMERS_SUSPEND: 'customers.suspend',
  // partners
  PARTNERS_READ: 'partners.read',
  PARTNERS_REVIEW_DOCUMENTS: 'partners.review_documents',
  PARTNERS_APPROVE: 'partners.approve',
  PARTNERS_SUSPEND: 'partners.suspend',
  PARTNERS_MANAGE: 'partners.manage',
  // services / catalog
  SERVICES_READ: 'services.read',
  SERVICES_MANAGE: 'services.manage',
  // zones
  ZONES_READ: 'zones.read',
  ZONES_MANAGE: 'zones.manage',
  // jobs / dispatch
  JOBS_READ: 'jobs.read',
  JOBS_READ_ALL: 'jobs.read_all',
  JOBS_CANCEL: 'jobs.cancel',
  DISPATCH_MANUAL_ASSIGN: 'dispatch.manual_assign',
  DISPATCH_REASSIGN: 'dispatch.reassign',
  TRACKING_VIEW_LIVE_MAP: 'tracking.view_live_map',
  // pricing / config
  PRICING_READ: 'pricing.read',
  PRICING_MANAGE: 'pricing.manage',
  CONFIG_READ: 'config.read',
  CONFIG_MANAGE: 'config.manage',
  FEATURE_FLAGS_MANAGE: 'feature_flags.manage',
  // finance
  PAYMENTS_READ: 'payments.read',
  REFUNDS_ISSUE: 'refunds.issue',
  WALLET_ADJUST: 'wallet.adjust',
  WITHDRAWALS_MANAGE: 'withdrawals.manage',
  COMMISSION_MANAGE: 'commission.manage',
  LEDGER_READ: 'ledger.read',
  // promotions / marketing
  PROMOS_MANAGE: 'promos.manage',
  REFERRALS_MANAGE: 'referrals.manage',
  CAMPAIGNS_READ: 'campaigns.read',
  CAMPAIGNS_MANAGE: 'campaigns.manage',
  CAMPAIGNS_PUBLISH: 'campaigns.publish',
  // support
  SUPPORT_READ: 'support.read',
  SUPPORT_MANAGE: 'support.manage',
  DISPUTES_READ: 'disputes.read',
  DISPUTES_DECIDE: 'disputes.decide',
  // analytics & audit
  ANALYTICS_READ: 'analytics.read',
  REPORTS_EXPORT: 'reports.export',
  AUDIT_READ: 'audit.read',
  // admin users
  ADMIN_USERS_MANAGE: 'admin_users.manage',
  ROLES_MANAGE: 'roles.manage',
  // risk
  RISK_READ: 'risk.read',
  RISK_MANAGE: 'risk.manage',
  // notifications
  NOTIFICATIONS_BROADCAST: 'notifications.broadcast',
  NOTIFICATION_TEMPLATES_MANAGE: 'notification_templates.manage',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

const P = Permission;

/**
 * Default role → permission bundles seeded into `admin_roles` / `admin_permissions`.
 * SUPER_ADMIN implicitly holds every permission (enforced in the guard, not by data).
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.CUSTOMER]: [],
  [UserRole.PARTNER]: [],
  [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS,
  [UserRole.ADMIN]: [
    P.CUSTOMERS_READ, P.CUSTOMERS_RESTRICT, P.CUSTOMERS_SUSPEND,
    P.PARTNERS_READ, P.PARTNERS_REVIEW_DOCUMENTS, P.PARTNERS_APPROVE, P.PARTNERS_SUSPEND, P.PARTNERS_MANAGE,
    P.SERVICES_READ, P.SERVICES_MANAGE, P.ZONES_READ, P.ZONES_MANAGE,
    P.JOBS_READ, P.JOBS_READ_ALL, P.JOBS_CANCEL, P.DISPATCH_MANUAL_ASSIGN, P.DISPATCH_REASSIGN, P.TRACKING_VIEW_LIVE_MAP,
    P.PRICING_READ, P.PRICING_MANAGE, P.CONFIG_READ, P.CONFIG_MANAGE, P.FEATURE_FLAGS_MANAGE,
    P.PAYMENTS_READ, P.LEDGER_READ,
    P.PROMOS_MANAGE, P.REFERRALS_MANAGE, P.CAMPAIGNS_READ, P.CAMPAIGNS_MANAGE, P.CAMPAIGNS_PUBLISH,
    P.SUPPORT_READ, P.SUPPORT_MANAGE, P.DISPUTES_READ, P.DISPUTES_DECIDE,
    P.ANALYTICS_READ, P.REPORTS_EXPORT, P.AUDIT_READ, P.RISK_READ, P.RISK_MANAGE,
    P.NOTIFICATIONS_BROADCAST, P.NOTIFICATION_TEMPLATES_MANAGE,
  ],
  [UserRole.OPERATIONS_MANAGER]: [
    P.CUSTOMERS_READ, P.PARTNERS_READ, P.PARTNERS_REVIEW_DOCUMENTS, P.PARTNERS_APPROVE, P.PARTNERS_SUSPEND, P.PARTNERS_MANAGE,
    P.SERVICES_READ, P.ZONES_READ, P.ZONES_MANAGE,
    P.JOBS_READ, P.JOBS_READ_ALL, P.JOBS_CANCEL, P.DISPATCH_MANUAL_ASSIGN, P.DISPATCH_REASSIGN, P.TRACKING_VIEW_LIVE_MAP,
    P.PRICING_READ, P.CONFIG_READ, P.SUPPORT_READ, P.DISPUTES_READ, P.ANALYTICS_READ, P.AUDIT_READ, P.RISK_READ,
  ],
  [UserRole.DISPATCHER]: [
    P.PARTNERS_READ, P.JOBS_READ, P.JOBS_READ_ALL, P.JOBS_CANCEL,
    P.DISPATCH_MANUAL_ASSIGN, P.DISPATCH_REASSIGN, P.TRACKING_VIEW_LIVE_MAP, P.ZONES_READ, P.SERVICES_READ,
  ],
  [UserRole.SUPPORT]: [
    P.CUSTOMERS_READ, P.PARTNERS_READ, P.JOBS_READ, P.JOBS_READ_ALL, P.PAYMENTS_READ,
    P.SUPPORT_READ, P.SUPPORT_MANAGE, P.DISPUTES_READ, P.SERVICES_READ, P.ZONES_READ,
  ],
  [UserRole.FINANCE]: [
    P.PAYMENTS_READ, P.REFUNDS_ISSUE, P.WALLET_ADJUST, P.WITHDRAWALS_MANAGE, P.COMMISSION_MANAGE, P.LEDGER_READ,
    P.JOBS_READ, P.JOBS_READ_ALL, P.CUSTOMERS_READ, P.PARTNERS_READ, P.DISPUTES_READ, P.DISPUTES_DECIDE,
    P.ANALYTICS_READ, P.REPORTS_EXPORT, P.PRICING_READ,
  ],
  [UserRole.MARKETING]: [
    P.PROMOS_MANAGE, P.REFERRALS_MANAGE, P.CAMPAIGNS_READ, P.CAMPAIGNS_MANAGE, P.CAMPAIGNS_PUBLISH,
    P.NOTIFICATIONS_BROADCAST, P.NOTIFICATION_TEMPLATES_MANAGE, P.ANALYTICS_READ, P.SERVICES_READ, P.ZONES_READ,
  ],
  [UserRole.ANALYST]: [
    P.ANALYTICS_READ, P.REPORTS_EXPORT, P.JOBS_READ, P.JOBS_READ_ALL, P.PAYMENTS_READ, P.LEDGER_READ,
    P.CUSTOMERS_READ, P.PARTNERS_READ, P.SERVICES_READ, P.ZONES_READ, P.CAMPAIGNS_READ,
  ],
};

export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.DISPATCHER,
  UserRole.SUPPORT,
  UserRole.FINANCE,
  UserRole.MARKETING,
  UserRole.ANALYST,
];

/** Sensitive admin actions that must additionally produce an audit entry with reason. */
export const SENSITIVE_PERMISSIONS: readonly Permission[] = [
  P.REFUNDS_ISSUE,
  P.WALLET_ADJUST,
  P.PARTNERS_SUSPEND,
  P.CUSTOMERS_SUSPEND,
  P.PRICING_MANAGE,
  P.COMMISSION_MANAGE,
  P.CONFIG_MANAGE,
  P.ROLES_MANAGE,
  P.ADMIN_USERS_MANAGE,
];
