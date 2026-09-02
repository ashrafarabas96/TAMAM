export interface SmsMessage {
  to: string; // E.164
  body: string;
  /** Used for logging/metrics only — never the OTP itself. */
  category: 'OTP' | 'TRANSACTIONAL' | 'MARKETING';
}

export interface SmsResult {
  providerRef: string | null;
  accepted: boolean;
}

/** SMS abstraction (spec §182). */
export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
