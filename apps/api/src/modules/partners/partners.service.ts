import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  ACTIVE_JOB_STATUSES,
  AssignmentStatus,
  AvailabilityStatus,
  DocumentStatus,
  ErrorCode,
  type JobActorType,
  JobStatus,
  type JobStopKind,
  type JobType,
  type LocalizedText,
  MediaPurpose,
  type Money,
  NotificationEvent,
  type Page,
  type PartnerDocumentDto,
  type PartnerDto,
  Permission,
  type VehicleDto,
  VerificationStatus,
  WithdrawalStatus,
} from '@tamam/shared-types';
import type {
  AdminUpdatePartnerInput,
  JobListFilterInput,
  PageRequestInput,
  PartnerDecisionInput,
  PartnerDocumentUploadInput,
  PartnerListFilterInput,
  PartnerOnboardingPersonalInput,
  PartnerOnboardingRolesInput,
  PartnerOnboardingSkillsInput,
  PartnerVehicleInput,
  PartnerZonesInput,
  ReviewDocumentInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { decrypt, encrypt } from '../../common/utils/crypto.util';
import { buildPage, cursorWhere, decodeCursor, encodeCursor } from '../../common/utils/cursor';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MediaUrlService } from '../media/media-url.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  VEHICLE_REQUIRED_ROLES,
  VehiclesService,
  normalizePlate,
} from '../vehicles/vehicles.service';

import { PartnerAvailabilityService } from './partner-availability.service';

/** Resumable onboarding wizard (spec §126). `partner_profiles.onboarding_step` stores the furthest completed step. */
export const PARTNER_ONBOARDING_STEPS = {
  PERSONAL: 1,
  ROLES: 2,
  SKILLS: 3,
  DOCUMENTS: 4,
  VEHICLE: 5,
  ZONES: 6,
  SUBMITTED: 7,
} as const;

/** Statuses in which the partner may still edit their own onboarding data. */
const EDITABLE_STATUSES: readonly VerificationStatus[] = [
  VerificationStatus.DRAFT,
  VerificationStatus.PENDING,
  VerificationStatus.UNDER_REVIEW,
  VerificationStatus.REJECTED,
];

export interface AddBankAccountInput {
  bankName: string;
  accountHolder: string;
  iban: string;
  isDefault: boolean;
}

export interface PartnerBankAccountDto {
  id: string;
  bankName: string;
  accountHolder: string;
  ibanLast4: string;
  isDefault: boolean;
  createdAt: string;
}

/** One row of the partner's own job history. Real earnings come from the ledger; this is the offer figure. */
export interface PartnerJobHistoryItemDto {
  id: string;
  number: string;
  type: JobType;
  status: JobStatus;
  categoryId: string | null;
  categoryName: LocalizedText | null;
  currency: string;
  estimatedTotal: Money | null;
  finalTotal: Money | null;
  /** `job_assignments.estimated_earnings_minor` of this partner's ACCEPTED assignment. */
  estimatedEarnings: Money | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  stops: Array<{
    id: string;
    sequence: number;
    kind: JobStopKind;
    formatted: string;
    city: string | null;
  }>;
  cancellationReason: string | null;
  cancelledBy: JobActorType | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

const partnerInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      currency: true,
      profileImage: true,
    },
  },
  roles: true,
  skills: true,
  categories: {
    select: {
      categoryId: true,
      category: { select: { requiredDocumentTypes: true, requiredPartnerRole: true } },
    },
  },
  zones: { select: { zoneId: true } },
  availability: true,
  wallet: { select: { balanceMinor: true, currency: true } },
  documents: { include: { media: true }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.PartnerProfileInclude;

type PartnerRow = Prisma.PartnerProfileGetPayload<{ include: typeof partnerInclude }>;
type PartnerDocumentRow = Prisma.PartnerDocumentGetPayload<{ include: { media: true } }>;

const jobHistorySelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  currency: true,
  estimatedTotalMinor: true,
  finalTotalMinor: true,
  distanceMeters: true,
  durationSeconds: true,
  actualDistanceMeters: true,
  actualDurationSeconds: true,
  cancellationReasonCode: true,
  cancelledBy: true,
  createdAt: true,
  completedAt: true,
  cancelledAt: true,
  category: { select: { id: true, nameAr: true, nameEn: true } },
  stops: {
    select: { id: true, sequence: true, kind: true, formatted: true, city: true },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.JobSelect;

/**
 * Partner onboarding, documents, approval and self-service reads (spec §125–§132).
 * Every partner-facing method is keyed by the authenticated user id — the partner profile's
 * primary key *is* the user id, so there is no id to spoof.
 */
@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly media: MediaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly vehicles: VehiclesService,
    private readonly events: EventEmitter2,
  ) {}

  /* ---------------------------------------------------------------- read */

  async getProfile(userId: string): Promise<PartnerDto> {
    return this.toDto(await this.requirePartner(userId));
  }

  async listDocuments(userId: string): Promise<PartnerDocumentDto[]> {
    const rows = await this.prisma.partnerDocument.findMany({
      where: { partnerId: userId },
      include: { media: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(rows.map((r) => this.toDocumentDto(r)));
  }

  /* ---------------------------------------------------------- onboarding */

  async savePersonal(userId: string, input: PartnerOnboardingPersonalInput): Promise<PartnerDto> {
    const partner = await this.requirePartner(userId);
    this.assertOnboardingEditable(partner);
    if (input.profileImageMediaId)
      await this.media.assertOwnedReady(
        userId,
        [input.profileImageMediaId],
        [MediaPurpose.PROFILE],
      );
    if (input.email) {
      const clash = await this.prisma.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (clash) throw AppException.conflict('Email already in use');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: input.fullName,
          ...(input.email ? { email: input.email } : {}),
          ...(input.profileImageMediaId ? { profileImageId: input.profileImageMediaId } : {}),
        },
      });
      await tx.partnerProfile.update({
        where: { userId },
        data: {
          dateOfBirth: new Date(input.dateOfBirth),
          nationalIdEnc: encrypt(input.nationalId.trim(), this.appConfig.encryptionKey),
          city: input.city,
          onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.PERSONAL),
        },
      });
    });
    return this.getProfile(userId);
  }

  async saveRoles(userId: string, input: PartnerOnboardingRolesInput): Promise<PartnerDto> {
    const partner = await this.requirePartner(userId);
    this.assertOnboardingEditable(partner);
    const roles = [...new Set(input.roles)];

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerRole.deleteMany({ where: { partnerId: userId, role: { notIn: roles } } });
      for (const role of roles) {
        await tx.partnerRole.upsert({
          where: { partnerId_role: { partnerId: userId, role } },
          update: { isActive: true },
          create: { partnerId: userId, role },
        });
      }
      // Keep the availability row's working roles in sync with what the partner is allowed to do.
      await tx.partnerAvailability.upsert({
        where: { partnerId: userId },
        update: { activeRoles: roles },
        create: { partnerId: userId, activeRoles: roles },
      });
      await tx.partnerProfile.update({
        where: { userId },
        data: { onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.ROLES) },
      });
    });
    return this.getProfile(userId);
  }

  async saveSkills(userId: string, input: PartnerOnboardingSkillsInput): Promise<PartnerDto> {
    const partner = await this.requirePartner(userId);
    this.assertOnboardingEditable(partner);
    const categoryIds = [...new Set(input.categoryIds)];
    const categories = await this.prisma.serviceCategory.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      select: { id: true, requiredPartnerRole: true, nameEn: true },
    });
    if (categories.length !== categoryIds.length) {
      const found = new Set(categories.map((c) => c.id));
      throw AppException.validation(
        categoryIds
          .filter((id) => !found.has(id))
          .map((id) => ({ field: 'categoryIds', message: `unknown or inactive category ${id}` })),
      );
    }
    const roles = partner.roles.filter((r) => r.isActive).map((r) => r.role);
    const mismatched = categories.filter((c) => !roles.includes(c.requiredPartnerRole));
    if (mismatched.length) {
      throw AppException.validation(
        mismatched.map((c) => ({
          field: 'categoryIds',
          message: `${c.nameEn} requires the ${c.requiredPartnerRole} role`,
        })),
      );
    }
    const skills = [...new Set(input.skills.map((s) => s.trim()).filter(Boolean))];

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerCategory.deleteMany({
        where: { partnerId: userId, categoryId: { notIn: categoryIds } },
      });
      for (const categoryId of categoryIds) {
        await tx.partnerCategory.upsert({
          where: { partnerId_categoryId: { partnerId: userId, categoryId } },
          update: {},
          create: { partnerId: userId, categoryId },
        });
      }
      await tx.partnerSkill.deleteMany({ where: { partnerId: userId, skill: { notIn: skills } } });
      for (const skill of skills) {
        await tx.partnerSkill.upsert({
          where: { partnerId_skill: { partnerId: userId, skill } },
          update: {},
          create: { partnerId: userId, skill },
        });
      }
      await tx.partnerProfile.update({
        where: { userId },
        data: {
          yearsOfExperience: input.yearsOfExperience ?? partner.yearsOfExperience,
          onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.SKILLS),
        },
      });
    });
    return this.getProfile(userId);
  }

  /** One live document per (partner, type): re-uploading replaces the row and re-opens review. */
  async addDocument(
    userId: string,
    input: PartnerDocumentUploadInput,
  ): Promise<PartnerDocumentDto> {
    const partner = await this.requirePartner(userId);
    if (partner.verificationStatus === VerificationStatus.SUSPENDED) {
      throw AppException.forbidden(
        'Suspended partners cannot upload documents',
        ErrorCode.PARTNER_NOT_APPROVED,
      );
    }
    await this.media.assertOwnedReady(userId, [input.mediaId], [MediaPurpose.PARTNER_DOCUMENT]);
    const existing = await this.prisma.partnerDocument.findFirst({
      where: { partnerId: userId, type: input.type },
      orderBy: { createdAt: 'desc' },
    });
    const data = {
      type: input.type,
      number: input.number ?? null,
      mediaId: input.mediaId,
      issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      status: DocumentStatus.PENDING,
      verifiedById: null,
      verifiedAt: null,
      rejectionReason: null,
      expiryNotifiedAt: null,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const doc = existing
        ? await tx.partnerDocument.update({
            where: { id: existing.id },
            data,
            include: { media: true },
          })
        : await tx.partnerDocument.create({
            data: { partnerId: userId, ...data },
            include: { media: true },
          });
      await tx.partnerProfile.update({
        where: { userId },
        data: {
          onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.DOCUMENTS),
        },
      });
      return doc;
    });
    return this.toDocumentDto(row);
  }

  /** Onboarding step 5 — creates the vehicle, or updates the one already registered on that plate. */
  async saveVehicle(userId: string, input: PartnerVehicleInput): Promise<VehicleDto> {
    const partner = await this.requirePartner(userId);
    this.assertOnboardingEditable(partner);
    const existing = await this.prisma.vehicle.findFirst({
      where: { partnerId: userId, plateNormalized: normalizePlate(input.plate) },
      select: { id: true },
    });
    const vehicle = existing
      ? await this.vehicles.update(userId, existing.id, input)
      : await this.vehicles.create(userId, input);
    await this.prisma.partnerProfile.update({
      where: { userId },
      data: { onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.VEHICLE) },
    });
    return vehicle;
  }

  async saveZones(userId: string, input: PartnerZonesInput): Promise<PartnerDto> {
    const partner = await this.requirePartner(userId);
    this.assertOnboardingEditable(partner);
    const zoneIds = [...new Set(input.zoneIds)];
    const zones = await this.prisma.serviceZone.findMany({
      where: { id: { in: zoneIds }, isActive: true },
      select: { id: true },
    });
    if (zones.length !== zoneIds.length) {
      const found = new Set(zones.map((z) => z.id));
      throw AppException.validation(
        zoneIds
          .filter((id) => !found.has(id))
          .map((id) => ({ field: 'zoneIds', message: `unknown or inactive zone ${id}` })),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerZone.deleteMany({ where: { partnerId: userId, zoneId: { notIn: zoneIds } } });
      for (const zoneId of zoneIds) {
        await tx.partnerZone.upsert({
          where: { partnerId_zoneId: { partnerId: userId, zoneId } },
          update: {},
          create: { partnerId: userId, zoneId },
        });
      }
      await tx.partnerProfile.update({
        where: { userId },
        data: { onboardingStep: Math.max(partner.onboardingStep, PARTNER_ONBOARDING_STEPS.ZONES) },
      });
    });
    return this.getProfile(userId);
  }

  /**
   * Final onboarding step. Everything the reviewer needs must be in place before the file
   * reaches the queue — an incomplete submission is rejected with the full list of gaps.
   */
  async submitForReview(userId: string, acceptedTermsVersion: string): Promise<PartnerDto> {
    const partner = await this.requirePartner(userId);
    if (partner.verificationStatus === VerificationStatus.APPROVED)
      throw AppException.conflict('Your partner account is already approved');
    if (partner.verificationStatus === VerificationStatus.SUSPENDED)
      throw AppException.forbidden(
        'Your partner account is suspended',
        ErrorCode.PARTNER_NOT_APPROVED,
      );
    if (
      partner.verificationStatus === VerificationStatus.PENDING ||
      partner.verificationStatus === VerificationStatus.UNDER_REVIEW
    ) {
      throw AppException.conflict('Your application is already under review');
    }

    const errors = await this.collectSubmissionGaps(partner);
    if (errors.length)
      throw AppException.validation(errors, 'Your application is not complete yet');

    await this.prisma.partnerProfile.update({
      where: { userId },
      data: {
        verificationStatus: VerificationStatus.PENDING,
        acceptedTermsVersion,
        reviewNote: null,
        onboardingStep: PARTNER_ONBOARDING_STEPS.SUBMITTED,
      },
    });
    return this.getProfile(userId);
  }

  /** Everything a reviewer needs before the file may enter the queue. */
  private async collectSubmissionGaps(
    partner: PartnerRow,
  ): Promise<Array<{ field: string; message: string }>> {
    const errors: Array<{ field: string; message: string }> = [];
    if (!partner.user.fullName)
      errors.push({ field: 'fullName', message: 'personal details are missing' });
    if (!partner.dateOfBirth)
      errors.push({ field: 'dateOfBirth', message: 'date of birth is missing' });
    if (!partner.nationalIdEnc)
      errors.push({ field: 'nationalId', message: 'national id is missing' });
    if (!partner.city) errors.push({ field: 'city', message: 'city is missing' });

    const roles = partner.roles.filter((r) => r.isActive).map((r) => r.role);
    if (!roles.length) errors.push({ field: 'roles', message: 'choose at least one partner role' });
    if (!partner.categories.length)
      errors.push({ field: 'categoryIds', message: 'choose at least one service category' });

    const requiredTypes = PartnerAvailabilityService.requiredDocumentTypes(partner);
    const usable = new Map(
      partner.documents
        .filter((d) => d.status !== DocumentStatus.REJECTED && d.status !== DocumentStatus.EXPIRED)
        .map((d) => [d.type, d] as const),
    );
    const now = new Date();
    for (const type of requiredTypes) {
      const doc = usable.get(type);
      if (!doc)
        errors.push({
          field: 'documents',
          message: `document ${type} is required for the selected categories`,
        });
      else if (doc.expiresAt && doc.expiresAt.getTime() < now.getTime())
        errors.push({ field: 'documents', message: `document ${type} has expired` });
    }

    const needsVehicle = roles.filter((r) => VEHICLE_REQUIRED_ROLES.includes(r));
    if (needsVehicle.length) {
      const vehicleCount = await this.prisma.vehicle.count({
        where: { partnerId: partner.userId, isActive: true },
      });
      if (!vehicleCount)
        errors.push({
          field: 'vehicle',
          message: `working as ${needsVehicle.join(', ')} requires a registered vehicle`,
        });
    }

    if (!partner.zones.length)
      errors.push({ field: 'zoneIds', message: 'choose at least one working zone' });
    return errors;
  }

  /* -------------------------------------------------------- job history */

  async listJobs(
    userId: string,
    filter: JobListFilterInput & PageRequestInput,
  ): Promise<Page<PartnerJobHistoryItemDto>> {
    await this.requirePartnerExists(userId);
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.job.findMany({
      where: {
        ...cursorWhere(cursor),
        partnerId: userId,
        type: filter.type,
        status: filter.status ?? this.statusGroupFilter(filter.statusGroup),
        number: filter.q ? { contains: filter.q.toUpperCase() } : undefined,
        createdAt:
          filter.from || filter.to
            ? {
                gte: filter.from ? new Date(filter.from) : undefined,
                lte: filter.to ? new Date(filter.to) : undefined,
              }
            : undefined,
      },
      select: {
        ...jobHistorySelect,
        assignments: {
          where: { partnerId: userId, status: AssignmentStatus.ACCEPTED },
          select: { estimatedEarningsMinor: true },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (job) => this.toJobHistoryItem(job));
  }

  /* ------------------------------------------------------- bank accounts */

  async listBankAccounts(userId: string): Promise<PartnerBankAccountDto[]> {
    await this.requirePartnerExists(userId);
    const rows = await this.prisma.partnerBankAccount.findMany({
      where: { partnerId: userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toBankAccountDto(r));
  }

  /**
   * Removes a payout account. A stale IBAN otherwise stayed on the profile for good, since
   * adding a replacement never retired the old one.
   *
   * Refused while a withdrawal is still in flight against it — Withdrawal.bankAccountId is a
   * hard foreign key, and a paid statement must keep pointing at the account it paid.
   * The default flag moves to the newest surviving account so the partner is never left
   * without one.
   */
  async deleteBankAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.partnerBankAccount.findFirst({
      where: { id: accountId, partnerId: userId },
    });
    if (!account) throw AppException.notFound('Bank account', accountId);

    const inFlight = await this.prisma.withdrawal.count({
      where: {
        bankAccountId: accountId,
        status: { in: [WithdrawalStatus.REQUESTED, WithdrawalStatus.APPROVED] },
      },
    });
    if (inFlight > 0)
      throw AppException.conflict(
        'This account has a withdrawal in progress and cannot be removed yet',
      );
    const settled = await this.prisma.withdrawal.count({ where: { bankAccountId: accountId } });
    if (settled > 0) throw AppException.conflict('This account is referenced by past withdrawals');

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerBankAccount.delete({ where: { id: accountId } });
      if (!account.isDefault) return;
      const next = await tx.partnerBankAccount.findFirst({
        where: { partnerId: userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next)
        await tx.partnerBankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    });
  }

  async addBankAccount(userId: string, input: AddBankAccountInput): Promise<PartnerBankAccountDto> {
    await this.requirePartnerExists(userId);
    const iban = input.iban.toUpperCase().replace(/[\s-]+/g, '');
    if (iban.length < 15 || iban.length > 34)
      throw AppException.validation([{ field: 'iban', message: 'IBAN must be 15-34 characters' }]);

    const key = this.appConfig.encryptionKey;
    const existing = await this.prisma.partnerBankAccount.findMany({
      where: { partnerId: userId },
      select: { id: true, ibanEnc: true },
    });
    if (existing.some((row) => decrypt(row.ibanEnc, key) === iban)) {
      throw AppException.conflict('This bank account is already saved');
    }
    const makeDefault = input.isDefault || existing.length === 0;

    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault)
        await tx.partnerBankAccount.updateMany({
          where: { partnerId: userId },
          data: { isDefault: false },
        });
      return tx.partnerBankAccount.create({
        data: {
          partnerId: userId,
          bankName: input.bankName,
          accountHolder: input.accountHolder,
          ibanEnc: encrypt(iban, key),
          ibanLast4: iban.slice(-4),
          isDefault: makeDefault,
        },
      });
    });
    return this.toBankAccountDto(row);
  }

  /* --------------------------------------------------------------- admin */

  async adminList(filter: PartnerListFilterInput & PageRequestInput): Promise<Page<PartnerDto>> {
    const cursor = decodeCursor(filter.cursor);
    const statuses = this.parseVerificationStatuses(filter.verificationStatus);
    const at = cursor ? new Date(cursor.createdAt) : null;
    const rows = await this.prisma.partnerProfile.findMany({
      where: {
        ...(at && cursor
          ? { OR: [{ createdAt: { lt: at } }, { createdAt: at, userId: { lt: cursor.id } }] }
          : {}),
        verificationStatus: statuses ? { in: statuses } : undefined,
        availability: filter.availability ? { is: { status: filter.availability } } : undefined,
        roles: filter.role ? { some: { role: filter.role, isActive: true } } : undefined,
        zones: filter.zoneId ? { some: { zoneId: filter.zoneId } } : undefined,
        categories: filter.categoryId ? { some: { categoryId: filter.categoryId } } : undefined,
        user: filter.q
          ? {
              OR: [
                { phone: { contains: filter.q } },
                { fullName: { contains: filter.q, mode: 'insensitive' } },
                { email: { contains: filter.q, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: partnerInclude,
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: filter.limit + 1,
    });

    const hasMore = rows.length > filter.limit;
    const slice = hasMore ? rows.slice(0, filter.limit) : rows;
    const last = slice[slice.length - 1];
    return {
      items: await Promise.all(slice.map((row) => this.toDto(row))),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.userId })
          : null,
    };
  }

  async adminGet(partnerId: string): Promise<PartnerDto> {
    return this.toDto(await this.requirePartner(partnerId));
  }

  async reviewDocument(
    partnerId: string,
    documentId: string,
    input: ReviewDocumentInput,
    actor: RequestUser,
    requestId: string | null,
  ): Promise<PartnerDocumentDto> {
    const doc = await this.prisma.partnerDocument.findFirst({
      where: { id: documentId, partnerId },
    });
    if (!doc) throw AppException.notFound('Partner document', documentId);
    const approve = input.decision === 'APPROVE';

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.partnerDocument.update({
        where: { id: documentId },
        data: {
          status: approve ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          expiresAt: approve && input.expiresAt ? new Date(input.expiresAt) : doc.expiresAt,
          rejectionReason: approve ? null : (input.rejectionReason ?? null),
          expiryNotifiedAt: null,
        },
        include: { media: true },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: approve ? 'partner_document.approve' : 'partner_document.reject',
          entity: 'partner_document',
          entityId: documentId,
          oldValue: { status: doc.status, expiresAt: doc.expiresAt },
          newValue: { status: updated.status, expiresAt: updated.expiresAt },
          reason: input.rejectionReason ?? null,
          requestId,
        },
        tx,
      );
      return updated;
    });

    await this.notifications.notify({
      userId: partnerId,
      event: NotificationEvent.DOCUMENT_REVIEWED,
      vars: {
        documentType: doc.type,
        decision: approve ? 'APPROVED' : 'REJECTED',
        reason: input.rejectionReason ?? '',
      },
      data: { documentId },
    });
    return this.toDocumentDto(row);
  }

  /**
   * Approve / reject / suspend / reinstate a partner file. The permission required depends on
   * the decision, so the route allows either and the exact one is enforced here.
   */
  async decide(
    partnerId: string,
    input: PartnerDecisionInput,
    actor: RequestUser,
    requestId: string | null,
  ): Promise<PartnerDto> {
    const needed =
      input.decision === 'SUSPEND' || input.decision === 'REINSTATE'
        ? Permission.PARTNERS_SUSPEND
        : Permission.PARTNERS_APPROVE;
    if (!actor.isSuperAdmin && !actor.permissions.includes(needed))
      throw AppException.forbidden(`Missing permission: ${needed}`);

    const partner = await this.requirePartner(partnerId);
    if (
      input.decision === 'SUSPEND' &&
      partner.verificationStatus === VerificationStatus.SUSPENDED
    ) {
      throw AppException.conflict('Partner is already suspended');
    }
    if (
      input.decision === 'REINSTATE' &&
      partner.verificationStatus !== VerificationStatus.SUSPENDED
    ) {
      throw AppException.conflict('Only a suspended partner can be reinstated');
    }

    const now = new Date();
    const nextStatus =
      input.decision === 'APPROVE' || input.decision === 'REINSTATE'
        ? VerificationStatus.APPROVED
        : input.decision === 'REJECT'
          ? VerificationStatus.REJECTED
          : VerificationStatus.SUSPENDED;
    const goesOffline = nextStatus !== VerificationStatus.APPROVED;

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerProfile.update({
        where: { userId: partnerId },
        data: {
          verificationStatus: nextStatus,
          reviewedById: actor.id,
          reviewedAt: now,
          reviewNote: input.reason,
          suspendedUntil:
            input.decision === 'SUSPEND' ? (input.until ? new Date(input.until) : null) : null,
        },
      });
      if (goesOffline) {
        // A rejected or suspended partner must stop receiving offers immediately.
        await tx.partnerAvailability.updateMany({
          where: {
            partnerId,
            status: { in: [AvailabilityStatus.ONLINE, AvailabilityStatus.BUSY] },
          },
          data: { status: AvailabilityStatus.OFFLINE, onlineSince: null },
        });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.roles.join(','),
          action: `partner.${input.decision.toLowerCase()}`,
          entity: 'partner',
          entityId: partnerId,
          oldValue: {
            verificationStatus: partner.verificationStatus,
            suspendedUntil: partner.suspendedUntil,
          },
          newValue: { verificationStatus: nextStatus, suspendedUntil: input.until ?? null },
          reason: input.reason,
          requestId,
        },
        tx,
      );
    });

    if (nextStatus === VerificationStatus.APPROVED) {
      await this.notifications.notify({
        userId: partnerId,
        event: NotificationEvent.PARTNER_APPROVED,
        priority: 'high',
      });
      // `decision` lets listeners tell a first approval from a reinstatement without a second event name.
      this.events.emit('partner.approved', {
        partnerId,
        decision: input.decision,
        actorId: actor.id,
        at: now.toISOString(),
      });
    }
    return this.getProfile(partnerId);
  }

  async adminUpdate(
    partnerId: string,
    input: AdminUpdatePartnerInput,
    actor: RequestUser,
    requestId: string | null,
  ): Promise<PartnerDto> {
    const partner = await this.requirePartner(partnerId);
    if (input.categoryIds?.length) {
      const found = await this.prisma.serviceCategory.count({
        where: { id: { in: input.categoryIds } },
      });
      if (found !== new Set(input.categoryIds).size)
        throw AppException.validation([{ field: 'categoryIds', message: 'unknown category id' }]);
    }
    if (input.zoneIds?.length) {
      const found = await this.prisma.serviceZone.count({ where: { id: { in: input.zoneIds } } });
      if (found !== new Set(input.zoneIds).size)
        throw AppException.validation([{ field: 'zoneIds', message: 'unknown zone id' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.roles) {
        const roles = [...new Set(input.roles)];
        await tx.partnerRole.deleteMany({ where: { partnerId, role: { notIn: roles } } });
        for (const role of roles) {
          await tx.partnerRole.upsert({
            where: { partnerId_role: { partnerId, role } },
            update: { isActive: true },
            create: { partnerId, role },
          });
        }
        await tx.partnerAvailability.upsert({
          where: { partnerId },
          update: { activeRoles: roles },
          create: { partnerId, activeRoles: roles },
        });
      }
      if (input.categoryIds) {
        const categoryIds = [...new Set(input.categoryIds)];
        await tx.partnerCategory.deleteMany({
          where: { partnerId, categoryId: { notIn: categoryIds } },
        });
        for (const categoryId of categoryIds) {
          await tx.partnerCategory.upsert({
            where: { partnerId_categoryId: { partnerId, categoryId } },
            update: {},
            create: { partnerId, categoryId },
          });
        }
      }
      if (input.zoneIds) {
        const zoneIds = [...new Set(input.zoneIds)];
        await tx.partnerZone.deleteMany({ where: { partnerId, zoneId: { notIn: zoneIds } } });
        for (const zoneId of zoneIds) {
          await tx.partnerZone.upsert({
            where: { partnerId_zoneId: { partnerId, zoneId } },
            update: {},
            create: { partnerId, zoneId },
          });
        }
      }
      if (input.skills) {
        const skills = [...new Set(input.skills.map((s) => s.trim()).filter(Boolean))];
        await tx.partnerSkill.deleteMany({ where: { partnerId, skill: { notIn: skills } } });
        for (const skill of skills) {
          await tx.partnerSkill.upsert({
            where: { partnerId_skill: { partnerId, skill } },
            update: {},
            create: { partnerId, skill },
          });
        }
      }
      await this.audit.record(
        {
          actorId: actor.id,
          actorRole: actor.roles.join(','),
          action: 'partner.update',
          entity: 'partner',
          entityId: partnerId,
          oldValue: {
            roles: partner.roles.map((r) => r.role),
            categoryIds: partner.categories.map((c) => c.categoryId),
            zoneIds: partner.zones.map((z) => z.zoneId),
            skills: partner.skills.map((s) => s.skill),
          },
          newValue: {
            roles: input.roles,
            categoryIds: input.categoryIds,
            zoneIds: input.zoneIds,
            skills: input.skills,
          },
          reason: input.reason,
          requestId,
        },
        tx,
      );
    });
    return this.getProfile(partnerId);
  }

  /* ------------------------------------------------------------- helpers */

  private async requirePartner(userId: string): Promise<PartnerRow> {
    const partner = await this.prisma.partnerProfile.findUnique({
      where: { userId },
      include: partnerInclude,
    });
    if (!partner) throw AppException.notFound('Partner profile', userId);
    return partner;
  }

  private async requirePartnerExists(userId: string): Promise<void> {
    const exists = await this.prisma.partnerProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!exists) throw AppException.notFound('Partner profile', userId);
  }

  private assertOnboardingEditable(partner: PartnerRow): void {
    if (!EDITABLE_STATUSES.includes(partner.verificationStatus)) {
      throw AppException.conflict(
        'Approved and suspended partner files are changed by support, not in the app',
      );
    }
  }

  private parseVerificationStatuses(raw: string | undefined): VerificationStatus[] | undefined {
    if (!raw) return undefined;
    const allowed = Object.values(VerificationStatus) as string[];
    const wanted = raw
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const parsed = wanted.filter((s): s is VerificationStatus => allowed.includes(s));
    if (parsed.length !== wanted.length)
      throw AppException.validation([
        { field: 'verificationStatus', message: `allowed values: ${allowed.join(', ')}` },
      ]);
    return parsed.length ? parsed : undefined;
  }

  private statusGroupFilter(
    group: JobListFilterInput['statusGroup'],
  ): Prisma.JobWhereInput['status'] {
    if (group === 'completed') return { in: [JobStatus.COMPLETED] };
    if (group === 'cancelled') return { in: [JobStatus.CANCELLED, JobStatus.NO_PARTNER_AVAILABLE] };
    if (group === 'active') return { in: [...ACTIVE_JOB_STATUSES] };
    return undefined;
  }

  /* ------------------------------------------------------------- mapping */

  private async toDto(p: PartnerRow): Promise<PartnerDto> {
    const a = p.availability;
    const currency = (p.wallet?.currency ?? p.user.currency) as Money['currency'];
    const totalDecided = p.completedJobs + p.cancelledJobs;
    return {
      id: p.userId,
      userId: p.userId,
      verificationStatus: p.verificationStatus,
      availability: a?.status ?? AvailabilityStatus.OFFLINE,
      roles: p.roles.filter((r) => r.isActive).map((r) => r.role),
      rating: p.ratingCount ? Number((p.ratingSum / p.ratingCount).toFixed(2)) : 5,
      ratingCount: p.ratingCount,
      completedJobs: p.completedJobs,
      acceptanceRate: p.offersReceived
        ? Number((p.offersAccepted / p.offersReceived).toFixed(3))
        : 1,
      cancellationRate: totalDecided ? Number((p.cancelledJobs / totalDecided).toFixed(3)) : 0,
      fullName: p.user.fullName,
      phone: p.user.phone,
      profileImageUrl: p.user.profileImage ? this.mediaUrls.urlFor(p.user.profileImage) : null,
      skills: p.skills.map((s) => s.skill),
      categoryIds: p.categories.map((c) => c.categoryId),
      zoneIds: p.zones.map((z) => z.zoneId),
      activeVehicleId: p.activeVehicleId,
      walletBalance: { amount: Number(p.wallet?.balanceMinor ?? 0n), currency },
      lastHeartbeatAt: a?.lastHeartbeatAt ? a.lastHeartbeatAt.toISOString() : null,
      lastLocation:
        a && a.lat !== null && a.lng !== null
          ? { lat: a.lat.toNumber(), lng: a.lng.toNumber() }
          : null,
      documents: await Promise.all(p.documents.map((d) => this.toDocumentDto(d))),
      onboardingStep: p.onboardingStep,
      createdAt: p.createdAt.toISOString(),
    };
  }

  private async toDocumentDto(d: PartnerDocumentRow): Promise<PartnerDocumentDto> {
    return {
      id: d.id,
      type: d.type,
      number: d.number,
      fileUrl: await this.mediaUrls.signedUrl(d.media),
      issuedAt: d.issuedAt ? d.issuedAt.toISOString() : null,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      status: d.status,
      verifiedBy: d.verifiedById,
      verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
      rejectionReason: d.rejectionReason,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private toBankAccountDto(row: {
    id: string;
    bankName: string;
    accountHolder: string;
    ibanLast4: string;
    isDefault: boolean;
    createdAt: Date;
  }): PartnerBankAccountDto {
    return {
      id: row.id,
      bankName: row.bankName,
      accountHolder: row.accountHolder,
      ibanLast4: row.ibanLast4,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toJobHistoryItem(
    job: Prisma.JobGetPayload<{ select: typeof jobHistorySelect }> & {
      assignments: Array<{ estimatedEarningsMinor: bigint }>;
    },
  ): PartnerJobHistoryItemDto {
    const currency = job.currency as Money['currency'];
    const accepted = job.assignments[0];
    return {
      id: job.id,
      number: job.number,
      type: job.type,
      status: job.status,
      categoryId: job.category?.id ?? null,
      categoryName: job.category ? { ar: job.category.nameAr, en: job.category.nameEn } : null,
      currency: job.currency,
      estimatedTotal:
        job.estimatedTotalMinor === null
          ? null
          : { amount: Number(job.estimatedTotalMinor), currency },
      finalTotal:
        job.finalTotalMinor === null ? null : { amount: Number(job.finalTotalMinor), currency },
      estimatedEarnings: accepted
        ? { amount: Number(accepted.estimatedEarningsMinor), currency }
        : null,
      distanceMeters: job.actualDistanceMeters ?? job.distanceMeters,
      durationSeconds: job.actualDurationSeconds ?? job.durationSeconds,
      stops: job.stops.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        kind: s.kind,
        formatted: s.formatted,
        city: s.city,
      })),
      cancellationReason: job.cancellationReasonCode,
      cancelledBy: job.cancelledBy,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      cancelledAt: job.cancelledAt ? job.cancelledAt.toISOString() : null,
    };
  }
}
