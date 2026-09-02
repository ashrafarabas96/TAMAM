import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type ApiError, ErrorCode } from '@tamam/shared-types';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { ZodError } from 'zod';

import { AppException } from './app.exception';

/**
 * Converts every error into the unified envelope. Unknown errors are logged with the
 * request id and returned as INTERNAL_ERROR without any internal detail (spec §101).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req as Request & { id?: string }).id ?? (req.headers['x-request-id'] as string | undefined) ?? 'unknown';

    const { status, body } = this.normalise(exception, requestId);

    if (status >= 500) {
      this.logger.error({ err: exception, requestId, path: req.originalUrl, method: req.method }, 'Unhandled exception');
    } else if (status === 429 || status === 409) {
      this.logger.warn({ requestId, path: req.originalUrl, code: body.code }, body.message);
    }

    if (body.code === ErrorCode.RATE_LIMITED && body.details && typeof body.details === 'object' && !Array.isArray(body.details)) {
      const retry = (body.details as Record<string, unknown>).retryAfterSeconds;
      if (typeof retry === 'number') res.setHeader('Retry-After', String(retry));
    }

    res.status(status).json(body);
  }

  private normalise(exception: unknown, requestId: string): { status: number; body: ApiError } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: { code: exception.code, message: exception.message, details: exception.details, requestId },
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Validation failed',
          details: exception.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          requestId,
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { status: HttpStatus.CONFLICT, body: { code: ErrorCode.CONFLICT, message: 'A record with the same unique value already exists', requestId } };
      }
      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, body: { code: ErrorCode.NOT_FOUND, message: 'Record not found', requestId } };
      }
      if (exception.code === 'P2003') {
        return { status: HttpStatus.BAD_REQUEST, body: { code: ErrorCode.VALIDATION_FAILED, message: 'Referenced record does not exist', requestId } };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response : ((response as { message?: string | string[] }).message ?? exception.message);
      const code =
        status === 401 ? ErrorCode.UNAUTHENTICATED
        : status === 403 ? ErrorCode.FORBIDDEN
        : status === 404 ? ErrorCode.NOT_FOUND
        : status === 429 ? ErrorCode.RATE_LIMITED
        : status === 413 ? ErrorCode.UPLOAD_TOO_LARGE
        : status >= 500 ? ErrorCode.INTERNAL_ERROR
        : ErrorCode.VALIDATION_FAILED;
      return { status, body: { code, message: Array.isArray(message) ? message.join('; ') : String(message), requestId } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ErrorCode.INTERNAL_ERROR, message: 'Something went wrong. Please try again.', requestId },
    };
  }
}
