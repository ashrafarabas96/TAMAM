import { AccountStatus, ErrorCode, JobStatus, UserRole } from '@tamam/shared-types';

import type { RequestUser } from '../../common/types/request-user';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { SystemConfigService } from '../config/system-config.service';

import {
  RatingDirection,
  aggregateDelta,
  averageOf,
  editableUntilFrom,
  normaliseTags,
} from './domain/rating-tags';
import { RatingsService } from './ratings.service';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = '22222222-2222-4222-8222-222222222222';
const PARTNER_ID = '33333333-3333-4333-8333-333333333333';
const ZONE_ID = '44444444-4444-4444-8444-444444444444';
const OUTSIDER_ID = '55555555-5555-4555-8555-555555555555';

interface ReviewRowState {
  id: string;
  jobId: string;
  raterId: string;
  rateeId: string;
  direction: RatingDirection;
  rating: number;
  tags: string[];
  comment: string | null;
  editableUntil: Date;
  createdAt: Date;
  rater: { fullName: string | null };
}

function customer(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: CUSTOMER_ID,
    phone: '+970599000001',
    roles: [UserRole.CUSTOMER],
    permissions: [],
    accountStatus: AccountStatus.ACTIVE,
    sessionId: 'sess-1',
    deviceId: 'dev-1',
    language: 'ar',
    customerId: CUSTOMER_ID,
    isSuperAdmin: false,
    ...overrides,
  };
}

function partner(): RequestUser {
  return customer({
    id: PARTNER_ID,
    roles: [UserRole.PARTNER],
    customerId: undefined,
    partnerId: PARTNER_ID,
  });
}

function buildHarness(
  options: {
    jobStatus?: JobStatus;
    existing?: ReviewRowState | null;
    editWindowHours?: number;
  } = {},
) {
  const partnerProfile = { userId: PARTNER_ID, ratingSum: 45, ratingCount: 10 };
  const customerProfile = { userId: CUSTOMER_ID, ratingSum: 8, ratingCount: 2 };
  const reviews: ReviewRowState[] = options.existing ? [options.existing] : [];

  const job = {
    id: JOB_ID,
    customerId: CUSTOMER_ID,
    partnerId: PARTNER_ID,
    status: options.jobStatus ?? JobStatus.COMPLETED,
    zoneId: ZONE_ID,
  };

  const reviewCreate = jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const row: ReviewRowState = {
      id: `rev-${reviews.length + 1}`,
      jobId: String(data.jobId),
      raterId: String(data.raterId),
      rateeId: String(data.rateeId),
      direction: data.direction as RatingDirection,
      rating: Number(data.rating),
      tags: (data.tags as string[]) ?? [],
      comment: (data.comment as string | null) ?? null,
      editableUntil: data.editableUntil as Date,
      createdAt: new Date('2026-04-01T09:00:00.000Z'),
      rater: { fullName: 'Layla Nasser' },
    };
    reviews.push(row);
    return row;
  });

  // Prisma returns a detached row per call; returning the stored object itself would let an
  // update retroactively change what an earlier findUnique appeared to read.
  const reviewUpdate = jest.fn(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const index = reviews.findIndex((r) => r.id === where.id);
      if (index === -1) throw new Error('review not found');
      const updated: ReviewRowState = {
        ...reviews[index]!,
        rating: Number(data.rating),
        tags: data.tags as string[],
        comment: (data.comment as string | null) ?? null,
      };
      reviews[index] = updated;
      return { ...updated };
    },
  );

  const partnerUpdate = jest.fn(
    async ({
      data,
    }: {
      data: { ratingSum: { increment: number }; ratingCount: { increment: number } };
    }) => {
      partnerProfile.ratingSum += data.ratingSum.increment;
      partnerProfile.ratingCount += data.ratingCount.increment;
      return partnerProfile;
    },
  );
  const customerUpdate = jest.fn(
    async ({
      data,
    }: {
      data: { ratingSum: { increment: number }; ratingCount: { increment: number } };
    }) => {
      customerProfile.ratingSum += data.ratingSum.increment;
      customerProfile.ratingCount += data.ratingCount.increment;
      return customerProfile;
    },
  );

  const prisma = {
    job: { findUnique: jest.fn(async () => job) },
    review: {
      findUnique: jest.fn(
        async ({ where }: { where: { jobId_direction: { direction: RatingDirection } } }) => {
          const row = reviews.find((r) => r.direction === where.jobId_direction.direction);
          return row ? { ...row } : null;
        },
      ),
      findMany: jest.fn(async () => reviews),
      create: reviewCreate,
      update: reviewUpdate,
      aggregate: jest.fn(async () => ({ _sum: { rating: 45 }, _count: { _all: 10 } })),
    },
    partnerProfile: { update: partnerUpdate },
    customerProfile: { update: customerUpdate },
    $queryRaw: jest.fn(async () => [{ tag: 'PUNCTUAL', count: 7 }]),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  const getNumber = jest.fn(async () => options.editWindowHours ?? 24);
  const systemConfig = { getNumber } as unknown as SystemConfigService;

  const service = new RatingsService(prisma, systemConfig);
  return {
    service,
    reviews,
    partnerProfile,
    customerProfile,
    mocks: { reviewCreate, reviewUpdate, partnerUpdate, customerUpdate },
  };
}

describe('rating domain rules', () => {
  it('adds a rating on first submission and only shifts the sum on an edit', () => {
    expect(aggregateDelta(null, 4)).toEqual({ sumDelta: 4, countDelta: 1 });
    expect(aggregateDelta(4, 2)).toEqual({ sumDelta: -2, countDelta: 0 });
    expect(aggregateDelta(3, 3)).toEqual({ sumDelta: 0, countDelta: 0 });
  });

  it('returns the neutral rating until a user has been rated', () => {
    expect(averageOf(0, 0)).toBe(5);
    expect(averageOf(45, 10)).toBe(4.5);
    expect(averageOf(10, 3)).toBe(3.33);
  });

  it('rejects tags outside the whitelist for the direction', () => {
    expect(normaliseTags(RatingDirection.CUSTOMER_TO_PARTNER, ['punctual', 'PUNCTUAL'])).toEqual([
      'PUNCTUAL',
    ]);
    expect(() => normaliseTags(RatingDirection.PARTNER_TO_CUSTOMER, ['CLEAN_VEHICLE'])).toThrow();
    expect(() => normaliseTags(RatingDirection.CUSTOMER_TO_PARTNER, ['WRONG_ADDRESS'])).toThrow();
  });

  it('anchors the edit window on the submission time', () => {
    const now = new Date('2026-04-01T00:00:00.000Z');
    expect(editableUntilFrom(now, 24).toISOString()).toBe('2026-04-02T00:00:00.000Z');
  });
});

describe('RatingsService.rate', () => {
  it('refuses to rate a job that is not COMPLETED', async () => {
    const { service } = buildHarness({ jobStatus: JobStatus.IN_PROGRESS });

    await expect(service.rate(customer(), JOB_ID, { rating: 5, tags: [] })).rejects.toMatchObject({
      code: ErrorCode.RATING_NOT_ALLOWED,
    });
  });

  it('refuses a rater who is neither the customer nor the assigned partner', async () => {
    const { service } = buildHarness();
    const outsider = customer({ id: OUTSIDER_ID, customerId: OUTSIDER_ID });

    await expect(service.rate(outsider, JOB_ID, { rating: 5, tags: [] })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('creates a customer→partner review and adds it to the partner aggregate', async () => {
    const { service, partnerProfile } = buildHarness();

    const review = await service.rate(customer(), JOB_ID, {
      rating: 4,
      tags: ['PUNCTUAL', 'POLITE'],
      comment: 'Great trip',
    });

    expect(review).toMatchObject({
      direction: RatingDirection.CUSTOMER_TO_PARTNER,
      rateeId: PARTNER_ID,
      rating: 4,
      tags: ['PUNCTUAL', 'POLITE'],
    });
    expect(partnerProfile).toEqual({ userId: PARTNER_ID, ratingSum: 49, ratingCount: 11 });
    expect(averageOf(partnerProfile.ratingSum, partnerProfile.ratingCount)).toBe(4.45);
  });

  it('creates a partner→customer review against the customer aggregate', async () => {
    const { service, customerProfile } = buildHarness();

    await service.rate(partner(), JOB_ID, { rating: 5, tags: ['ON_TIME'] });

    expect(customerProfile).toEqual({ userId: CUSTOMER_ID, ratingSum: 13, ratingCount: 3 });
  });

  it('edits inside the window: the count is untouched and only the difference moves the sum', async () => {
    const { service, partnerProfile, mocks } = buildHarness({
      existing: {
        id: 'rev-existing',
        jobId: JOB_ID,
        raterId: CUSTOMER_ID,
        rateeId: PARTNER_ID,
        direction: RatingDirection.CUSTOMER_TO_PARTNER,
        rating: 5,
        tags: ['PUNCTUAL'],
        comment: null,
        editableUntil: new Date(Date.now() + 3600 * 1000),
        createdAt: new Date('2026-04-01T09:00:00.000Z'),
        rater: { fullName: 'Layla Nasser' },
      },
    });

    const review = await service.rate(customer(), JOB_ID, { rating: 2, tags: ['LATE'] });

    expect(review.rating).toBe(2);
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
    expect(partnerProfile).toEqual({ userId: PARTNER_ID, ratingSum: 42, ratingCount: 10 });
  });

  it('refuses an edit after ratings.edit_window_h has elapsed and leaves the aggregate alone', async () => {
    const { service, partnerProfile, mocks } = buildHarness({
      existing: {
        id: 'rev-existing',
        jobId: JOB_ID,
        raterId: CUSTOMER_ID,
        rateeId: PARTNER_ID,
        direction: RatingDirection.CUSTOMER_TO_PARTNER,
        rating: 5,
        tags: [],
        comment: null,
        editableUntil: new Date(Date.now() - 60 * 1000),
        createdAt: new Date('2026-03-30T09:00:00.000Z'),
        rater: { fullName: 'Layla Nasser' },
      },
    });

    await expect(service.rate(customer(), JOB_ID, { rating: 1, tags: [] })).rejects.toMatchObject({
      code: ErrorCode.RATING_NOT_ALLOWED,
    });
    expect(mocks.reviewUpdate).not.toHaveBeenCalled();
    expect(partnerProfile).toEqual({ userId: PARTNER_ID, ratingSum: 45, ratingCount: 10 });
  });
});

describe('RatingsService.summary', () => {
  it('computes the average from the reviews table and returns the tag histogram', async () => {
    const { service } = buildHarness();

    const summary = await service.summary(PARTNER_ID);

    expect(summary).toEqual({
      userId: PARTNER_ID,
      average: 4.5,
      count: 10,
      tagCounts: { PUNCTUAL: 7 },
    });
  });
});

describe('RatingsService.getForJob', () => {
  it('never exposes the rater id of a received review', async () => {
    const { service } = buildHarness({
      existing: {
        id: 'rev-existing',
        jobId: JOB_ID,
        raterId: PARTNER_ID,
        rateeId: CUSTOMER_ID,
        direction: RatingDirection.PARTNER_TO_CUSTOMER,
        rating: 5,
        tags: [],
        comment: null,
        editableUntil: new Date(Date.now() + 3600 * 1000),
        createdAt: new Date('2026-04-01T09:00:00.000Z'),
        rater: { fullName: 'Sami Haddad' },
      },
    });

    const result = await service.getForJob(customer(), JOB_ID);

    expect(result.given).toBeNull();
    expect(result.received).toMatchObject({ raterName: 'Sami Haddad', rateeId: CUSTOMER_ID });
    expect(result.received).not.toHaveProperty('raterId');
  });
});
