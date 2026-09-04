import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Headers } from '@tamam/shared-types';
import type { Request } from 'express';

import type { RequestUser } from '../types/request-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
    return req.user;
  },
);

export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { id?: string }>();
  return req.id ?? 'unknown';
});

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.ip ?? null;
  },
);

export const UserAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ua = req.header('user-agent');
    return ua ? ua.slice(0, 300) : null;
  },
);

export const AcceptLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): 'ar' | 'en' => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = (req.header('accept-language') ?? 'ar').toLowerCase();
    return raw.startsWith('en') ? 'en' : 'ar';
  },
);

/** X-Device-Id header (optional; used for abuse correlation and session binding). */
export const DeviceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const v = req.header(Headers.DEVICE_ID);
    return v && v.length <= 128 ? v : null;
  },
);
