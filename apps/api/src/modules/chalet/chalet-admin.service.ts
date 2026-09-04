import { Injectable } from '@nestjs/common';
import { ChaletApprovalStatus, ChaletStatus, type Page } from '@tamam/shared-types';
import type {
  ChaletApprovalDecisionInput,
  ChaletApprovalQueryInput,
  ChaletSuspensionInput,
} from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { toMoney } from '../../common/utils/money';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface AdminChaletRow {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string;
  ownerId: string;
  ownerName: string | null;
  ownerPhone: string;
  status: ChaletStatus;
  approvalStatus: ChaletApprovalStatus;
  rejectionReason: string | null;
  maximumGuests: number;
  baseHourlyRate: { amount: number; currency: string };
  minimumHourlyRate: { amount: number; currency: string };
  amenityCount: number;
  photoCount: number;
  bookingCount: number;
  createdAt: string;
}

const adminSelect = {
  id: true,
  nameAr: true,
  nameEn: true,
  descriptionAr: true,
  descriptionEn: true,
  city: true,
  addressLine: true,
  lat: true,
  lng: true,
  ownerId: true,
  status: true,
  approvalStatus: true,
  rejectionReason: true,
  maximumGuests: true,
  minimumGuests: true,
  openingTime: true,
  closingTime: true,
  bookingIntervalMinutes: true,
  minimumBookingDurationMinutes: true,
  maximumBookingDurationMinutes: true,
  defaultCleaningDurationMinutes: true,
  baseHourlyRateMinor: true,
  minimumHourlyRateMinor: true,
  currency: true,
  createdAt: true,
  owner: { select: { fullName: true, phone: true } },
  _count: { select: { amenities: true, media: true, bookings: true } },
} as const;

/**
 * Reviewing chalets before they go live.
 *
 * A chalet is somebody's property being advertised on the platform's word, so
 * it is approved by a person rather than by a rule. What this service does is
 * make that decision cheap: everything a reviewer needs on one row, and a
 * rejection that has to say why.
 */
@Injectable()
export class ChaletAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ChaletApprovalQueryInput): Promise<Page<AdminChaletRow>> {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.prisma.chalet.findMany({
      where: {
        ...(query.approvalStatus === undefined ? {} : { approvalStatus: query.approvalStatus }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.q === undefined
          ? {}
          : {
              OR: [
                { nameAr: { contains: query.q, mode: 'insensitive' } },
                { nameEn: { contains: query.q, mode: 'insensitive' } },
                { city: { contains: query.q, mode: 'insensitive' } },
              ],
            }),
        ...cursorWhere(cursor),
      },
      select: adminSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });

    return buildPage(rows, query.limit, (row) => this.toRow(row));
  }

  async detail(chaletId: string) {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: {
        ...adminSelect,
        amenities: { select: { code: true, nameAr: true, nameEn: true } },
      },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);

    return {
      ...this.toRow(chalet),
      descriptionAr: chalet.descriptionAr,
      descriptionEn: chalet.descriptionEn,
      addressLine: chalet.addressLine,
      location: { lat: Number(chalet.lat), lng: Number(chalet.lng) },
      minimumGuests: chalet.minimumGuests,
      scheduling: {
        openingTime: chalet.openingTime,
        closingTime: chalet.closingTime,
        bookingIntervalMinutes: chalet.bookingIntervalMinutes,
        minimumBookingDurationMinutes: chalet.minimumBookingDurationMinutes,
        maximumBookingDurationMinutes: chalet.maximumBookingDurationMinutes,
        defaultCleaningDurationMinutes: chalet.defaultCleaningDurationMinutes,
      },
      amenities: chalet.amenities,
    };
  }

  /**
   * Approve or reject.
   *
   * Approving makes the chalet bookable in the same write, because an approved
   * chalet that stays invisible is a bug the reviewer cannot see. Rejecting
   * keeps the reason on the row, so the owner is told what to fix rather than
   * left to guess — and the previous reason is cleared on approval, or a
   * chalet fixed and approved would still be showing why it was once refused.
   */
  async decide(chaletId: string, input: ChaletApprovalDecisionInput) {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: { id: true, approvalStatus: true, status: true },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);
    if (chalet.approvalStatus === ChaletApprovalStatus.APPROVED && input.approve) {
      throw AppException.conflict('This chalet is already approved');
    }

    return this.prisma.chalet.update({
      where: { id: chaletId },
      data: input.approve
        ? {
            approvalStatus: ChaletApprovalStatus.APPROVED,
            status: ChaletStatus.ACTIVE,
            rejectionReason: null,
          }
        : {
            approvalStatus: ChaletApprovalStatus.REJECTED,
            status: ChaletStatus.INACTIVE,
            rejectionReason: input.reason ?? null,
          },
      select: {
        id: true,
        status: true,
        approvalStatus: true,
        rejectionReason: true,
      },
    });
  }

  /**
   * Suspend or restore a chalet that is already live.
   *
   * Different from rejecting a new one: this is about a chalet that was fine
   * and is not any more. Existing bookings are deliberately left alone —
   * cancelling somebody's weekend because their host is under review is a
   * separate decision, and one a person should make explicitly.
   */
  async setSuspended(chaletId: string, input: ChaletSuspensionInput) {
    const chalet = await this.prisma.chalet.findUnique({
      where: { id: chaletId },
      select: { id: true, approvalStatus: true },
    });
    if (chalet === null) throw AppException.notFound('Chalet', chaletId);

    return this.prisma.chalet.update({
      where: { id: chaletId },
      data: {
        status: input.suspend ? ChaletStatus.SUSPENDED : ChaletStatus.ACTIVE,
        rejectionReason: input.suspend ? input.reason : null,
      },
      select: { id: true, status: true, rejectionReason: true },
    });
  }

  /** How many chalets are waiting, for the console's badge. */
  async pendingCount(): Promise<number> {
    return this.prisma.chalet.count({
      where: {
        approvalStatus: {
          in: [ChaletApprovalStatus.PENDING, ChaletApprovalStatus.UNDER_REVIEW],
        },
      },
    });
  }

  private toRow(row: {
    id: string;
    nameAr: string;
    nameEn: string;
    city: string;
    ownerId: string;
    status: string;
    approvalStatus: string;
    rejectionReason: string | null;
    maximumGuests: number;
    baseHourlyRateMinor: bigint;
    minimumHourlyRateMinor: bigint;
    currency: string;
    createdAt: Date;
    owner: { fullName: string | null; phone: string };
    _count: { amenities: number; media: number; bookings: number };
  }): AdminChaletRow {
    return {
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      city: row.city,
      ownerId: row.ownerId,
      ownerName: row.owner.fullName,
      ownerPhone: row.owner.phone,
      status: row.status as ChaletStatus,
      approvalStatus: row.approvalStatus as ChaletApprovalStatus,
      rejectionReason: row.rejectionReason,
      maximumGuests: row.maximumGuests,
      baseHourlyRate: toMoney(row.baseHourlyRateMinor, row.currency),
      minimumHourlyRate: toMoney(row.minimumHourlyRateMinor, row.currency),
      // A reviewer's first question is whether there is enough to review:
      // a chalet with no photos is not ready whatever else it says.
      amenityCount: row._count.amenities,
      photoCount: row._count.media,
      bookingCount: row._count.bookings,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
