import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, ErrorCode, JobStatus, type Page, type ReviewDto } from '@tamam/shared-types';
import type { RateJobInput } from '@tamam/validation';

import { AppException } from '../../common/errors/app.exception';
import type { RequestUser } from '../../common/types/request-user';
import { buildPage, cursorWhere, decodeCursor } from '../../common/utils/cursor';
import { PrismaService, type Tx } from '../../infrastructure/prisma/prisma.service';
import { SystemConfigService } from '../config/system-config.service';
import { type JobLike, JobPolicy } from '../jobs/domain/job-policy';

import {
  type RatingAggregateDelta,
  RatingDirection,
  aggregateDelta,
  assertEditable,
  averageOf,
  editableUntilFrom,
  normaliseTags,
} from './domain/rating-tags';

/* ------------------------------------------------------------- contracts */

/**
 * A review as seen by the person who was rated: the rater's display name is kept (so the ratee
 * knows which job it refers to) but their user id is never exposed.
 */
export interface ReceivedReviewDto extends Omit<ReviewDto, 'raterId'> {
  raterName: string | null;
}

export interface JobRatingsDto {
  given: ReviewDto | null;
  received: ReceivedReviewDto | null;
}

export interface RatingSummaryDto {
  userId: string;
  average: number;
  count: number;
  tagCounts: Record<string, number>;
}

const reviewInclude = { rater: { select: { fullName: true } } } satisfies Prisma.ReviewInclude;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

interface RatingTarget {
  direction: RatingDirection;
  rateeId: string;
}

/**
 * Two-way ratings (spec §59). One review per direction per completed job, editable only inside
 * `ratings.edit_window_h`, with the profile aggregates (`ratingSum` / `ratingCount`) moved in the
 * same transaction as the review so the cached average can never drift from the reviews table.
 */
@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /* ------------------------------------------------------------------ write */

  async rate(user: RequestUser, jobId: string, input: RateJobInput): Promise<ReviewDto> {
    const job = await this.loadJob(jobId);
    if (job.status !== JobStatus.COMPLETED) {
      throw AppException.badRequest(ErrorCode.RATING_NOT_ALLOWED, 'Only completed jobs can be rated', { status: job.status });
    }

    const target = this.targetFor(user, job);
    const tags = normaliseTags(target.direction, input.tags);
    const windowHours = await this.systemConfig.getNumber(CONFIG_KEYS.RATING_EDIT_WINDOW_H);
    const comment = input.comment ?? null;

    const review = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const existing = await tx.review.findUnique({ where: { jobId_direction: { jobId, direction: target.direction } } });

      if (existing) {
        if (existing.raterId !== user.id) throw AppException.forbidden('This rating belongs to someone else');
        assertEditable(existing.editableUntil, now);
        // Read the score being replaced before the row is written, not after.
        const previousRating = existing.rating;
        const updated = await tx.review.update({
          where: { id: existing.id },
          data: { rating: input.rating, tags, comment },
          include: reviewInclude,
        });
        await this.moveAggregate(tx, target, aggregateDelta(previousRating, input.rating));
        return updated;
      }

      const created = await this.createReview(tx, {
        jobId,
        raterId: user.id,
        rateeId: target.rateeId,
        direction: target.direction,
        rating: input.rating,
        tags,
        comment,
        editableUntil: editableUntilFrom(now, windowHours),
      });
      await this.moveAggregate(tx, target, aggregateDelta(null, input.rating));
      return created;
    });

    return this.toDto(review);
  }

  private async createReview(tx: Tx, data: Prisma.ReviewUncheckedCreateInput): Promise<ReviewRow> {
    try {
      return await tx.review.create({ data, include: reviewInclude });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict('This job was already rated in this direction', ErrorCode.RATING_NOT_ALLOWED);
      }
      throw err;
    }
  }

  /** Moves the cached aggregate on the profile of whoever was rated. */
  private async moveAggregate(tx: Tx, target: RatingTarget, delta: RatingAggregateDelta): Promise<void> {
    if (delta.sumDelta === 0 && delta.countDelta === 0) return;
    const data = { ratingSum: { increment: delta.sumDelta }, ratingCount: { increment: delta.countDelta } };
    if (target.direction === RatingDirection.CUSTOMER_TO_PARTNER) {
      await tx.partnerProfile.update({ where: { userId: target.rateeId }, data });
      return;
    }
    await tx.customerProfile.update({ where: { userId: target.rateeId }, data });
  }

  /* ------------------------------------------------------------------- read */

  /** What this viewer gave and what they received on one job. */
  async getForJob(user: RequestUser, jobId: string): Promise<JobRatingsDto> {
    const job = await this.loadJob(jobId);
    if (!JobPolicy.canView(user, job)) throw AppException.notFound('Job', jobId); // 404, not 403: don't leak existence (spec §88)

    // Staff see the job from the customer's side; full rater identities live on the admin route.
    const givenDirection = JobPolicy.isAssignedPartner(user, job) && !JobPolicy.isCustomer(user, job)
      ? RatingDirection.PARTNER_TO_CUSTOMER
      : RatingDirection.CUSTOMER_TO_PARTNER;
    const receivedDirection =
      givenDirection === RatingDirection.CUSTOMER_TO_PARTNER ? RatingDirection.PARTNER_TO_CUSTOMER : RatingDirection.CUSTOMER_TO_PARTNER;

    const [given, received] = await Promise.all([
      this.prisma.review.findUnique({ where: { jobId_direction: { jobId, direction: givenDirection } }, include: reviewInclude }),
      this.prisma.review.findUnique({ where: { jobId_direction: { jobId, direction: receivedDirection } }, include: reviewInclude }),
    ]);

    return {
      given: given ? this.toDto(given) : null,
      received: received ? this.toReceivedDto(received) : null,
    };
  }

  /** Reviews a user has received — the partner's own feed and the admin profile tab. */
  async listForUser(userId: string, cursorRaw: string | undefined, limit: number): Promise<Page<ReceivedReviewDto>> {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.review.findMany({
      where: { rateeId: userId, ...cursorWhere(cursor) },
      include: reviewInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    return buildPage(rows, limit, (row) => this.toReceivedDto(row));
  }

  /** Average, count and tag histogram computed from the reviews table (the source of truth). */
  async summary(userId: string): Promise<RatingSummaryDto> {
    const [aggregate, tagRows] = await Promise.all([
      this.prisma.review.aggregate({ _sum: { rating: true }, _count: { _all: true }, where: { rateeId: userId } }),
      this.prisma.$queryRaw<Array<{ tag: string; count: number }>>`
        SELECT t.tag AS tag, COUNT(*)::int AS count
        FROM reviews r, unnest(r.tags) AS t(tag)
        WHERE r.ratee_id = ${userId}::uuid
        GROUP BY t.tag
        ORDER BY count DESC, t.tag ASC
      `,
    ]);

    const count = aggregate._count._all;
    const tagCounts: Record<string, number> = {};
    for (const row of tagRows) tagCounts[row.tag] = Number(row.count);

    return { userId, average: averageOf(aggregate._sum.rating ?? 0, count), count, tagCounts };
  }

  /* ---------------------------------------------------------------- helpers */

  private async loadJob(jobId: string): Promise<JobLike> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, partnerId: true, status: true, zoneId: true },
    });
    if (!job) throw AppException.notFound('Job', jobId);
    return job;
  }

  /** Which review the caller is allowed to write, and about whom. */
  private targetFor(user: RequestUser, job: JobLike): RatingTarget {
    if (JobPolicy.isCustomer(user, job)) {
      if (!job.partnerId) throw AppException.badRequest(ErrorCode.RATING_NOT_ALLOWED, 'This job was never assigned to a partner');
      return { direction: RatingDirection.CUSTOMER_TO_PARTNER, rateeId: job.partnerId };
    }
    if (JobPolicy.isAssignedPartner(user, job)) {
      return { direction: RatingDirection.PARTNER_TO_CUSTOMER, rateeId: job.customerId };
    }
    throw AppException.forbidden('Only the customer and the assigned partner can rate this job');
  }

  private toDto(review: ReviewRow): ReviewDto {
    return {
      id: review.id,
      jobId: review.jobId,
      raterId: review.raterId,
      rateeId: review.rateeId,
      direction: review.direction,
      rating: review.rating,
      tags: review.tags,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }

  private toReceivedDto(review: ReviewRow): ReceivedReviewDto {
    return {
      id: review.id,
      jobId: review.jobId,
      rateeId: review.rateeId,
      direction: review.direction,
      rating: review.rating,
      tags: review.tags,
      comment: review.comment,
      raterName: review.rater.fullName,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
