import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AvailabilityStatus,
  DocumentStatus,
  ErrorCode,
  JobType,
  MediaPurpose,
  NotificationEvent,
  type Page,
  type PartnerDocumentDto,
  PartnerRoleType,
  VerificationStatus,
  type VehicleDto,
} from '@tamam/shared-types';
import type { PartnerDocumentUploadInput, PartnerVehicleInput, ReviewDocumentInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { MediaUrlService } from '../media/media-url.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Job types each partner role serves. Used to check a vehicle type fits the partner's roles. */
export const ROLE_JOB_TYPES: Record<PartnerRoleType, readonly JobType[]> = {
  DRIVER: [JobType.RIDE],
  COURIER: [JobType.DELIVERY],
  TECHNICIAN: [JobType.HOME_SERVICE],
  SERVICE_PROVIDER: [JobType.HOME_SERVICE],
};

/** Roles that cannot go online without an APPROVED vehicle selected as the active one. */
export const VEHICLE_REQUIRED_ROLES: readonly PartnerRoleType[] = [PartnerRoleType.DRIVER, PartnerRoleType.COURIER];

/** Job types whose dispatch actually needs a vehicle (the ones that constrain the vehicle type). */
const VEHICLE_BOUND_JOB_TYPES: readonly JobType[] = [JobType.RIDE, JobType.DELIVERY];

/** Uppercase, no spaces/dashes — the value the unique index is built on. */
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s\-_]+/g, '');
}

const vehicleInclude = {
  vehicleType: { include: { iconMedia: true } },
  photos: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.VehicleInclude;

const documentInclude = { media: true } satisfies Prisma.VehicleDocumentInclude;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof vehicleInclude }>;
type VehicleDocumentRow = Prisma.VehicleDocumentGetPayload<{ include: typeof documentInclude }>;

export interface AdminVehicleListFilter {
  partnerId?: string;
  status?: VerificationStatus;
  cursor?: string;
  limit: number;
}

/**
 * Partner fleet (spec §128–§131): vehicles are owned by a partner, verified by staff and
 * only usable for dispatch once APPROVED and selected as the partner's active vehicle.
 */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly mediaUrls: MediaUrlService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------------------------------------- partner */

  async listForPartner(userId: string): Promise<VehicleDto[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: { partnerId: userId },
      include: vehicleInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((v) => this.toDto(v));
  }

  async getForPartner(userId: string, vehicleId: string): Promise<VehicleDto> {
    return this.toDto(await this.requireOwnedVehicle(userId, vehicleId));
  }

  async create(userId: string, input: PartnerVehicleInput): Promise<VehicleDto> {
    const roles = await this.activeRoles(userId);
    const vehicleType = await this.catalog.getVehicleType(input.vehicleTypeId);
    this.assertVehicleTypeFitsRoles(vehicleType.allowedJobTypes, roles);
    const photoMediaIds = [...new Set(input.photoMediaIds)];
    await this.media.assertOwnedReady(userId, photoMediaIds, [MediaPurpose.VEHICLE_PHOTO]);

    const plateNormalized = normalizePlate(input.plate);
    await this.assertPlateFree(plateNormalized, null);

    const row = await this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          partnerId: userId,
          vehicleTypeId: input.vehicleTypeId,
          brand: input.brand,
          model: input.model,
          year: input.year,
          color: input.color,
          plate: input.plate.trim(),
          plateNormalized,
          seats: input.seats,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
      await tx.vehiclePhoto.createMany({ data: photoMediaIds.map((mediaId, index) => ({ vehicleId: vehicle.id, mediaId, sortOrder: index })) });
      return tx.vehicle.findUniqueOrThrow({ where: { id: vehicle.id }, include: vehicleInclude });
    });
    return this.toDto(row);
  }

  /**
   * Editing a vehicle invalidates its verification: staff approved a specific car, so any
   * change puts it back in the review queue and it stops being usable for dispatch.
   */
  async update(userId: string, vehicleId: string, input: PartnerVehicleInput): Promise<VehicleDto> {
    const existing = await this.requireOwnedVehicle(userId, vehicleId);
    const roles = await this.activeRoles(userId);
    const vehicleType = await this.catalog.getVehicleType(input.vehicleTypeId);
    this.assertVehicleTypeFitsRoles(vehicleType.allowedJobTypes, roles);
    const photoMediaIds = [...new Set(input.photoMediaIds)];
    await this.media.assertOwnedReady(userId, photoMediaIds, [MediaPurpose.VEHICLE_PHOTO]);

    const plateNormalized = normalizePlate(input.plate);
    await this.assertPlateFree(plateNormalized, existing.id);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: existing.id },
        data: {
          vehicleTypeId: input.vehicleTypeId,
          brand: input.brand,
          model: input.model,
          year: input.year,
          color: input.color,
          plate: input.plate.trim(),
          plateNormalized,
          seats: input.seats,
          verificationStatus: VerificationStatus.PENDING,
          verifiedById: null,
          verifiedAt: null,
          rejectionReason: null,
        },
      });
      await tx.vehiclePhoto.deleteMany({ where: { vehicleId: existing.id } });
      await tx.vehiclePhoto.createMany({ data: photoMediaIds.map((mediaId, index) => ({ vehicleId: existing.id, mediaId, sortOrder: index })) });
      await this.releaseIfActive(tx, existing.partnerId, existing.id);
      return tx.vehicle.findUniqueOrThrow({ where: { id: existing.id }, include: vehicleInclude });
    });
    return this.toDto(row);
  }

  async activate(userId: string, vehicleId: string): Promise<VehicleDto> {
    const vehicle = await this.requireOwnedVehicle(userId, vehicleId);
    if (vehicle.verificationStatus !== VerificationStatus.APPROVED) {
      throw AppException.badRequest(ErrorCode.PARTNER_NOT_APPROVED, 'Only an approved vehicle can be activated');
    }
    if (!vehicle.isActive) throw AppException.conflict('This vehicle is archived');
    await this.prisma.partnerProfile.update({ where: { userId }, data: { activeVehicleId: vehicle.id } });
    return this.toDto(vehicle);
  }

  async listDocuments(userId: string, vehicleId: string): Promise<PartnerDocumentDto[]> {
    await this.requireOwnedVehicle(userId, vehicleId);
    const rows = await this.prisma.vehicleDocument.findMany({ where: { vehicleId }, include: documentInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return Promise.all(rows.map((r) => this.toDocumentDto(r)));
  }

  /** One live document per (vehicle, type): re-uploading replaces the row and re-opens review. */
  async addDocument(userId: string, vehicleId: string, input: PartnerDocumentUploadInput): Promise<PartnerDocumentDto> {
    await this.requireOwnedVehicle(userId, vehicleId);
    await this.media.assertOwnedReady(userId, [input.mediaId], [MediaPurpose.PARTNER_DOCUMENT]);
    const existing = await this.prisma.vehicleDocument.findFirst({ where: { vehicleId, type: input.type }, orderBy: { createdAt: 'desc' } });
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
    };
    const row = existing
      ? await this.prisma.vehicleDocument.update({ where: { id: existing.id }, data, include: documentInclude })
      : await this.prisma.vehicleDocument.create({ data: { vehicleId, ...data }, include: documentInclude });
    return this.toDocumentDto(row);
  }

  /* --------------------------------------------------------------- admin */

  async adminList(filter: AdminVehicleListFilter): Promise<Page<VehicleDto>> {
    const cursor = decodeCursor(filter.cursor);
    const rows = await this.prisma.vehicle.findMany({
      where: {
        ...cursorWhere(cursor),
        partnerId: filter.partnerId,
        verificationStatus: filter.status,
      },
      include: vehicleInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
    return buildPage(rows, filter.limit, (v) => this.toDto(v));
  }

  async adminGet(vehicleId: string): Promise<VehicleDto> {
    const row = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, include: vehicleInclude });
    if (!row) throw AppException.notFound('Vehicle', vehicleId);
    return this.toDto(row);
  }

  async reviewVehicle(vehicleId: string, input: ReviewDocumentInput, actor: RequestUser, requestId: string | null): Promise<VehicleDto> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw AppException.notFound('Vehicle', vehicleId);
    const approve = input.decision === 'APPROVE';

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          verificationStatus: approve ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          rejectionReason: approve ? null : (input.rejectionReason ?? null),
        },
        include: vehicleInclude,
      });
      if (!approve) await this.releaseIfActive(tx, vehicle.partnerId, vehicleId);
      await this.audit.record(
        {
          actorId: actor.id,
          action: approve ? 'vehicle.approve' : 'vehicle.reject',
          entity: 'vehicle',
          entityId: vehicleId,
          oldValue: { verificationStatus: vehicle.verificationStatus },
          newValue: { verificationStatus: updated.verificationStatus },
          reason: input.rejectionReason ?? null,
          requestId,
        },
        tx,
      );
      return updated;
    });

    await this.notifications.notify({
      userId: vehicle.partnerId,
      event: NotificationEvent.DOCUMENT_REVIEWED,
      vars: { documentType: `${row.brand} ${row.model} (${row.plate})`, decision: approve ? 'APPROVED' : 'REJECTED', reason: input.rejectionReason ?? '' },
      data: { vehicleId },
    });
    return this.toDto(row);
  }

  async reviewVehicleDocument(vehicleId: string, documentId: string, input: ReviewDocumentInput, actor: RequestUser, requestId: string | null): Promise<PartnerDocumentDto> {
    const doc = await this.prisma.vehicleDocument.findFirst({ where: { id: documentId, vehicleId }, include: { vehicle: { select: { partnerId: true } } } });
    if (!doc) throw AppException.notFound('Vehicle document', documentId);
    const approve = input.decision === 'APPROVE';

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.vehicleDocument.update({
        where: { id: documentId },
        data: {
          status: approve ? DocumentStatus.APPROVED : DocumentStatus.REJECTED,
          verifiedById: actor.id,
          verifiedAt: new Date(),
          expiresAt: approve && input.expiresAt ? new Date(input.expiresAt) : doc.expiresAt,
          rejectionReason: approve ? null : (input.rejectionReason ?? null),
        },
        include: documentInclude,
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: approve ? 'vehicle_document.approve' : 'vehicle_document.reject',
          entity: 'vehicle_document',
          entityId: documentId,
          oldValue: { status: doc.status },
          newValue: { status: updated.status, expiresAt: updated.expiresAt },
          reason: input.rejectionReason ?? null,
          requestId,
        },
        tx,
      );
      return updated;
    });

    await this.notifications.notify({
      userId: doc.vehicle.partnerId,
      event: NotificationEvent.DOCUMENT_REVIEWED,
      vars: { documentType: doc.type, decision: approve ? 'APPROVED' : 'REJECTED', reason: input.rejectionReason ?? '' },
      data: { vehicleId, documentId },
    });
    return this.toDocumentDto(row);
  }

  /* ------------------------------------------------------ cross-module API */

  /** True when the partner has an APPROVED, active vehicle selected — used by availability and dispatch. */
  async hasUsableActiveVehicle(partnerId: string): Promise<boolean> {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { activeVehicleId: true } });
    if (!partner?.activeVehicleId) return false;
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: partner.activeVehicleId, partnerId, isActive: true, verificationStatus: VerificationStatus.APPROVED },
      select: { id: true },
    });
    return !!vehicle;
  }

  /* ------------------------------------------------------------- helpers */

  private async requireOwnedVehicle(userId: string, vehicleId: string): Promise<VehicleRow> {
    const row = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, partnerId: userId }, include: vehicleInclude });
    if (!row) throw AppException.notFound('Vehicle', vehicleId);
    return row;
  }

  private async activeRoles(userId: string): Promise<PartnerRoleType[]> {
    const partner = await this.prisma.partnerProfile.findUnique({ where: { userId }, include: { roles: true } });
    if (!partner) throw AppException.notFound('Partner profile', userId);
    return partner.roles.filter((r) => r.isActive).map((r) => r.role);
  }

  private assertVehicleTypeFitsRoles(allowedJobTypes: readonly JobType[], roles: readonly PartnerRoleType[]): void {
    const served = new Set<JobType>();
    for (const role of roles) for (const jobType of ROLE_JOB_TYPES[role]) served.add(jobType);
    const constraining = [...served].filter((t) => VEHICLE_BOUND_JOB_TYPES.includes(t));
    if (!constraining.length) return; // technicians / service providers may register any vehicle type
    if (!constraining.some((t) => allowedJobTypes.includes(t))) {
      throw AppException.validation([{ field: 'vehicleTypeId', message: `this vehicle type does not serve ${constraining.join(', ')}` }]);
    }
  }

  private async assertPlateFree(plateNormalized: string, exceptVehicleId: string | null): Promise<void> {
    const clash = await this.prisma.vehicle.findUnique({ where: { plateNormalized }, select: { id: true } });
    if (clash && clash.id !== exceptVehicleId) throw AppException.conflict(`Plate ${plateNormalized} is already registered`);
  }

  /** A vehicle that is no longer usable must stop being the active one, and the partner goes offline. */
  private async releaseIfActive(tx: Tx, partnerId: string, vehicleId: string): Promise<void> {
    const partner = await tx.partnerProfile.findUnique({ where: { userId: partnerId }, select: { activeVehicleId: true } });
    if (partner?.activeVehicleId !== vehicleId) return;
    await tx.partnerProfile.update({ where: { userId: partnerId }, data: { activeVehicleId: null } });
    await tx.partnerAvailability.updateMany({
      where: { partnerId, status: { in: [AvailabilityStatus.ONLINE, AvailabilityStatus.BUSY] } },
      data: { status: AvailabilityStatus.OFFLINE, onlineSince: null },
    });
  }

  /* ------------------------------------------------------------- mapping */

  toDto(v: VehicleRow): VehicleDto {
    return {
      id: v.id,
      partnerId: v.partnerId,
      vehicleTypeId: v.vehicleTypeId,
      vehicleType: this.catalog.toVehicleTypeDto(v.vehicleType),
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      plate: v.plate,
      seats: v.seats,
      photoUrls: v.photos.map((p) => this.mediaUrls.urlFor(p.media)),
      isActive: v.isActive,
      verificationStatus: v.verificationStatus,
    };
  }

  async toDocumentDto(d: VehicleDocumentRow): Promise<PartnerDocumentDto> {
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
}
