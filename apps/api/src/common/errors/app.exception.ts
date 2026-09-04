import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@tamam/shared-types';

export type AppErrorDetails = Record<string, unknown> | Array<{ field: string; message: string }>;

/**
 * The one exception type business code throws. Maps to the unified error envelope
 * `{ code, message, details, requestId }` (spec §101). Stack traces never leave the server.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode | string;
  readonly details?: AppErrorDetails;

  constructor(
    code: ErrorCode | string,
    message: string,
    status: HttpStatus,
    details?: AppErrorDetails,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }

  /* ------------------------------------------------------------ factories */
  static validation(details: AppErrorDetails, message = 'Validation failed'): AppException {
    return new AppException(
      ErrorCode.VALIDATION_FAILED,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
  static unauthenticated(
    message = 'Authentication required',
    code: ErrorCode = ErrorCode.UNAUTHENTICATED,
  ): AppException {
    return new AppException(code, message, HttpStatus.UNAUTHORIZED);
  }
  static forbidden(
    message = 'You are not allowed to perform this action',
    code: ErrorCode = ErrorCode.FORBIDDEN,
  ): AppException {
    return new AppException(code, message, HttpStatus.FORBIDDEN);
  }
  static notFound(entity: string, id?: string): AppException {
    return new AppException(
      ErrorCode.NOT_FOUND,
      id ? `${entity} ${id} was not found` : `${entity} was not found`,
      HttpStatus.NOT_FOUND,
    );
  }
  static conflict(
    message: string,
    code: ErrorCode | string = ErrorCode.CONFLICT,
    details?: AppErrorDetails,
  ): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }
  static badRequest(
    code: ErrorCode | string,
    message: string,
    details?: AppErrorDetails,
  ): AppException {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }
  static rateLimited(retryAfterSeconds: number): AppException {
    return new AppException(
      ErrorCode.RATE_LIMITED,
      'Too many requests, slow down',
      HttpStatus.TOO_MANY_REQUESTS,
      { retryAfterSeconds },
    );
  }
  static invalidTransition(from: string, to: string): AppException {
    return new AppException(
      ErrorCode.INVALID_STATE_TRANSITION,
      `Cannot move job from ${from} to ${to}`,
      HttpStatus.CONFLICT,
      { from, to },
    );
  }
  static versionConflict(): AppException {
    return new AppException(
      ErrorCode.VERSION_CONFLICT,
      'The record was modified by someone else — reload and retry',
      HttpStatus.CONFLICT,
    );
  }
  static featureDisabled(flag: string): AppException {
    return new AppException(
      ErrorCode.FEATURE_DISABLED,
      `Feature ${flag} is not enabled`,
      HttpStatus.FORBIDDEN,
      { flag },
    );
  }
  static external(provider: string, message = 'Upstream provider failed'): AppException {
    return new AppException(ErrorCode.EXTERNAL_SERVICE_ERROR, message, HttpStatus.BAD_GATEWAY, {
      provider,
    });
  }
  static internal(message = 'Unexpected error'): AppException {
    return new AppException(ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
