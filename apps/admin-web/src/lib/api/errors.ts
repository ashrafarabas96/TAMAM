import type { ApiError as ApiErrorShape, ErrorCode } from '@tamam/shared-types';

export type ApiErrorDetails = ApiErrorShape['details'];

/** Typed error thrown by the API client. `code` is stable and translatable; `message` is developer-facing. */
export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly details: ApiErrorDetails | undefined;
  readonly requestId: string;
  readonly status: number;

  constructor(status: number, body: Partial<ApiErrorShape> | null, fallbackRequestId: string) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? (status === 0 ? 'NETWORK_ERROR' : 'INTERNAL_ERROR');
    this.details = body?.details;
    this.requestId = body?.requestId ?? fallbackRequestId;
  }

  /** Field-level validation issues, when the API returned them. */
  get fieldErrors(): Array<{ field: string; message: string }> {
    return Array.isArray(this.details) ? this.details : [];
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
