import {
  JobActorType,
  JobStatus,
  JobType,
  JobUrgency,
  PaymentMethod,
  SchedulingMode,
} from '@tamam/shared-types';
import { z } from 'zod';


import {
  addressSchema,
  geoPointSchema,
  isoDateTimeSchema,
  locationSampleSchema,
  phoneSchema,
  uuidSchema,
} from './common';

const jobTypeSchema = z.nativeEnum(JobType);
const urgencySchema = z.nativeEnum(JobUrgency);
const paymentMethodSchema = z.nativeEnum(PaymentMethod);
const schedulingSchema = z.nativeEnum(SchedulingMode);

/* ----------------------------------------------------------- estimates */
export const rideEstimateSchema = z.object({
  pickup: addressSchema,
  destination: addressSchema,
  scheduledFor: isoDateTimeSchema.optional(),
});

export const deliveryEstimateSchema = z.object({
  pickup: addressSchema,
  destination: addressSchema,
  packageCategoryId: uuidSchema,
  approximateSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XL']),
  approximateWeightKg: z.number().min(0).max(500).optional(),
  urgency: urgencySchema.default('STANDARD'),
  scheduledFor: isoDateTimeSchema.optional(),
});

export const serviceEstimateSchema = z.object({
  location: addressSchema,
  categoryId: uuidSchema,
  subcategoryId: uuidSchema.optional(),
  optionIds: z.array(uuidSchema).max(20).default([]),
  urgency: urgencySchema.default('STANDARD'),
  scheduledFor: isoDateTimeSchema.optional(),
});

/* --------------------------------------------------------- job creation */
const baseCreateJob = z.object({
  estimateId: uuidSchema,
  /** Selected option from the estimate (vehicle type for rides, category for services). */
  vehicleTypeId: uuidSchema.optional(),
  paymentMethod: paymentMethodSchema,
  promoCode: z.string().trim().max(30).optional(),
  scheduling: schedulingSchema.default('NOW'),
  scheduledFor: isoDateTimeSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const createRideJobSchema = baseCreateJob.extend({
  type: z.literal(JobType.RIDE),
  vehicleTypeId: uuidSchema,
  pickup: addressSchema,
  destination: addressSchema,
});

export const createDeliveryJobSchema = baseCreateJob.extend({
  type: z.literal(JobType.DELIVERY),
  pickup: addressSchema,
  destination: addressSchema,
  packageCategoryId: uuidSchema,
  approximateSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XL']),
  approximateWeightKg: z.number().min(0).max(500).optional(),
  sender: z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema }),
  recipient: z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema }),
  description: z.string().trim().max(500).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  mediaIds: z.array(uuidSchema).max(6).default([]),
  urgency: urgencySchema.default('STANDARD'),
});

export const createServiceJobSchema = baseCreateJob.extend({
  type: z.literal(JobType.HOME_SERVICE),
  location: addressSchema,
  categoryId: uuidSchema,
  subcategoryId: uuidSchema.optional(),
  optionIds: z.array(uuidSchema).max(20).default([]),
  description: z.string().trim().min(5).max(2000),
  mediaIds: z.array(uuidSchema).max(10).default([]),
  urgency: urgencySchema.default('STANDARD'),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  preferredTimeSlot: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).optional(),
  additionalInstructions: z.string().trim().max(1000).optional(),
  /** Category-specific dynamic fields; validated server-side against the category definition. */
  dynamicFields: z.record(z.string().max(60), z.unknown()).default({}),
});

export const createJobSchema = z.discriminatedUnion('type', [
  createRideJobSchema,
  createDeliveryJobSchema,
  createServiceJobSchema,
]);

/* --------------------------------------------------------- transitions */
export const cancelJobSchema = z.object({
  reasonCode: z.enum([
    'CHANGED_MIND',
    'WAIT_TOO_LONG',
    'WRONG_ADDRESS',
    'PRICE_TOO_HIGH',
    'PARTNER_NOT_MOVING',
    'CUSTOMER_NO_SHOW',
    'CUSTOMER_UNREACHABLE',
    'VEHICLE_ISSUE',
    'SAFETY_CONCERN',
    'DUPLICATE',
    'OTHER',
  ]),
  reasonText: z.string().trim().max(500).optional(),
  version: z.number().int().min(0),
});

export const startJobSchema = z.object({
  tripPin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  pickupOtp: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional(),
  location: locationSampleSchema.optional(),
  version: z.number().int().min(0),
});

export const arriveJobSchema = z.object({
  location: locationSampleSchema,
  version: z.number().int().min(0),
});

export const completeJobSchema = z.object({
  location: locationSampleSchema.optional(),
  version: z.number().int().min(0),
  /** Delivery proof — required for DELIVERY jobs. */
  proofOfDelivery: z
    .object({
      deliveryOtp: z
        .string()
        .regex(/^\d{4,6}$/)
        .optional(),
      receiverName: z.string().trim().max(80).optional(),
      photoMediaId: uuidSchema.optional(),
      signatureMediaId: uuidSchema.optional(),
    })
    .optional(),
});

export const simpleTransitionSchema = z.object({
  version: z.number().int().min(0),
  note: z.string().trim().max(500).optional(),
});

export const adminTransitionSchema = z.object({
  toStatus: z.nativeEnum(JobStatus),
  reason: z.string().trim().min(5).max(500),
  version: z.number().int().min(0),
});

export const respondToOfferSchema = z.object({
  assignmentId: uuidSchema,
  accept: z.boolean(),
  location: locationSampleSchema.optional(),
});

export const manualAssignSchema = z.object({
  partnerId: uuidSchema,
  reason: z.string().trim().min(5).max(500),
  version: z.number().int().min(0),
});

export const jobListFilterSchema = z.object({
  type: jobTypeSchema.optional(),
  status: z.nativeEnum(JobStatus).optional(),
  statusGroup: z.enum(['active', 'completed', 'cancelled', 'all']).default('all'),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  zoneId: uuidSchema.optional(),
  partnerId: uuidSchema.optional(),
  customerId: uuidSchema.optional(),
  q: z.string().trim().max(60).optional(),
});

export const shareTripSchema = z.object({
  expiresInMinutes: z
    .number()
    .int()
    .min(15)
    .max(24 * 60)
    .default(180),
});

export const sosSchema = z.object({
  location: geoPointSchema,
  note: z.string().trim().max(300).optional(),
});

export const rateJobSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim().max(40)).max(6).default([]),
  comment: z.string().trim().max(500).optional(),
});

export const actorTypeSchema = z.nativeEnum(JobActorType);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateRideJobInput = z.infer<typeof createRideJobSchema>;
export type CreateDeliveryJobInput = z.infer<typeof createDeliveryJobSchema>;
export type CreateServiceJobInput = z.infer<typeof createServiceJobSchema>;
export type RideEstimateInput = z.infer<typeof rideEstimateSchema>;
export type DeliveryEstimateInput = z.infer<typeof deliveryEstimateSchema>;
export type ServiceEstimateInput = z.infer<typeof serviceEstimateSchema>;
export type CancelJobInput = z.infer<typeof cancelJobSchema>;
export type StartJobInput = z.infer<typeof startJobSchema>;
export type ArriveJobInput = z.infer<typeof arriveJobSchema>;
export type CompleteJobInput = z.infer<typeof completeJobSchema>;
export type SimpleTransitionInput = z.infer<typeof simpleTransitionSchema>;
export type AdminTransitionInput = z.infer<typeof adminTransitionSchema>;
export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>;
export type ManualAssignInput = z.infer<typeof manualAssignSchema>;
export type JobListFilterInput = z.infer<typeof jobListFilterSchema>;
export type RateJobInput = z.infer<typeof rateJobSchema>;
