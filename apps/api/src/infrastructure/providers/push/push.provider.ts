export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  /** high for job offers / arrivals, normal otherwise */
  priority: 'high' | 'normal';
  collapseKey?: string;
  ttlSeconds?: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens the provider reported as invalid — caller deactivates them. */
  invalidTokens: string[];
}

export interface PushProvider {
  readonly name: string;
  send(message: PushMessage): Promise<PushResult>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
