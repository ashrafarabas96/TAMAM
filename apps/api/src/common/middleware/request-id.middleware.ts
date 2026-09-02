import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import { Headers } from '@tamam/shared-types';
import type { NextFunction, Request, Response } from 'express';

/** Assigns/propagates X-Request-Id for every request (spec §186). */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(Headers.REQUEST_ID);
    const id = incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    (req as Request & { id: string }).id = id;
    res.setHeader(Headers.REQUEST_ID, id);
    next();
  }
}
