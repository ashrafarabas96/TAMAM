import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ZodTypeAny, output } from 'zod';

import { AppException } from '../errors/app.exception';

/**
 * Returns the schema's *output* type. `ZodSchema<T>` fixes input and output to the same
 * `T`, which is wrong for any schema carrying `.default()` or `.transform()` — there the
 * parsed value has required fields the raw input does not.
 */
function parseOrThrow<S extends ZodTypeAny>(schema: S, value: unknown): output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppException.validation(result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  return result.data;
}

/**
 * The schema travels inside a wrapper, and this is not decoration.
 *
 * `createParamDecorator(factory)(data, ...pipes)` decides whether its first argument is
 * parameter data or a pipe by asking whether it has a `transform` function — and every zod
 * schema does. Passing a schema directly therefore stores it as a *pipe* and hands the
 * factory `data === undefined`, so every `@ZodBody(...)` route fails at runtime with
 * "Cannot read properties of undefined (reading 'safeParse')". A plain object has no
 * `transform`, so it survives as data. Call sites are unchanged: `@ZodBody(schema)`.
 */
interface SchemaCarrier<S extends ZodTypeAny> {
  schema: S;
}

const readFrom = <S extends ZodTypeAny>(source: (req: Request) => unknown) =>
  createParamDecorator((carrier: SchemaCarrier<S>, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return parseOrThrow(carrier.schema, source(req));
  });

const zodBodyDecorator = readFrom((req) => req.body);
const zodQueryDecorator = readFrom((req) => req.query);
const zodParamsDecorator = readFrom((req) => req.params);

/** `@ZodBody(schema) body: Input` — validates and strips unknown keys. */
export const ZodBody = <S extends ZodTypeAny>(schema: S): ParameterDecorator => zodBodyDecorator({ schema });

/** `@ZodQuery(schema) query: Input` — coerces from query string. */
export const ZodQuery = <S extends ZodTypeAny>(schema: S): ParameterDecorator => zodQueryDecorator({ schema });

/** `@ZodParams(schema) params: Input` */
export const ZodParams = <S extends ZodTypeAny>(schema: S): ParameterDecorator => zodParamsDecorator({ schema });

export { parseOrThrow };
