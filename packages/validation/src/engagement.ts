import { z } from 'zod';

import {
  BANNER_THEMES,
  BannerActionType,
  BannerAudience,
  BannerPlacement,
  DisputeStatus,
  JobType,
  MessageType,
  NotificationChannel,
  NotificationEvent,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@tamam/shared-types';

import {
  geoPointSchema,
  isoDateTimeSchema,
  languageSchema,
  localizedTextSchema,
  pageRequestSchema,
  uuidSchema,
} from './common';

/* ------------------------------------------------------------- banners */
const optionalLocalized = z
  .object({ ar: z.string().trim().max(120), en: z.string().trim().max(120) })
  .nullable()
  .optional();

export const bannerCreativeSchema = z.object({
  headline: optionalLocalized,
  subheadline: optionalLocalized,
  ctaLabel: optionalLocalized,
  /** Media IDs per language (uploaded via /media with purpose BANNER_CREATIVE). */
  imageMediaId: z.object({ ar: uuidSchema, en: uuidSchema }),
  theme: z.enum(BANNER_THEMES).default('purple'),
  badge: optionalLocalized,
});

export const bannerSchema = z
  .object({
    id: uuidSchema.optional(),
    placement: z.nativeEnum(BannerPlacement),
    creative: bannerCreativeSchema,
    actionType: z.nativeEnum(BannerActionType).default('NONE'),
    actionValue: z.string().trim().max(500).nullable().optional(),
    priority: z.number().int().min(0).max(1000).default(0),
    sortOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((b, ctx) => {
    if (b.actionType !== 'NONE' && !b.actionValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actionValue is required for this actionType',
        path: ['actionValue'],
      });
    }
    if (b.actionType === 'EXTERNAL_URL' && b.actionValue && !/^https:\/\//.test(b.actionValue)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'External URLs must use https://',
        path: ['actionValue'],
      });
    }
    if (
      b.actionType === 'DEEP_LINK' &&
      b.actionValue &&
      !/^tamam:\/\/[a-z0-9/_\-?=&.%]+$/i.test(b.actionValue)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Deep links must use the tamam:// scheme',
        path: ['actionValue'],
      });
    }
    if (
      b.actionType === 'SERVICE_CATEGORY' &&
      b.actionValue &&
      !z.string().uuid().safeParse(b.actionValue).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'actionValue must be a category id',
        path: ['actionValue'],
      });
    }
  });

export const campaignTargetingSchema = z.object({
  audiences: z.array(z.nativeEnum(BannerAudience)).min(1).default(['CUSTOMER']),
  zoneIds: z.array(uuidSchema).default([]),
  languages: z.array(languageSchema).default([]),
  platforms: z.array(z.enum(['ios', 'android'])).default([]),
  newCustomersOnly: z.boolean().default(false),
  minCompletedJobs: z.number().int().min(0).nullable().optional(),
  maxCompletedJobs: z.number().int().min(0).nullable().optional(),
  serviceTypeInterest: z.array(z.nativeEnum(JobType)).default([]),
  rolloutPercent: z.number().int().min(1).max(100).default(100),
});

export const upsertCampaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(500).optional(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema.nullable().optional(),
    targeting: campaignTargetingSchema.default({}),
    frequencyCapPerDay: z.number().int().min(1).max(50).nullable().optional(),
    banners: z.array(bannerSchema).min(1).max(12),
  })
  .refine((c) => !c.endsAt || new Date(c.endsAt) > new Date(c.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export const campaignStatusActionSchema = z.object({
  action: z.enum(['PUBLISH', 'PAUSE', 'RESUME', 'END', 'ARCHIVE']),
  reason: z.string().trim().max(300).optional(),
});

export const bannerFeedQuerySchema = z.object({
  placement: z.nativeEnum(BannerPlacement),
  zoneId: uuidSchema.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

export const bannerEventBatchSchema = z.object({
  events: z
    .array(
      z.object({
        trackingToken: z.string().min(10).max(300),
        type: z.enum(['IMPRESSION', 'CLICK', 'DISMISS']),
        occurredAt: isoDateTimeSchema,
        placement: z.nativeEnum(BannerPlacement),
        sessionId: z.string().min(8).max(128),
      }),
    )
    .min(1)
    .max(200),
});

export const campaignStatsQuerySchema = z.object({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

/* -------------------------------------------------------- notifications */
export const upsertNotificationTemplateSchema = z.object({
  event: z.nativeEnum(NotificationEvent),
  channel: z.nativeEnum(NotificationChannel),
  title: localizedTextSchema,
  body: localizedTextSchema,
  isActive: z.boolean().default(true),
});

export const broadcastNotificationSchema = z.object({
  audiences: z.array(z.nativeEnum(BannerAudience)).min(1),
  zoneIds: z.array(uuidSchema).default([]),
  channels: z.array(z.nativeEnum(NotificationChannel)).min(1).default(['PUSH', 'IN_APP']),
  title: localizedTextSchema,
  body: localizedTextSchema,
  deepLink: z.string().trim().max(300).optional(),
  scheduledFor: isoDateTimeSchema.optional(),
  reason: z.string().trim().min(3).max(300),
});

export const notificationListSchema = pageRequestSchema.extend({
  unreadOnly: z.coerce.boolean().default(false),
});

export const notificationPreferencesSchema = z.object({
  push: z.boolean().default(true),
  sms: z.boolean().default(true),
  email: z.boolean().default(false),
  marketing: z.boolean().default(true),
});

/* ----------------------------------------------------------------- chat */
export const sendMessageSchema = z
  .object({
    type: z.nativeEnum(MessageType).default('TEXT'),
    text: z.string().trim().min(1).max(2000).optional(),
    mediaId: uuidSchema.optional(),
    location: geoPointSchema.optional(),
    clientMessageId: z.string().min(8).max(64),
  })
  .superRefine((m, ctx) => {
    if (m.type === 'TEXT' && !m.text)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'text required', path: ['text'] });
    if (m.type === 'IMAGE' && !m.mediaId)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mediaId required', path: ['mediaId'] });
    if (m.type === 'LOCATION' && !m.location)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'location required',
        path: ['location'],
      });
  });

export const markReadSchema = z.object({ upToMessageId: uuidSchema });

/* -------------------------------------------------------------- support */
export const createTicketSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  subject: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  jobId: uuidSchema.optional(),
  attachmentMediaIds: z.array(uuidSchema).max(6).default([]),
});

export const ticketMessageSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  attachmentMediaIds: z.array(uuidSchema).max(6).default([]),
  /** Admin-only: internal notes not visible to the user. */
  internal: z.boolean().default(false),
});

export const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedAgentId: uuidSchema.nullable().optional(),
  category: z.nativeEnum(TicketCategory).optional(),
});

export const reportSchema = z.object({
  jobId: uuidSchema,
  reason: z.enum([
    'UNSAFE_DRIVING',
    'RUDE_BEHAVIOUR',
    'WRONG_ROUTE',
    'OVERCHARGE',
    'DAMAGE',
    'HARASSMENT',
    'NO_SHOW',
    'FRAUD',
    'OTHER',
  ]),
  description: z.string().trim().max(2000).optional(),
  attachmentMediaIds: z.array(uuidSchema).max(6).default([]),
});

/* ------------------------------------------------------------- disputes */
export const openDisputeSchema = z.object({
  jobId: uuidSchema,
  reason: z.enum([
    'NOT_COMPLETED',
    'POOR_QUALITY',
    'OVERCHARGED',
    'DAMAGE',
    'ITEM_MISSING',
    'PARTNER_MISCONDUCT',
    'CUSTOMER_MISCONDUCT',
    'OTHER',
  ]),
  description: z.string().trim().min(10).max(3000),
  requestedRefundMinor: z.number().int().min(0).optional(),
  evidenceMediaIds: z.array(uuidSchema).max(10).default([]),
});

export const disputeMessageSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  evidenceMediaIds: z.array(uuidSchema).max(6).default([]),
  internal: z.boolean().default(false),
});

export const decideDisputeSchema = z.object({
  decision: z.enum(['RESOLVED_CUSTOMER', 'RESOLVED_PARTNER', 'RESOLVED_SPLIT', 'REJECTED']),
  refundMinor: z.number().int().min(0).default(0),
  partnerAdjustmentMinor: z.number().int().default(0),
  reason: z.string().trim().min(10).max(2000),
});

export const disputeStatusSchema = z.nativeEnum(DisputeStatus);

export type BannerInput = z.infer<typeof bannerSchema>;
export type BannerCreativeInput = z.infer<typeof bannerCreativeSchema>;
export type CampaignTargetingInput = z.infer<typeof campaignTargetingSchema>;
export type UpsertCampaignInput = z.infer<typeof upsertCampaignSchema>;
export type CampaignStatusActionInput = z.infer<typeof campaignStatusActionSchema>;
export type BannerFeedQueryInput = z.infer<typeof bannerFeedQuerySchema>;
export type BannerEventBatchInput = z.infer<typeof bannerEventBatchSchema>;
export type UpsertNotificationTemplateInput = z.infer<typeof upsertNotificationTemplateSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;
export type DisputeMessageInput = z.infer<typeof disputeMessageSchema>;
export type DecideDisputeInput = z.infer<typeof decideDisputeSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
