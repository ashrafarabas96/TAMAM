import { Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@tamam/shared-types';
import {
  type AdminUpdatePartnerInput,
  type HeartbeatInput,
  type PartnerDecisionInput,
  type PartnerDocumentUploadInput,
  type PartnerOnboardingPersonalInput,
  type PartnerOnboardingRolesInput,
  type PartnerOnboardingSkillsInput,
  type PartnerVehicleInput,
  type PartnerZonesInput,
  type ReviewDocumentInput,
  type SetAvailabilityInput,
  adminUpdatePartnerSchema,
  heartbeatSchema,
  jobListFilterSchema,
  pageRequestSchema,
  partnerDecisionSchema,
  partnerDocumentUploadSchema,
  partnerListFilterSchema,
  partnerOnboardingPersonalSchema,
  partnerOnboardingRolesSchema,
  partnerOnboardingSkillsSchema,
  partnerSubmitForReviewSchema,
  partnerVehicleSchema,
  partnerZonesSchema,
  reviewDocumentSchema,
  setAvailabilitySchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  Audited,
  CurrentUser,
  RateLimit,
  RequestId,
  RequireAnyPermission,
  RequirePermission,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { PartnerAvailabilityService } from './partner-availability.service';
import { PartnersService } from './partners.service';

const partnerJobsQuerySchema = jobListFilterSchema.merge(pageRequestSchema);
type PartnerJobsQuery = z.infer<typeof partnerJobsQuerySchema>;

const adminPartnerListSchema = partnerListFilterSchema.merge(pageRequestSchema);
type AdminPartnerListQuery = z.infer<typeof adminPartnerListSchema>;

/** Bank details are not part of @tamam/validation (they never leave this module) — validated here. */
const addBankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(80),
  accountHolder: z.string().trim().min(2).max(80),
  iban: z
    .string()
    .trim()
    .min(15)
    .max(42)
    .regex(/^[A-Za-z]{2}[0-9A-Za-z\s-]+$/, 'IBAN must start with a two-letter country code'),
  isDefault: z.boolean().default(true),
});
type AddBankAccountBody = z.infer<typeof addBankAccountSchema>;

@ApiTags('partners')
@ApiBearerAuth()
@Controller()
export class PartnersController {
  constructor(
    private readonly partners: PartnersService,
    private readonly availability: PartnerAvailabilityService,
  ) {}

  /* ---------------------------------------------------------- onboarding */

  @Post('partners/onboarding/personal')
  @RequireRole('PARTNER')
  personal(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerOnboardingPersonalSchema) input: PartnerOnboardingPersonalInput,
  ) {
    return this.partners.savePersonal(user.id, input);
  }

  @Post('partners/onboarding/roles')
  @RequireRole('PARTNER')
  roles(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerOnboardingRolesSchema) input: PartnerOnboardingRolesInput,
  ) {
    return this.partners.saveRoles(user.id, input);
  }

  @Post('partners/onboarding/skills')
  @RequireRole('PARTNER')
  skills(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerOnboardingSkillsSchema) input: PartnerOnboardingSkillsInput,
  ) {
    return this.partners.saveSkills(user.id, input);
  }

  @Post('partners/onboarding/documents')
  @RequireRole('PARTNER')
  onboardingDocument(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerDocumentUploadSchema) input: PartnerDocumentUploadInput,
  ) {
    return this.partners.addDocument(user.id, input);
  }

  @Post('partners/onboarding/vehicle')
  @RequireRole('PARTNER')
  onboardingVehicle(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerVehicleSchema) input: PartnerVehicleInput,
  ) {
    return this.partners.saveVehicle(user.id, input);
  }

  @Post('partners/onboarding/zones')
  @RequireRole('PARTNER')
  zones(@CurrentUser() user: RequestUser, @ZodBody(partnerZonesSchema) input: PartnerZonesInput) {
    return this.partners.saveZones(user.id, input);
  }

  @Post('partners/onboarding/submit')
  @RequireRole('PARTNER')
  @RateLimit({ name: 'partner.submit', limit: 5, windowSeconds: 3600, keyBy: 'user' })
  submit(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerSubmitForReviewSchema) input: { acceptedTermsVersion: string },
  ) {
    return this.partners.submitForReview(user.id, input.acceptedTermsVersion);
  }

  /* --------------------------------------------------------------- self */

  @Get('partners/me')
  @RequireRole('PARTNER')
  @AllowRestricted()
  me(@CurrentUser() user: RequestUser) {
    return this.partners.getProfile(user.id);
  }

  @Get('partners/me/documents')
  @RequireRole('PARTNER')
  @AllowRestricted()
  documents(@CurrentUser() user: RequestUser) {
    return this.partners.listDocuments(user.id);
  }

  @Post('partners/me/documents')
  @RequireRole('PARTNER')
  addDocument(
    @CurrentUser() user: RequestUser,
    @ZodBody(partnerDocumentUploadSchema) input: PartnerDocumentUploadInput,
  ) {
    return this.partners.addDocument(user.id, input);
  }

  @Get('partners/me/availability')
  @RequireRole('PARTNER')
  @AllowRestricted()
  getAvailability(@CurrentUser() user: RequestUser) {
    return this.availability.get(user.id);
  }

  @Put('partners/me/availability')
  @RequireRole('PARTNER')
  setAvailability(
    @CurrentUser() user: RequestUser,
    @ZodBody(setAvailabilitySchema) input: SetAvailabilityInput,
  ) {
    return this.availability.setAvailability(user.id, input);
  }

  @Post('partners/me/heartbeat')
  @RequireRole('PARTNER')
  @RateLimit({ name: 'partner.heartbeat', limit: 120, windowSeconds: 60, keyBy: 'user' })
  heartbeat(@CurrentUser() user: RequestUser, @ZodBody(heartbeatSchema) input: HeartbeatInput) {
    return this.availability.heartbeat(user.id, input);
  }

  @Get('partners/me/jobs')
  @RequireRole('PARTNER')
  @AllowRestricted()
  jobs(
    @CurrentUser() user: RequestUser,
    @ZodQuery(partnerJobsQuerySchema) query: PartnerJobsQuery,
  ) {
    return this.partners.listJobs(user.id, query);
  }

  @Get('partners/me/bank-accounts')
  @RequireRole('PARTNER')
  @AllowRestricted()
  bankAccounts(@CurrentUser() user: RequestUser) {
    return this.partners.listBankAccounts(user.id);
  }

  @Post('partners/me/bank-accounts')
  @RequireRole('PARTNER')
  addBankAccount(
    @CurrentUser() user: RequestUser,
    @ZodBody(addBankAccountSchema) input: AddBankAccountBody,
  ) {
    return this.partners.addBankAccount(user.id, input);
  }

  /* --------------------------------------------------------------- admin */

  @Get('admin/partners')
  @RequirePermission(Permission.PARTNERS_READ)
  adminList(@ZodQuery(adminPartnerListSchema) query: AdminPartnerListQuery) {
    return this.partners.adminList(query);
  }

  @Get('admin/partners/:id')
  @RequirePermission(Permission.PARTNERS_READ)
  adminGet(@Param('id', UuidPipe) id: string) {
    return this.partners.adminGet(id);
  }

  @Post('admin/partners/:id/documents/:docId/review')
  @RequirePermission(Permission.PARTNERS_REVIEW_DOCUMENTS)
  @Audited({ action: 'partner_document.review', entity: 'partner_document', entityIdFrom: 'docId' })
  reviewDocument(
    @Param('id', UuidPipe) id: string,
    @Param('docId', UuidPipe) docId: string,
    @ZodBody(reviewDocumentSchema) input: ReviewDocumentInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.partners.reviewDocument(id, docId, input, actor, requestId);
  }

  @Post('admin/partners/:id/decision')
  @RequireAnyPermission(Permission.PARTNERS_APPROVE, Permission.PARTNERS_SUSPEND)
  @Audited({ action: 'partner.decision', entity: 'partner', entityIdFrom: 'id', sensitive: true })
  decide(
    @Param('id', UuidPipe) id: string,
    @ZodBody(partnerDecisionSchema) input: PartnerDecisionInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.partners.decide(id, input, actor, requestId);
  }

  @Patch('admin/partners/:id')
  @RequirePermission(Permission.PARTNERS_MANAGE)
  @Audited({ action: 'partner.manage', entity: 'partner', entityIdFrom: 'id' })
  adminUpdate(
    @Param('id', UuidPipe) id: string,
    @ZodBody(adminUpdatePartnerSchema) input: AdminUpdatePartnerInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.partners.adminUpdate(id, input, actor, requestId);
  }
}
