import { Injectable, type PipeTransform } from '@nestjs/common';

import { AppException } from '../errors/app.exception';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw AppException.validation([{ field: 'id', message: 'must be a valid UUID' }]);
    }
    return value.toLowerCase();
  }
}
