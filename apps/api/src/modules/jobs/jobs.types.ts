import type { Prisma } from '@prisma/client';

/** Standard include used by JobsService reads; other modules receive this shape. */
export const jobInclude = {
  stops: { orderBy: { sequence: 'asc' as const } },
  media: { include: { media: true } },
  serviceOptions: { include: { option: true } },
  delivery: { include: { packageCategory: true, podPhoto: true, podSignature: true } },
  category: { select: { id: true, nameAr: true, nameEn: true, slug: true, pricingMethod: true, workflowConfig: true, serviceTypeId: true, requiredPartnerRole: true } },
  subcategory: { select: { id: true, nameAr: true, nameEn: true } },
  vehicleType: { select: { id: true, code: true, nameAr: true, nameEn: true, seats: true } },
  vehicle: { select: { id: true, brand: true, model: true, color: true, plate: true, vehicleType: { select: { nameAr: true, nameEn: true } } } },
  zone: { select: { id: true, code: true, currency: true, timezone: true, nameAr: true, nameEn: true } },
  customer: { include: { user: { select: { id: true, fullName: true, phone: true, profileImage: true } } } },
  partner: { include: { user: { select: { id: true, fullName: true, phone: true, profileImage: true } }, availability: true } },
  promoCode: { select: { code: true } },
  quotes: { orderBy: { revision: 'desc' as const }, take: 1, include: { items: true } },
} satisfies Prisma.JobInclude;

export type JobWithRelations = Prisma.JobGetPayload<{ include: typeof jobInclude }>;
