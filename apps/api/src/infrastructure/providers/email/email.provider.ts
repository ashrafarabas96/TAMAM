export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ accepted: boolean; providerRef: string | null }>;
}
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
