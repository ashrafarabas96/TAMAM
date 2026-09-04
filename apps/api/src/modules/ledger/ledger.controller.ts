import { Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LedgerAccountType, LedgerTransactionType, Permission } from '@tamam/shared-types';
import {
  type UpsertCommissionPolicyInput,
  pageRequestSchema,
  upsertCommissionPolicySchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  Audited,
  CurrentUser,
  RequestId,
  RequirePermission,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { CommissionService } from './commission.service';
import { LedgerService } from './ledger.service';

const accountsQuerySchema = z.object({
  currency: z.enum(['ILS', 'USD', 'JOD']).optional(),
  type: z.nativeEnum(LedgerAccountType).optional(),
});
type AccountsQuery = z.infer<typeof accountsQuerySchema>;

const transactionsQuerySchema = pageRequestSchema.extend({
  jobId: z.string().uuid().optional(),
  type: z.nativeEnum(LedgerTransactionType).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
type TransactionsQuery = z.infer<typeof transactionsQuerySchema>;

type PageQuery = z.infer<typeof pageRequestSchema>;

/** Finance/read-only views over the double-entry ledger plus commission policy administration. */
@ApiTags('admin/ledger')
@ApiBearerAuth()
@Controller()
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly commission: CommissionService,
  ) {}

  @Get('admin/ledger/accounts')
  @RequirePermission(Permission.LEDGER_READ)
  accounts(@ZodQuery(accountsQuerySchema) query: AccountsQuery) {
    return this.ledger.listAccounts(query);
  }

  @Get('admin/ledger/transactions')
  @RequirePermission(Permission.LEDGER_READ)
  transactions(@ZodQuery(transactionsQuerySchema) query: TransactionsQuery) {
    return this.ledger.listTransactions(query);
  }

  @Get('admin/ledger/wallets/:walletId/statement')
  @RequirePermission(Permission.LEDGER_READ)
  statement(
    @Param('walletId', UuidPipe) walletId: string,
    @ZodQuery(pageRequestSchema) query: PageQuery,
  ) {
    return this.ledger.statement(walletId, query.cursor, query.limit);
  }

  /** Recomputes the balance from the entries and compares it with the cached wallet balance. */
  @Post('admin/ledger/wallets/:walletId/verify')
  @RequirePermission(Permission.LEDGER_READ)
  verify(@Param('walletId', UuidPipe) walletId: string) {
    return this.ledger.verifyWallet(walletId);
  }

  @Get('admin/commission-policies')
  @RequirePermission(Permission.COMMISSION_MANAGE)
  listPolicies() {
    return this.commission.list();
  }

  @Put('admin/commission-policies')
  @RequirePermission(Permission.COMMISSION_MANAGE)
  @Audited({ action: 'commission_policy.upsert', entity: 'commission_policy', sensitive: true })
  upsertPolicy(
    @ZodBody(upsertCommissionPolicySchema) input: UpsertCommissionPolicyInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.commission.upsert(input, actor.id, requestId);
  }
}
