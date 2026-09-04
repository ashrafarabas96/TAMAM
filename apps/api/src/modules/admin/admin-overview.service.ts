import { Injectable } from '@nestjs/common';
import { type OpsDashboardDto, VerificationStatus } from '@tamam/shared-types';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { DisputesService } from '../disputes/disputes.service';
import { JobSafetyService } from '../jobs/job-safety.service';
import { SupportService } from '../support/support.service';

/** The single payload behind the admin home screen (spec §139). */
export interface AdminOverviewDto {
  dashboard: OpsDashboardDto;
  queues: {
    openSupportTickets: number;
    openDisputes: number;
    openSosAlerts: number;
    pendingPartnerVerifications: number;
    pendingPartnerDocuments: number;
  };
  generatedAt: string;
}

/**
 * Aggregates the ops dashboard with the "somebody must act" counters so the admin home does
 * one request instead of five. Every number is owned by its module — this service never
 * re-implements a count that another service already publishes.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly support: SupportService,
    private readonly disputes: DisputesService,
    private readonly safety: JobSafetyService,
  ) {}

  async overview(): Promise<AdminOverviewDto> {
    const [
      dashboard,
      openSupportTickets,
      openDisputes,
      sosAlerts,
      pendingPartnerVerifications,
      pendingPartnerDocuments,
    ] = await Promise.all([
      this.analytics.opsDashboard(),
      this.support.openTicketCount(),
      this.disputes.openCount(),
      this.safety.listOpenSos(),
      this.prisma.partnerProfile.count({
        where: {
          verificationStatus: { in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] },
        },
      }),
      this.prisma.partnerDocument.count({ where: { status: 'PENDING' } }),
    ]);
    return {
      dashboard,
      queues: {
        openSupportTickets,
        openDisputes,
        openSosAlerts: sosAlerts.length,
        pendingPartnerVerifications,
        pendingPartnerDocuments,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
