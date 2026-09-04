import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type FareBreakdownLine,
  type JobDto,
  type JobEventDto,
  type JobStopDto,
  type Money,
  type QuoteDto,
  UserRole,
} from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import { decrypt, maskPhone } from '../../common/utils/crypto.util';
import { AppConfigService } from '../../config';
import { MediaUrlService } from '../media/media-url.service';

import { JobPolicy } from './domain/job-policy';
import type { JobWithRelations } from './jobs.types';

type Viewer = RequestUser | { kind: 'share-link' };

/**
 * Prisma → JobDto with viewer-specific redaction (spec §65, §88):
 *  - trip PIN / delivery OTP only to the customer, pickup OTP only to the customer (sender)
 *  - phone numbers masked unless the viewer is staff
 *  - partner live location only while the job is active
 */
@Injectable()
export class JobMapper {
  constructor(
    private readonly config: AppConfigService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  toDto(
    job: JobWithRelations,
    viewer: Viewer,
    events?: Array<{
      id: string;
      type: string;
      fromStatus: JobDto['status'] | null;
      toStatus: JobDto['status'] | null;
      actorType: JobEventDto['actorType'];
      actorId: string | null;
      data: unknown;
      createdAt: Date;
    }>,
  ): JobDto {
    const isShare = 'kind' in viewer;
    const user = isShare ? null : viewer;
    const isCustomer = !!user && JobPolicy.isCustomer(user, job);
    const isPartner = !!user && JobPolicy.isAssignedPartner(user, job);
    const isStaff = !!user && JobPolicy.isStaff(user);
    const currency = job.currency as Money['currency'];
    const money = (v: bigint | null): Money | null =>
      v === null ? null : { amount: Number(v), currency };
    const key = this.config.encryptionKey;
    const phoneFor = (enc: string | null): string | null => {
      if (!enc) return null;
      try {
        const plain = decrypt(enc, key);
        return isStaff ? plain : maskPhone(plain);
      } catch {
        return null;
      }
    };

    const partnerUser = job.partner?.user ?? null;
    const partnerLive = job.partner?.availability;
    const active = ![
      'COMPLETED',
      'CANCELLED',
      'NO_PARTNER_AVAILABLE',
      'DISPUTED',
      'DRAFT',
      'REQUESTED',
      'SEARCHING',
    ].includes(job.status);
    const latestQuote = job.quotes[0];

    return {
      id: job.id,
      number: job.number,
      type: job.type,
      status: job.status,
      version: job.version,
      customerId: job.customerId,
      partnerId: job.partnerId,
      categoryId: job.categoryId,
      subcategoryId: job.subcategoryId,
      vehicleTypeId: job.vehicleTypeId,
      zoneId: job.zoneId,
      scheduling: job.scheduling,
      scheduledFor: job.scheduledFor?.toISOString() ?? null,
      urgency: job.urgency,
      currency: job.currency,
      paymentMethod: job.paymentMethod,
      stops: job.stops.map((s): JobStopDto => ({
        id: s.id,
        sequence: s.sequence,
        kind: s.kind,
        address: {
          lat: s.lat.toNumber(),
          lng: s.lng.toNumber(),
          formatted: s.formatted,
          street: s.street ?? undefined,
          building: s.building ?? undefined,
          floor: s.floor ?? undefined,
          apartment: s.apartment ?? undefined,
          city: s.city ?? undefined,
          notes: s.notes ?? undefined,
          placeId: s.placeId ?? undefined,
        },
        contactName: isShare ? null : s.contactName,
        contactPhone: isShare ? null : phoneFor(s.contactPhoneEnc),
        notes: isShare ? null : s.notes,
        arrivedAt: s.arrivedAt?.toISOString() ?? null,
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
      estimatedTotal: isShare ? null : money(job.estimatedTotalMinor),
      finalTotal: isShare ? null : money(job.finalTotalMinor),
      breakdown: isShare ? [] : ((job.breakdown as unknown as FareBreakdownLine[]) ?? []),
      distanceMeters: job.distanceMeters,
      durationSeconds: job.durationSeconds,
      etaToPickupSeconds: job.etaToPickupSeconds,
      etaToDestinationSeconds: job.etaToDestinationSeconds,
      description: isShare ? null : job.description,
      dynamicFields: isShare ? {} : ((job.dynamicFields as Record<string, unknown>) ?? {}),
      mediaUrls: isShare ? [] : job.media.map((m) => this.mediaUrls.urlFor(m.media, 'medium')),
      tripPinRequired: job.tripPinRequired,
      ...(isCustomer && job.tripPinEnc ? { tripPin: this.safeDecrypt(job.tripPinEnc, key) } : {}),
      pickupOtpRequired: job.pickupOtpRequired,
      deliveryOtpRequired: job.deliveryOtpRequired,
      ...(isCustomer && job.deliveryOtpEnc
        ? { deliveryOtp: this.safeDecrypt(job.deliveryOtpEnc, key) }
        : {}),
      ...(isCustomer && job.pickupOtpEnc
        ? { pickupOtp: this.safeDecrypt(job.pickupOtpEnc, key) }
        : {}),
      delivery:
        job.delivery && !isShare
          ? {
              packageCategoryId: job.delivery.packageCategoryId,
              packageCategoryName: {
                ar: job.delivery.packageCategory.nameAr,
                en: job.delivery.packageCategory.nameEn,
              },
              approximateSize: job.delivery.approximateSize,
              approximateWeightKg: job.delivery.approximateWeightKg?.toNumber() ?? null,
              senderName: job.delivery.senderName,
              senderPhone: phoneFor(job.delivery.senderPhoneEnc) ?? '',
              recipientName: job.delivery.recipientName,
              recipientPhone: phoneFor(job.delivery.recipientPhoneEnc) ?? '',
              deliveryNotes: job.delivery.deliveryNotes,
              proof: job.delivery.podTimestamp
                ? {
                    receiverName: job.delivery.podReceiverName,
                    photoUrl: job.delivery.podPhoto
                      ? this.mediaUrls.urlFor(job.delivery.podPhoto, 'medium')
                      : null,
                    signatureUrl: job.delivery.podSignature
                      ? this.mediaUrls.urlFor(job.delivery.podSignature, 'original')
                      : null,
                    location:
                      job.delivery.podLat && job.delivery.podLng
                        ? {
                            lat: job.delivery.podLat.toNumber(),
                            lng: job.delivery.podLng.toNumber(),
                          }
                        : null,
                    otpVerified: job.delivery.podOtpVerified,
                    timestamp: job.delivery.podTimestamp.toISOString(),
                  }
                : null,
            }
          : undefined,
      partner:
        partnerUser && job.partner
          ? {
              id: job.partner.userId,
              fullName: partnerUser.fullName ?? '',
              profileImageUrl: partnerUser.profileImage
                ? this.mediaUrls.urlFor(partnerUser.profileImage, 'thumbnail')
                : null,
              rating: job.partner.ratingCount
                ? Number((job.partner.ratingSum / job.partner.ratingCount).toFixed(2))
                : 5,
              ratingCount: job.partner.ratingCount,
              maskedPhone: isShare
                ? null
                : isStaff
                  ? partnerUser.phone
                  : maskPhone(partnerUser.phone),
              vehicle: job.vehicle
                ? {
                    brand: job.vehicle.brand,
                    model: job.vehicle.model,
                    color: job.vehicle.color,
                    plate: job.vehicle.plate,
                    typeName: {
                      ar: job.vehicle.vehicleType.nameAr,
                      en: job.vehicle.vehicleType.nameEn,
                    },
                  }
                : null,
              location:
                active && partnerLive?.lat && partnerLive.lng
                  ? { lat: partnerLive.lat.toNumber(), lng: partnerLive.lng.toNumber() }
                  : null,
            }
          : undefined,
      customer: isShare
        ? undefined
        : {
            id: job.customer.userId,
            fullName: job.customer.user.fullName ?? '',
            profileImageUrl: job.customer.user.profileImage
              ? this.mediaUrls.urlFor(job.customer.user.profileImage, 'thumbnail')
              : null,
            rating: job.customer.ratingCount
              ? Number((job.customer.ratingSum / job.customer.ratingCount).toFixed(2))
              : 5,
            maskedPhone:
              isPartner || isStaff
                ? isStaff
                  ? job.customer.user.phone
                  : maskPhone(job.customer.user.phone)
                : null,
          },
      activeQuote: latestQuote && !isShare ? this.quoteToDto(latestQuote, currency) : null,
      promoCode: job.promoCode?.code ?? null,
      cancellationReason: job.cancellationReasonCode,
      cancelledBy: job.cancelledBy,
      cancellationFee: job.cancellationFeeMinor > 0n ? money(job.cancellationFeeMinor) : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      events: events?.map((e) => ({
        id: e.id,
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorType: e.actorType,
        actorId: isStaff ? e.actorId : null,
        data: isStaff ? ((e.data as Record<string, unknown> | null) ?? null) : null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  quoteToDto(
    q: Prisma.ServiceQuoteGetPayload<{ include: { items: true } }>,
    currency: Money['currency'],
  ): QuoteDto {
    const m = (v: bigint): Money => ({ amount: Number(v), currency });
    return {
      id: q.id,
      jobId: q.jobId,
      kind: q.kind,
      revision: q.revision,
      status: q.status,
      laborCost: m(q.laborCostMinor),
      partsCost: m(q.partsCostMinor),
      additionalFees: m(q.additionalFeesMinor),
      discount: m(q.discountMinor),
      tax: m(q.taxMinor),
      total: m(q.totalMinor),
      description: q.description,
      estimatedDurationMin: q.estimatedDurationMin,
      items: q.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        description: i.description,
        quantity: i.quantity.toNumber(),
        unitPrice: m(i.unitPriceMinor),
        total: m(i.totalMinor),
      })),
      submittedAt: q.submittedAt.toISOString(),
      decidedAt: q.decidedAt?.toISOString() ?? null,
      decisionNote: q.decisionNote,
      supersedesQuoteId: q.supersedesQuoteId,
    };
  }

  isStaffViewer(user: RequestUser): boolean {
    return (
      user.isSuperAdmin || user.roles.some((r) => r !== UserRole.CUSTOMER && r !== UserRole.PARTNER)
    );
  }

  private safeDecrypt(value: string, key: Buffer): string | undefined {
    try {
      return decrypt(value, key);
    } catch {
      return undefined;
    }
  }
}
