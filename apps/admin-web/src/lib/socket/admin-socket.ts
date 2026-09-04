'use client';

import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

import { type OpsDashboardDto, WsEvent, WsNamespace } from '@tamam/shared-types';

import type { AdminMapUpdate } from '@/lib/api/types';
import { getAccessToken, refreshAccessToken } from '@/lib/auth/token-store';
import { env } from '@/lib/env';

export interface AdminSocketHandlers {
  onMapUpdate?: (update: AdminMapUpdate) => void;
  onMetrics?: (dashboard: OpsDashboardDto) => void;
  onError?: (error: { code: string }) => void;
}

export type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Connects to the `/admin` Socket.IO namespace with the current access token and subscribes to
 * the live map room (`admin:map:subscribe { zoneId? }`). Re-subscribes on reconnect and when the
 * zone filter changes; refreshes the token when the handshake is rejected as UNAUTHENTICATED.
 */
export function useAdminSocket(
  handlers: AdminSocketHandlers,
  options: { zoneId?: string | null; enabled?: boolean } = {},
) {
  const { zoneId = null, enabled = true } = options;
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async (): Promise<void> => {
      const token = await getAccessToken();
      if (cancelled || !token) {
        setStatus('error');
        return;
      }
      socket = io(`${env.wsBaseUrl}${WsNamespace.ADMIN}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10_000,
      });
      socketRef.current = socket;
      socket.on('connect', () => {
        setStatus('connected');
        socket?.emit(WsEvent.ADMIN_SUBSCRIBE_MAP, zoneId ? { zoneId } : {});
      });
      socket.on('disconnect', () => setStatus('disconnected'));
      socket.on('connect_error', () => setStatus('error'));
      socket.on(WsEvent.ADMIN_MAP_UPDATE, (update: AdminMapUpdate) =>
        handlersRef.current.onMapUpdate?.(update),
      );
      socket.on(WsEvent.ADMIN_METRICS, (dashboard: OpsDashboardDto) =>
        handlersRef.current.onMetrics?.(dashboard),
      );
      socket.on(WsEvent.ERROR, async (error: { code: string }) => {
        handlersRef.current.onError?.(error);
        if (error.code === 'UNAUTHENTICATED') {
          const fresh = await refreshAccessToken();
          if (fresh && socket) {
            socket.auth = { token: fresh };
            socket.connect();
          }
        }
      });
    };
    void connect();

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, zoneId]);

  return { status };
}
