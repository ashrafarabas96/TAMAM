import type { en } from './en';

export type Locale = 'ar' | 'en';
export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
export type TranslateParams = Record<string, string | number>;
export type TFunction = (key: TranslationKey, params?: TranslateParams) => string;

/** Enum groups that carry a `enum.<group>.<VALUE>` label in both dictionaries. */
export type EnumGroup =
  | 'jobStatus'
  | 'jobType'
  | 'accountStatus'
  | 'verificationStatus'
  | 'availability'
  | 'documentStatus'
  | 'documentType'
  | 'paymentStatus'
  | 'paymentMethod'
  | 'refundStatus'
  | 'withdrawalStatus'
  | 'campaignStatus'
  | 'bannerPlacement'
  | 'bannerActionType'
  | 'bannerTheme'
  | 'bannerAudience'
  | 'ticketStatus'
  | 'ticketPriority'
  | 'ticketCategory'
  | 'disputeStatus'
  | 'riskSignal'
  | 'restrictionKind'
  | 'restrictionTargetType'
  | 'assignmentStatus'
  | 'partnerRole'
  | 'userRole'
  | 'dispatchProblem'
  | 'ledgerTransactionType'
  | 'ledgerAccountType'
  | 'pricingMethod'
  | 'promoType'
  | 'commissionScope'
  | 'notificationChannel'
  | 'notificationEvent'
  | 'urgency'
  | 'configGroup'
  | 'reportGroupBy'
  | 'accountAction'
  | 'partnerDecision'
  | 'campaignAction'
  | 'withdrawalDecision'
  | 'disputeDecision'
  | 'ledgerDirection';
