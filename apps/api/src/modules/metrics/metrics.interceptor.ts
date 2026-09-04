import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const end = this.metrics.httpDuration.startTimer({ method: req.method, route });
    return next.handle().pipe(
      tap({
        next: () => end({ status: String(res.statusCode) }),
        error: (err: { getStatus?: () => number }) => {
          const status = typeof err.getStatus === 'function' ? err.getStatus() : 500;
          end({ status: String(status) });
          this.metrics.httpErrors.inc({ route, code: String(status) });
        },
      }),
    );
  }
}
