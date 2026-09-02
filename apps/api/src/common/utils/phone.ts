import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { AppException } from '../errors/app.exception';

/** Normalises any accepted input to E.164; default region PS (Palestine) for national formats. */
export function normalizePhone(input: string, defaultCountry: 'PS' | 'IL' | 'JO' = 'PS'): string {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw AppException.validation([{ field: 'phone', message: 'invalid phone number' }]);
  }
  return parsed.number;
}
