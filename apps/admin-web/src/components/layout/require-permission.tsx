'use client';

import { type ReactNode } from 'react';

import type { Permission } from '@tamam/shared-types';

import { ForbiddenState } from '@/components/ui/states';
import { useSession } from '@/lib/auth/session-context';

/** Renders children only when the staff user holds ANY of the permissions; otherwise a 403 state. */
export function RequirePermission({ anyOf, children, fallback }: { anyOf: readonly Permission[]; children: ReactNode; fallback?: ReactNode }) {
  const { status, permissions } = useSession();
  if (status === 'loading') return null;
  if (!permissions.canAny(...anyOf)) return <>{fallback ?? <ForbiddenState />}</>;
  return <>{children}</>;
}

/** Inline gate for buttons / sections. */
export function Can({ anyOf, children }: { anyOf: readonly Permission[]; children: ReactNode }) {
  const { permissions } = useSession();
  if (!permissions.canAny(...anyOf)) return null;
  return <>{children}</>;
}
