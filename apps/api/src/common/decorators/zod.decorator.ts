import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';

import { AppException } from '../errors/app.exception';

function parseOrThrow<T>(schema: ZodSchema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppException.validation(result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  return result.data;
}

/** `@ZodBody(schema) body: Input` — validates and strips unknown keys. */
export const ZodBody = createParamDecorator((schema: ZodSchema, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return parseOrThrow(schema, req.body);
});

/** `@ZodQuery(schema) query: Input` — coerces from query string. */
export const ZodQuery = createParamDecorator((schema: ZodSchema, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return parseOrThrow(schema, req.query);
});

/** `@ZodParams(schema) params: Input` */
export const ZodParams = createParamDecorator((schema: ZodSchema, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return parseOrThrow(schema, req.params);
});

export { parseOrThrow };
