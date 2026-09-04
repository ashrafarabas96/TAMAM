import { randomUUID } from 'node:crypto';

import type { TestApp } from './app';

/**
 * Extra identities some suites need beyond the development seed (a second driver for the
 * dispatch race, a second customer for the ownership checks). They are written straight through
 * Prisma — the onboarding flow itself is covered by its own specs, and these are fixtures.
 */

export interface DriverFixture {
  userId: string;
  phone: string;
  vehicleId: string;
}

export async function createDriverFixture(
  api: TestApp,
  options: {
    phone: string;
    fullName: string;
    plate: string;
    zoneCode?: string;
    vehicleTypeCode?: string;
  },
): Promise<DriverFixture> {
  const zone = await api.prisma.serviceZone.findUniqueOrThrow({
    where: { code: options.zoneCode ?? 'RAMALLAH' },
  });
  const vehicleType = await api.prisma.vehicleType.findUniqueOrThrow({
    where: { code: options.vehicleTypeCode ?? 'ECONOMY' },
  });

  const user = await api.prisma.user.upsert({
    where: { phone: options.phone },
    update: { fullName: options.fullName, accountStatus: 'ACTIVE', deletedAt: null },
    create: {
      phone: options.phone,
      fullName: options.fullName,
      language: 'ar',
      phoneVerifiedAt: new Date(),
      notificationPreference: { create: {} },
    },
  });
  await api.prisma.userRoleAssignment.upsert({
    where: { userId_role: { userId: user.id, role: 'PARTNER' } },
    update: {},
    create: { userId: user.id, role: 'PARTNER' },
  });
  await api.prisma.partnerProfile.upsert({
    where: { userId: user.id },
    update: { verificationStatus: 'APPROVED', suspendedUntil: null },
    create: {
      userId: user.id,
      verificationStatus: 'APPROVED',
      onboardingStep: 6,
      acceptedTermsVersion: '1.0',
      city: zone.city,
    },
  });
  await api.prisma.partnerRole.upsert({
    where: { partnerId_role: { partnerId: user.id, role: 'DRIVER' } },
    update: { isActive: true },
    create: { partnerId: user.id, role: 'DRIVER', isActive: true },
  });
  await api.prisma.partnerZone.upsert({
    where: { partnerId_zoneId: { partnerId: user.id, zoneId: zone.id } },
    update: {},
    create: { partnerId: user.id, zoneId: zone.id },
  });

  const plateNormalized = options.plate.replace(/[\s-]/g, '').toUpperCase();
  const vehicle = await api.prisma.vehicle.upsert({
    where: { plateNormalized },
    update: { partnerId: user.id, isActive: true, verificationStatus: 'APPROVED' },
    create: {
      plateNormalized,
      plate: options.plate,
      partnerId: user.id,
      vehicleTypeId: vehicleType.id,
      brand: 'Skoda',
      model: 'Octavia',
      year: 2020,
      color: 'رمادي',
      seats: vehicleType.seats,
      isActive: true,
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
    },
  });
  await api.prisma.partnerProfile.update({
    where: { userId: user.id },
    data: { activeVehicleId: vehicle.id },
  });
  await api.prisma.partnerAvailability.upsert({
    where: { partnerId: user.id },
    update: { status: 'OFFLINE', currentJobId: null, onlineSince: null },
    create: { partnerId: user.id, status: 'OFFLINE', activeRoles: ['DRIVER'] },
  });

  return { userId: user.id, phone: options.phone, vehicleId: vehicle.id };
}

export async function createCustomerFixture(
  api: TestApp,
  options: { phone: string; fullName: string },
): Promise<{ userId: string; phone: string }> {
  const user = await api.prisma.user.upsert({
    where: { phone: options.phone },
    update: { fullName: options.fullName, accountStatus: 'ACTIVE', deletedAt: null },
    create: {
      phone: options.phone,
      fullName: options.fullName,
      language: 'ar',
      phoneVerifiedAt: new Date(),
      notificationPreference: { create: {} },
    },
  });
  await api.prisma.userRoleAssignment.upsert({
    where: { userId_role: { userId: user.id, role: 'CUSTOMER' } },
    update: {},
    create: { userId: user.id, role: 'CUSTOMER' },
  });
  const existing = await api.prisma.customerProfile.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await api.prisma.customerProfile.create({
      data: {
        userId: user.id,
        referralCode: randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
      },
    });
  }
  return { userId: user.id, phone: options.phone };
}
