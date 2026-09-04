import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { FEATURE_FLAGS, type JobDto, JobStatus } from '@tamam/shared-types';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { randomToken, sha256 } from '../../common/utils/crypto.util';
import { addMinutes } from '../../common/utils/time';
import { AppConfigService } from '../../config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';

import { JobPolicy } from './domain/job-policy';
import { JobMapper } from './job.mapper';
import { JobsService } from './jobs.service';

/** Share-trip links and SOS (spec §66–§67). */
@Injectable()
export class JobSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly sysConfig: SystemConfigService,
    private readonly jobs: JobsService,
    private readonly mapper: JobMapper,
    private readonly events: EventEmitter2,
  ) {}

  async createShareLink(
    jobId: string,
    user: RequestUser,
    expiresInMinutes: number,
  ): Promise<{ url: string; expiresAt: string }> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isCustomer(user, job) && !JobPolicy.isAssignedPartner(user, job))
      throw AppException.forbidden();
    await this.sysConfig.assertEnabled(FEATURE_FLAGS.SHARE_TRIP, {
      userId: user.id,
      zoneId: job.zoneId,
    });
    const token = randomToken(24);
    const expiresAt = addMinutes(new Date(), expiresInMinutes);
    await this.prisma.jobShareLink.create({ data: { jobId, tokenHash: sha256(token), expiresAt } });
    return {
      url: `${this.config.env.SHARE_TRIP_BASE_URL}/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revokeShareLinks(jobId: string, user: RequestUser): Promise<void> {
    await this.jobs.getForUser(jobId, user);
    await this.prisma.jobShareLink.updateMany({
      where: { jobId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Public, token-scoped view: status, stops, partner first name/vehicle/location, ETA — nothing else (spec §66). */
  async publicTrack(
    token: string,
  ): Promise<
    Pick<
      JobDto,
      | 'id'
      | 'number'
      | 'type'
      | 'status'
      | 'stops'
      | 'partner'
      | 'etaToDestinationSeconds'
      | 'etaToPickupSeconds'
      | 'createdAt'
    >
  > {
    const link = await this.prisma.jobShareLink.findUnique({ where: { tokenHash: sha256(token) } });
    if (!link || link.revokedAt || link.expiresAt < new Date())
      throw AppException.notFound('Share link');
    await this.prisma.jobShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 } },
    });
    const job = await this.jobs.getRaw(link.jobId);
    const dto = this.mapper.toDto(job, { kind: 'share-link' });
    const partner = dto.partner
      ? { ...dto.partner, fullName: dto.partner.fullName.split(' ')[0] ?? '', maskedPhone: null }
      : undefined;
    return {
      id: dto.id,
      number: dto.number,
      type: dto.type,
      status: dto.status,
      stops: dto.stops,
      partner,
      etaToDestinationSeconds: dto.etaToDestinationSeconds,
      etaToPickupSeconds: dto.etaToPickupSeconds,
      createdAt: dto.createdAt,
    };
  }

  async sos(
    jobId: string,
    user: RequestUser,
    input: { location: { lat: number; lng: number }; note?: string },
  ): Promise<{ id: string }> {
    const job = await this.jobs.getForUser(jobId, user);
    if (!JobPolicy.isCustomer(user, job) && !JobPolicy.isAssignedPartner(user, job))
      throw AppException.forbidden();
    await this.sysConfig.assertEnabled(FEATURE_FLAGS.SOS, { userId: user.id, zoneId: job.zoneId });
    const alert = await this.prisma.sosAlert.create({
      data: {
        jobId,
        userId: user.id,
        lat: new Prisma.Decimal(input.location.lat),
        lng: new Prisma.Decimal(input.location.lng),
        note: input.note ?? null,
      },
    });
    await this.jobs.addEvent(
      jobId,
      'safety.sos',
      { type: JobPolicy.actorTypeFor(user, job), id: user.id },
      { alertId: alert.id, lat: input.location.lat, lng: input.location.lng },
    );
    this.events.emit('job.sos', {
      jobId,
      alertId: alert.id,
      userId: user.id,
      zoneId: job.zoneId,
      location: input.location,
      status: job.status as JobStatus,
    });
    return { id: alert.id };
  }

  async acknowledgeSos(alertId: string, actor: RequestUser): Promise<void> {
    await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { acknowledgedById: actor.id, acknowledgedAt: new Date() },
    });
  }

  async resolveSos(alertId: string, actor: RequestUser): Promise<void> {
    await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: { resolvedAt: new Date(), acknowledgedById: actor.id, acknowledgedAt: new Date() },
    });
  }

  listOpenSos() {
    return this.prisma.sosAlert.findMany({
      where: { resolvedAt: null },
      include: {
        job: {
          select: {
            number: true,
            type: true,
            status: true,
            zoneId: true,
            customerId: true,
            partnerId: true,
          },
        },
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
