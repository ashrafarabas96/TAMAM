import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AvailabilityStatus,
  CONFIG_KEYS,
  type ConfigKey,
  DocumentStatus,
  DocumentType,
  ErrorCode,
  PartnerRoleType,
  VerificationStatus,
} from '@tamam/shared-types';

import type { AppConfigService } from '../../config';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { SystemConfigService } from '../config/system-config.service';
import type { MediaUrlService } from '../media/media-url.service';
import type { MediaService } from '../media/media.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { VehiclesService } from '../vehicles/vehicles.service';

import { PartnerAvailabilityService } from './partner-availability.service';
import { PARTNER_ONBOARDING_STEPS, PartnersService } from './partners.service';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const ZONE_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';

const CONFIG_DEFAULTS: Record<string, number> = {
  [CONFIG_KEYS.TRACKING_MAX_STALE_S]: 60,
  [CONFIG_KEYS.TRACKING_MAX_ACCURACY_M]: 150,
  [CONFIG_KEYS.HEARTBEAT_INTERVAL_S]: 30,
  [CONFIG_KEYS.HEARTBEAT_OFFLINE_AFTER_S]: 120,
  [CONFIG_KEYS.TRACKING_INTERVAL_ACTIVE_S]: 4,
};

interface DocumentFixture {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  expiresAt: Date | null;
}

/** Rebuilds the shape `partnerInclude` produces for `documents` (media joined in). */
function withMedia(documents: DocumentFixture[]) {
  return documents.map((d) => ({
    ...d,
    partnerId: PARTNER_ID,
    number: null,
    mediaId: 'media-1',
    issuedAt: null,
    verifiedById: null,
    verifiedAt: null,
    rejectionReason: null,
    expiryNotifiedAt: null,
    createdAt: new Date('2024-02-01T00:00:00.000Z'),
    updatedAt: new Date('2024-02-01T00:00:00.000Z'),
    media: { bucket: 'private', objectKey: `partner_document/${d.id}.pdf`, isPublic: false, mediumKey: null, thumbnailKey: null },
  }));
}

interface PartnerFixtureOptions {
  verificationStatus?: VerificationStatus;
  suspendedUntil?: Date | null;
  roles?: PartnerRoleType[];
  requiredDocumentTypes?: DocumentType[];
  documents?: ReturnType<typeof withMedia>;
  zoneIds?: string[];
  categoryIds?: string[];
  activeVehicleId?: string | null;
  activeVehicleApproved?: boolean;
  availabilityStatus?: AvailabilityStatus;
  lastHeartbeatAt?: Date | null;
  currentJobId?: string | null;
  fullName?: string | null;
  nationalIdEnc?: string | null;
  city?: string | null;
  dateOfBirth?: Date | null;
  onboardingStep?: number;
}

function partnerFixture(options: PartnerFixtureOptions = {}) {
  const roles = options.roles ?? [PartnerRoleType.TECHNICIAN];
  const categoryIds = options.categoryIds ?? [CATEGORY_ID];
  const activeVehicleId = options.activeVehicleId === undefined ? null : options.activeVehicleId;
  return {
    userId: PARTNER_ID,
    verificationStatus: options.verificationStatus ?? VerificationStatus.DRAFT,
    suspendedUntil: options.suspendedUntil ?? null,
    onboardingStep: options.onboardingStep ?? PARTNER_ONBOARDING_STEPS.ZONES,
    dateOfBirth: options.dateOfBirth === undefined ? new Date('1990-05-01T00:00:00.000Z') : options.dateOfBirth,
    nationalIdEnc: options.nationalIdEnc === undefined ? 'enc:national-id' : options.nationalIdEnc,
    city: options.city === undefined ? 'Ramallah' : options.city,
    yearsOfExperience: 5,
    ratingSum: 45,
    ratingCount: 10,
    completedJobs: 12,
    cancelledJobs: 1,
    offersReceived: 20,
    offersAccepted: 16,
    penaltyPoints: 0,
    activeVehicleId,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    user: {
      id: PARTNER_ID,
      fullName: options.fullName === undefined ? 'Sami Odeh' : options.fullName,
      phone: '+970599123456',
      email: null,
      currency: 'ILS',
      profileImage: null,
    },
    roles: roles.map((role) => ({ partnerId: PARTNER_ID, role, isActive: true, createdAt: new Date() })),
    skills: [{ partnerId: PARTNER_ID, skill: 'plumbing', createdAt: new Date() }],
    categories: categoryIds.map((categoryId) => ({
      categoryId,
      category: {
        requiredDocumentTypes: options.requiredDocumentTypes ?? [DocumentType.ID],
        requiredPartnerRole: roles[0] ?? PartnerRoleType.TECHNICIAN,
      },
    })),
    zones: (options.zoneIds ?? [ZONE_ID]).map((zoneId) => ({ zoneId })),
    availability: {
      partnerId: PARTNER_ID,
      status: options.availabilityStatus ?? AvailabilityStatus.OFFLINE,
      activeRoles: roles,
      lastHeartbeatAt: options.lastHeartbeatAt === undefined ? null : options.lastHeartbeatAt,
      lastLocationAt: null,
      lat: null,
      lng: null,
      heading: null,
      speed: null,
      accuracy: null,
      batteryPercent: null,
      currentJobId: options.currentJobId ?? null,
      onlineSince: null,
      updatedAt: new Date(),
    },
    activeVehicle: activeVehicleId
      ? {
          id: activeVehicleId,
          isActive: true,
          verificationStatus: options.activeVehicleApproved === false ? VerificationStatus.PENDING : VerificationStatus.APPROVED,
        }
      : null,
    wallet: { balanceMinor: 12500n, currency: 'ILS' },
    documents: options.documents ?? withMedia([{ id: 'doc-1', type: DocumentType.ID, status: DocumentStatus.APPROVED, expiresAt: null }]),
  };
}

function mediaUrlsStub(): MediaUrlService {
  return {
    urlFor: jest.fn(() => '/api/v1/media/key/view'),
    signedUrl: jest.fn(async () => 'https://signed.example/doc'),
  } as unknown as MediaUrlService;
}

function systemConfigStub(): SystemConfigService {
  return {
    getNumber: jest.fn(async (key: ConfigKey) => CONFIG_DEFAULTS[key] ?? 0),
  } as unknown as SystemConfigService;
}

describe('PartnersService.submitForReview', () => {
  const buildService = (prismaMock: Record<string, unknown>) =>
    new PartnersService(
      prismaMock as unknown as PrismaService,
      { encryptionKey: Buffer.alloc(32) } as unknown as AppConfigService,
      { assertOwnedReady: jest.fn(async () => undefined) } as unknown as MediaService,
      mediaUrlsStub(),
      { record: jest.fn(async () => undefined) } as unknown as AuditService,
      { notify: jest.fn(async () => undefined) } as unknown as NotificationsService,
      {} as unknown as VehiclesService,
      new EventEmitter2(),
    );

  it('moves a complete file to PENDING and records the terms version', async () => {
    const partner = partnerFixture();
    const update = jest.fn(async () => partner);
    const prisma = {
      partnerProfile: { findUnique: jest.fn(async () => partner), update },
      vehicle: { count: jest.fn(async () => 0) },
    };
    const service = buildService(prisma);

    const dto = await service.submitForReview(PARTNER_ID, '2025-01');

    expect(update).toHaveBeenCalledWith({
      where: { userId: PARTNER_ID },
      data: {
        verificationStatus: VerificationStatus.PENDING,
        acceptedTermsVersion: '2025-01',
        reviewNote: null,
        onboardingStep: PARTNER_ONBOARDING_STEPS.SUBMITTED,
      },
    });
    expect(dto.userId).toBe(PARTNER_ID);
    expect(dto.walletBalance).toEqual({ amount: 12500, currency: 'ILS' });
  });

  it('rejects a file with no zones, a missing required document and no vehicle', async () => {
    const partner = partnerFixture({
      roles: [PartnerRoleType.DRIVER],
      requiredDocumentTypes: [DocumentType.ID, DocumentType.DRIVING_LICENSE],
      documents: withMedia([{ id: 'doc-1', type: DocumentType.ID, status: DocumentStatus.APPROVED, expiresAt: null }]),
      zoneIds: [],
    });
    const prisma = {
      partnerProfile: { findUnique: jest.fn(async () => partner), update: jest.fn() },
      vehicle: { count: jest.fn(async () => 0) },
    };
    const service = buildService(prisma);

    await expect(service.submitForReview(PARTNER_ID, '2025-01')).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    try {
      await service.submitForReview(PARTNER_ID, '2025-01');
      throw new Error('expected submitForReview to throw');
    } catch (err) {
      const details = (err as { details?: Array<{ field: string; message: string }> }).details ?? [];
      const fields = details.map((d) => d.field);
      expect(fields).toContain('documents');
      expect(fields).toContain('vehicle');
      expect(fields).toContain('zoneIds');
    }
    expect(prisma.partnerProfile.update).not.toHaveBeenCalled();
  });

  it('rejects a file whose required document has expired', async () => {
    const partner = partnerFixture({
      documents: withMedia([
        { id: 'doc-1', type: DocumentType.ID, status: DocumentStatus.APPROVED, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
      ]),
    });
    const prisma = {
      partnerProfile: { findUnique: jest.fn(async () => partner), update: jest.fn() },
      vehicle: { count: jest.fn(async () => 1) },
    };
    const service = buildService(prisma);

    await expect(service.submitForReview(PARTNER_ID, '2025-01')).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
    expect(prisma.partnerProfile.update).not.toHaveBeenCalled();
  });

  it('refuses to resubmit a file that is already under review', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.UNDER_REVIEW });
    const prisma = {
      partnerProfile: { findUnique: jest.fn(async () => partner), update: jest.fn() },
      vehicle: { count: jest.fn(async () => 1) },
    };
    const service = buildService(prisma);

    await expect(service.submitForReview(PARTNER_ID, '2025-01')).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('refuses to resubmit an approved file', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED });
    const prisma = {
      partnerProfile: { findUnique: jest.fn(async () => partner), update: jest.fn() },
      vehicle: { count: jest.fn(async () => 1) },
    };
    const service = buildService(prisma);

    await expect(service.submitForReview(PARTNER_ID, '2025-01')).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });
});

describe('PartnerAvailabilityService', () => {
  const buildService = (prismaMock: Record<string, unknown>) =>
    new PartnerAvailabilityService(prismaMock as unknown as PrismaService, systemConfigStub());

  type AvailabilityUpsertArgs = {
    where: { partnerId: string };
    update: { status?: string; onlineSince?: Date | null; lastHeartbeatAt?: Date; batteryPercent?: number | null };
    create: Record<string, unknown>;
  };

  const prismaFor = (partner: ReturnType<typeof partnerFixture>) => {
    // Typed with the argument the service actually passes, so `upsert.mock.calls[0][0]`
    // is inspectable. setAvailability() and heartbeat() write different subsets of
    // `update`, hence the optional fields.
    const upsert = jest.fn(async (_args: AvailabilityUpsertArgs) => partner.availability);
    const update = jest.fn(async () => partner.availability);
    return {
      mock: {
        partnerProfile: { findUnique: jest.fn(async () => partner), update: jest.fn(async () => partner) },
        partnerAvailability: { upsert, update, updateMany: jest.fn(async () => ({ count: 3 })), findUnique: jest.fn(async () => partner.availability) },
        vehicle: { findFirst: jest.fn(async () => ({ id: VEHICLE_ID })) },
        $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb({
            partnerProfile: { update: jest.fn(async () => partner) },
            partnerAvailability: { upsert },
          }),
        ),
      },
      upsert,
      update,
    };
  };

  it('refuses to go ONLINE while the account is not approved', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.PENDING });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.ONLINE })).rejects.toMatchObject({
      code: ErrorCode.PARTNER_NOT_APPROVED,
    });
  });

  it('refuses to go ONLINE while a required document has expired', async () => {
    const partner = partnerFixture({
      verificationStatus: VerificationStatus.APPROVED,
      documents: withMedia([
        { id: 'doc-1', type: DocumentType.ID, status: DocumentStatus.APPROVED, expiresAt: new Date('2020-01-01T00:00:00.000Z') },
      ]),
    });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.ONLINE })).rejects.toMatchObject({
      code: ErrorCode.PARTNER_NOT_APPROVED,
    });
  });

  it('refuses to go ONLINE as a DRIVER without an active vehicle', async () => {
    const partner = partnerFixture({
      verificationStatus: VerificationStatus.APPROVED,
      roles: [PartnerRoleType.DRIVER],
      activeVehicleId: null,
    });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.ONLINE })).rejects.toMatchObject({
      code: ErrorCode.PARTNER_NOT_APPROVED,
    });
  });

  it('lets an approved partner with a valid file go ONLINE', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED, roles: [PartnerRoleType.DRIVER], activeVehicleId: VEHICLE_ID });
    const { mock, upsert } = prismaFor(partner);
    const service = buildService(mock);

    const dto = await service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.ONLINE });

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0]?.[0];
    expect(call?.update.status).toBe(AvailabilityStatus.ONLINE);
    expect(call?.update.onlineSince).toBeInstanceOf(Date);
    expect(dto.partnerId).toBe(PARTNER_ID);
  });

  it('refuses to go OFFLINE while a job is in hand', async () => {
    const partner = partnerFixture({
      verificationStatus: VerificationStatus.APPROVED,
      availabilityStatus: AvailabilityStatus.BUSY,
      currentJobId: '55555555-5555-4555-8555-555555555555',
    });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.OFFLINE })).rejects.toMatchObject({
      code: ErrorCode.PARTNER_NOT_AVAILABLE,
    });
  });

  it('rejects an activeRole the partner does not hold', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED, roles: [PartnerRoleType.TECHNICIAN] });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(
      service.setAvailability(PARTNER_ID, { status: AvailabilityStatus.OFFLINE, activeRoles: [PartnerRoleType.DRIVER] }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('records the heartbeat and rejects a stale location sample', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED, availabilityStatus: AvailabilityStatus.ONLINE });
    const { mock, upsert, update } = prismaFor(partner);
    const service = buildService(mock);

    await expect(
      service.heartbeat(PARTNER_ID, {
        location: { lat: 31.9, lng: 35.2, accuracy: 10, timestamp: new Date(Date.now() - 600_000).toISOString() },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.STALE_LOCATION });
    // The heartbeat itself is stored first so a bad GPS fix never drops the partner offline.
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a location sample whose accuracy is worse than the configured limit', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED, availabilityStatus: AvailabilityStatus.ONLINE });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(
      service.heartbeat(PARTNER_ID, {
        location: { lat: 31.9, lng: 35.2, accuracy: 900, timestamp: new Date().toISOString() },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('stores a fresh, accurate location sample', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED, availabilityStatus: AvailabilityStatus.ONLINE });
    const { mock, update } = prismaFor(partner);
    const service = buildService(mock);

    const result = await service.heartbeat(PARTNER_ID, {
      location: { lat: 31.9, lng: 35.2, accuracy: 12, heading: 90, speed: 8, timestamp: new Date().toISOString() },
      batteryPercent: 77,
    });

    expect(result.locationAccepted).toBe(true);
    expect(result.heartbeatIntervalSeconds).toBe(CONFIG_DEFAULTS[CONFIG_KEYS.HEARTBEAT_INTERVAL_S]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('treats a stale heartbeat as offline even when the stored status says ONLINE', async () => {
    const partner = partnerFixture({
      verificationStatus: VerificationStatus.APPROVED,
      availabilityStatus: AvailabilityStatus.ONLINE,
      lastHeartbeatAt: new Date(Date.now() - 10 * 60_000),
    });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.isEffectivelyOnline(PARTNER_ID)).resolves.toBe(false);
  });

  it('treats a recent heartbeat on an ONLINE row as available', async () => {
    const partner = partnerFixture({
      verificationStatus: VerificationStatus.APPROVED,
      availabilityStatus: AvailabilityStatus.ONLINE,
      lastHeartbeatAt: new Date(Date.now() - 5_000),
    });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.isEffectivelyOnline(PARTNER_ID)).resolves.toBe(true);
  });

  it('sweeps partners with no heartbeat and no job to OFFLINE', async () => {
    const partner = partnerFixture({ verificationStatus: VerificationStatus.APPROVED });
    const { mock } = prismaFor(partner);
    const service = buildService(mock);

    await expect(service.markOfflineStale()).resolves.toBe(3);
    const call = (mock.partnerAvailability.updateMany as jest.Mock).mock.calls[0]?.[0] as
      | { where: { currentJobId: string | null }; data: { status: string } }
      | undefined;
    expect(call?.where.currentJobId).toBeNull();
    expect(call?.data.status).toBe(AvailabilityStatus.OFFLINE);
  });
});
