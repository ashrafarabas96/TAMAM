'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Permission, UserDto } from '@tamam/shared-types';

import { authApi } from '@/lib/api/endpoints/auth';
import { fetchSessionToken, setAccessToken } from '@/lib/auth/token-store';
import { queryKeys } from '@/lib/query-keys';

import { createPermissionChecker, NO_PERMISSIONS, type PermissionChecker, permissionsForRoles } from './permissions';

export interface SessionState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: UserDto | null;
  permissions: PermissionChecker;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * Bootstraps the browser session: asks `/api/session/token` for an access token (the httpOnly
 * cookie is exchanged server-side), then loads `GET /me` and derives the permission set.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tokenState, setTokenState] = useState<'pending' | 'ready' | 'missing'>('pending');

  useEffect(() => {
    let active = true;
    void fetchSessionToken(false).then((token) => {
      if (!active) return;
      if (token) {
        setAccessToken(token.accessToken, token.expiresAt);
        setTokenState('ready');
      } else {
        setTokenState('missing');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const meQuery = useQuery({
    queryKey: queryKeys.session.me,
    queryFn: authApi.me,
    enabled: tokenState === 'ready',
    staleTime: 5 * 60_000,
    retry: false,
  });

  const logout = useCallback(async () => {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
    setAccessToken(null);
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  const refreshUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.session.me });
  }, [queryClient]);

  const value = useMemo<SessionState>(() => {
    const user = meQuery.data ?? null;
    const permissions = user ? createPermissionChecker(permissionsForRoles(user.roles, meQuery.data?.permissions)) : NO_PERMISSIONS;
    const status: SessionState['status'] = tokenState === 'missing' || meQuery.isError ? 'unauthenticated' : user ? 'authenticated' : 'loading';
    return { status, user, permissions, can: permissions.can, canAny: permissions.canAny, logout, refreshUser };
  }, [meQuery.data, meQuery.isError, tokenState, logout, refreshUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** `const can = usePermissions(); can(Permission.JOBS_READ_ALL)` */
export function usePermissions(): PermissionChecker {
  return useSession().permissions;
}
