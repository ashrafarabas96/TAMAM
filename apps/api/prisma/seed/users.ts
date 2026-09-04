import { Prisma } from '@prisma/client';
import {
  AvailabilityStatus,
  DocumentStatus,
  DocumentType,
  MediaKind,
  MediaPurpose,
  MediaStatus,
  PartnerRoleType,
  UserRole,
  VerificationStatus,
} from '@tamam/shared-types';

import { encrypt, randomReferralCode } from '../../src/common/utils/crypto.util';
import { optionalEnv } from '../../src/config/env.schema';
import { AuthService } from '../../src/modules/auth/auth.service';
import type { CatalogSeedResult } from './catalog';
import type { SeedContext } from './context';
import type { ZoneSeedResult } from './zones';

export interface UserSeedResult {
  superAdminId: string;
  customerId: string;
  partnerIds: Map<string, string>;
  /** Shared placeholder MediaAsset used by every seeded partner document. */
  documentMediaId: string;
}

const DEFAULT_ADMIN_PASSWORD = 'TamamAdmin#2026';

interface StaffSeed {
  email: string;
  phone: string;
  fullName: string;
  roles: UserRole[];
}

const STAFF: StaffSeed[] = [
  {
    email: 'admin@tamam.app',
    phone: '+970599000010',
    fullName: 'مدير النظام',
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    email: 'dispatcher@tamam.app',
    phone: '+970599000011',
    fullName: 'منسق العمليات',
    roles: [UserRole.DISPATCHER],
  },
  {
    email: 'support@tamam.app',
    phone: '+970599000012',
    fullName: 'موظف الدعم',
    roles: [UserRole.SUPPORT],
  },
];

interface PartnerSeed {
  key: string;
  phone: string;
  fullName: string;
  city: string;
  nationalId: string;
  roles: PartnerRoleType[];
  categorySlugs: string[];
  documents: DocumentType[];
  vehicle: {
    typeCode: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    plate: string;
    seats: number;
  } | null;
  /** Offset from the Ramallah centre, in degrees, so the demo fleet is spread over the zone. */
  offset: { lat: number; lng: number };
}

const PARTNERS: PartnerSeed[] = [
  {
    key: 'driver',
    phone: '+970599000002',
    fullName: 'محمد خليل',
    city: 'Ramallah',
    nationalId: '850123456',
    roles: [PartnerRoleType.DRIVER],
    categorySlugs: [],
    documents: [DocumentType.ID, DocumentType.DRIVING_LICENSE, DocumentType.VEHICLE_LICENSE],
    vehicle: {
      typeCode: 'ECONOMY',
      brand: 'Hyundai',
      model: 'Accent',
      year: 2019,
      color: 'أبيض',
      plate: '1234567',
      seats: 4,
    },
    offset: { lat: 0.004, lng: 0.005 },
  },
  {
    key: 'courier',
    phone: '+970599000003',
    fullName: 'أحمد سالم',
    city: 'Ramallah',
    nationalId: '900987654',
    roles: [PartnerRoleType.COURIER],
    categorySlugs: [],
    documents: [DocumentType.ID, DocumentType.DRIVING_LICENSE],
    vehicle: {
      typeCode: 'MOTORBIKE',
      brand: 'Honda',
      model: 'CB125',
      year: 2021,
      color: 'أحمر',
      plate: '7654321',
      seats: 1,
    },
    offset: { lat: -0.006, lng: 0.003 },
  },
  {
    key: 'technician',
    phone: '+970599000004',
    fullName: 'خالد نصار',
    city: 'Ramallah',
    nationalId: '870456123',
    roles: [PartnerRoleType.TECHNICIAN],
    categorySlugs: ['plumbing'],
    documents: [DocumentType.ID, DocumentType.PROFESSIONAL_CERTIFICATE],
    vehicle: null,
    offset: { lat: 0.002, lng: -0.007 },
  },
];

const TWO_YEARS_MS = 2 * 365 * 86_400_000;

export async function seedUsers(
  ctx: SeedContext,
  catalog: CatalogSeedResult,
  zones: ZoneSeedResult,
): Promise<UserSeedResult> {
  const { prisma, config, summary } = ctx;
  const encryptionKey = config.encryptionKey;
  const ramallahId = zones.zoneIds.get('RAMALLAH');
  const ramallah = zones.centers.get('RAMALLAH');
  if (!ramallahId || !ramallah) throw new Error('Ramallah zone is missing — seed zones first');

  /* --------------------------------------------------- placeholder media */
  const documentMedia = await prisma.mediaAsset.upsert({
    where: { objectKey: 'seed/documents/placeholder.png' },
    update: { status: MediaStatus.READY },
    create: {
      kind: MediaKind.IMAGE,
      purpose: MediaPurpose.PARTNER_DOCUMENT,
      status: MediaStatus.READY,
      bucket: config.env.S3_BUCKET_PRIVATE,
      objectKey: 'seed/documents/placeholder.png',
      mimeType: 'image/png',
      sizeBytes: 0n,
      width: 800,
      height: 1000,
      originalFilename: 'placeholder.png',
      exifStripped: true,
      scanStatus: 'CLEAN',
      isPublic: false,
    },
  });

  /* ---------------------------------------------------------- staff users */
  const rawPassword = optionalEnv(process.env.SEED_ADMIN_PASSWORD) ?? DEFAULT_ADMIN_PASSWORD;
  if (rawPassword.length < 12)
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
  const passwordHash = await AuthService.hashPassword(rawPassword);
  const adminRoles = await prisma.adminRole.findMany({ select: { id: true, name: true } });
  const adminRoleIdByName = new Map(adminRoles.map((r) => [r.name, r.id]));

  let superAdminId = '';
  for (const staff of STAFF) {
    const user = await prisma.user.upsert({
      where: { phone: staff.phone },
      update: { email: staff.email, fullName: staff.fullName },
      create: {
        phone: staff.phone,
        email: staff.email,
        fullName: staff.fullName,
        language: 'ar',
        notificationPreference: { create: {} },
      },
    });
    await prisma.adminCredential.upsert({
      where: { userId: user.id },
      update: {
        email: staff.email,
        passwordHash,
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
      create: { userId: user.id, email: staff.email, passwordHash, mustChangePassword: true },
    });
    for (const role of staff.roles) {
      await prisma.userRoleAssignment.upsert({
        where: { userId_role: { userId: user.id, role } },
        update: { adminRoleId: adminRoleIdByName.get(role) ?? null },
        create: { userId: user.id, role, adminRoleId: adminRoleIdByName.get(role) ?? null },
      });
    }
    if (staff.roles.includes(UserRole.SUPER_ADMIN)) superAdminId = user.id;
  }
  summary.set('staff users', STAFF.length);
  summary.note(
    `admin login: admin@tamam.app / ${optionalEnv(process.env.SEED_ADMIN_PASSWORD) ? '(SEED_ADMIN_PASSWORD)' : DEFAULT_ADMIN_PASSWORD} — must be changed on first login`,
  );

  /* ------------------------------------------------------- demo customer */
  const customerPhone = '+970599000001';
  const customerUser = await prisma.user.upsert({
    where: { phone: customerPhone },
    update: { fullName: 'سارة أحمد' },
    create: {
      phone: customerPhone,
      fullName: 'سارة أحمد',
      language: 'ar',
      phoneVerifiedAt: new Date(),
      notificationPreference: { create: {} },
    },
  });
  await prisma.userRoleAssignment.upsert({
    where: { userId_role: { userId: customerUser.id, role: UserRole.CUSTOMER } },
    update: {},
    create: { userId: customerUser.id, role: UserRole.CUSTOMER },
  });
  const existingCustomer = await prisma.customerProfile.findUnique({
    where: { userId: customerUser.id },
  });
  if (!existingCustomer) {
    await prisma.customerProfile.create({
      data: { userId: customerUser.id, referralCode: randomReferralCode(8) },
    });
  }
  await prisma.savedPlace.deleteMany({ where: { customerId: customerUser.id } });
  await prisma.savedPlace.create({
    data: {
      customerId: customerUser.id,
      kind: 'HOME',
      label: 'البيت',
      formatted: 'رام الله، شارع الإرسال',
      city: 'Ramallah',
      lat: new Prisma.Decimal(ramallah.lat + 0.003),
      lng: new Prisma.Decimal(ramallah.lng - 0.002),
    },
  });
  summary.set('demo customers', 1);

  /* -------------------------------------------------------- demo partners */
  const partnerIds = new Map<string, string>();
  for (const seed of PARTNERS) {
    const user = await prisma.user.upsert({
      where: { phone: seed.phone },
      update: { fullName: seed.fullName },
      create: {
        phone: seed.phone,
        fullName: seed.fullName,
        language: 'ar',
        phoneVerifiedAt: new Date(),
        notificationPreference: { create: {} },
      },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role: UserRole.PARTNER } },
      update: {},
      create: { userId: user.id, role: UserRole.PARTNER },
    });

    const profileData = {
      verificationStatus: VerificationStatus.APPROVED,
      reviewedAt: new Date(),
      reviewNote: 'Seeded development partner',
      onboardingStep: 6,
      acceptedTermsVersion: '1.0',
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      nationalIdEnc: encrypt(seed.nationalId, encryptionKey),
      city: seed.city,
      yearsOfExperience: 5,
    };
    await prisma.partnerProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData },
    });
    partnerIds.set(seed.key, user.id);

    for (const role of seed.roles) {
      await prisma.partnerRole.upsert({
        where: { partnerId_role: { partnerId: user.id, role } },
        update: { isActive: true },
        create: { partnerId: user.id, role, isActive: true },
      });
    }

    for (const slug of seed.categorySlugs) {
      const categoryId = catalog.categoryIds.get(slug);
      if (!categoryId) throw new Error(`category ${slug} is missing — seed the catalogue first`);
      await prisma.partnerCategory.upsert({
        where: { partnerId_categoryId: { partnerId: user.id, categoryId } },
        update: {},
        create: { partnerId: user.id, categoryId },
      });
    }

    await prisma.partnerZone.upsert({
      where: { partnerId_zoneId: { partnerId: user.id, zoneId: ramallahId } },
      update: {},
      create: { partnerId: user.id, zoneId: ramallahId },
    });

    const expiresAt = new Date(Date.now() + TWO_YEARS_MS);
    for (const type of seed.documents) {
      // partner_documents has no natural unique key — one seeded document per (partner, type).
      const existing = await prisma.partnerDocument.findFirst({
        where: { partnerId: user.id, type },
      });
      const docData = {
        status: DocumentStatus.APPROVED,
        verifiedAt: new Date(),
        expiresAt,
        mediaId: documentMedia.id,
        expiryNotifiedAt: null,
      };
      if (existing)
        await prisma.partnerDocument.update({ where: { id: existing.id }, data: docData });
      else await prisma.partnerDocument.create({ data: { partnerId: user.id, type, ...docData } });
    }

    let activeVehicleId: string | null = null;
    if (seed.vehicle) {
      const vehicleTypeId = catalog.vehicleTypeIds.get(seed.vehicle.typeCode);
      if (!vehicleTypeId)
        throw new Error(
          `vehicle type ${seed.vehicle.typeCode} is missing — seed the catalogue first`,
        );
      const plateNormalized = seed.vehicle.plate.replace(/[\s-]/g, '').toUpperCase();
      const vehicleData = {
        partnerId: user.id,
        vehicleTypeId,
        brand: seed.vehicle.brand,
        model: seed.vehicle.model,
        year: seed.vehicle.year,
        color: seed.vehicle.color,
        plate: seed.vehicle.plate,
        seats: seed.vehicle.seats,
        isActive: true,
        verificationStatus: VerificationStatus.APPROVED,
        verifiedAt: new Date(),
      };
      const vehicle = await prisma.vehicle.upsert({
        where: { plateNormalized },
        update: vehicleData,
        create: { plateNormalized, ...vehicleData },
      });
      activeVehicleId = vehicle.id;
    }
    if (activeVehicleId)
      await prisma.partnerProfile.update({ where: { userId: user.id }, data: { activeVehicleId } });

    const availabilityData = {
      status: AvailabilityStatus.OFFLINE,
      activeRoles: seed.roles,
      lat: new Prisma.Decimal(ramallah.lat + seed.offset.lat),
      lng: new Prisma.Decimal(ramallah.lng + seed.offset.lng),
      lastLocationAt: new Date(),
      lastHeartbeatAt: null,
      currentJobId: null,
      onlineSince: null,
    };
    await prisma.partnerAvailability.upsert({
      where: { partnerId: user.id },
      update: availabilityData,
      create: { partnerId: user.id, ...availabilityData },
    });
  }
  summary.set('demo partners', PARTNERS.length);
  summary.note(
    `demo phones: customer ${customerPhone}, partners ${PARTNERS.map((p) => p.phone).join(', ')} (OTP via console SMS provider)`,
  );

  return {
    superAdminId,
    customerId: customerUser.id,
    partnerIds,
    documentMediaId: documentMedia.id,
  };
}
