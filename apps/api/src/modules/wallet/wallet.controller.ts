import { Controller, Get, Headers as HttpHeaders, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ErrorCode, Permission, WithdrawalStatus } from '@tamam/shared-types';
import {
  type TopUpWalletInput,
  type WalletAdjustmentInput,
  type WithdrawalDecisionInput,
  type WithdrawalRequestInput,
  pageRequestSchema,
  topUpWalletSchema,
  walletAdjustmentSchema,
  withdrawalDecisionSchema,
  withdrawalRequestSchema,
} from '@tamam/validation';
import { z } from 'zod';

import {
  AllowRestricted,
  Audited,
  CurrentUser,
  Idempotent,
  RateLimit,
  RequestId,
  RequirePermission,
  RequireRole,
  ZodBody,
  ZodQuery,
} from '../../common/decorators';
import { AppException } from '../../common/errors/app.exception';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';

import { type EarningsPeriod, type WalletOwner, WalletService } from './wallet.service';

const walletQuerySchema = z.object({ owner: z.enum(['CUSTOMER', 'PARTNER']).optional() });
type WalletQuery = z.infer<typeof walletQuerySchema>;

const statementQuerySchema = pageRequestSchema.extend({
  owner: z.enum(['CUSTOMER', 'PARTNER']).optional(),
});
type StatementQuery = z.infer<typeof statementQuerySchema>;

const walletOwnerParamSchema = z.object({ ownerType: z.enum(['PARTNER', 'CUSTOMER']) });

const earningsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});
type EarningsQuery = z.infer<typeof earningsQuerySchema>;

const withdrawalListSchema = pageRequestSchema.extend({
  status: z.nativeEnum(WithdrawalStatus).optional(),
  partnerId: z.string().uuid().optional(),
});
type WithdrawalListQuery = z.infer<typeof withdrawalListSchema>;

/** The interceptor guarantees the header on @Idempotent routes; this keeps the type honest. */
function requireIdempotencyKey(value: string | undefined): string {
  if (!value)
    throw AppException.badRequest(
      ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key header is required',
    );
  return value;
}

@ApiTags('wallet')
@ApiBearerAuth()
@Controller()
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  /* ----------------------------------------------------------------- self */

  @Get('wallet')
  @AllowRestricted()
  mine(@CurrentUser() user: RequestUser, @ZodQuery(walletQuerySchema) query: WalletQuery) {
    return this.wallet.getMine(user, query.owner as WalletOwner | undefined);
  }

  @Get('wallet/statement')
  @AllowRestricted()
  statement(
    @CurrentUser() user: RequestUser,
    @ZodQuery(statementQuerySchema) query: StatementQuery,
  ) {
    return this.wallet.statement(
      user,
      query.cursor,
      query.limit,
      query.owner as WalletOwner | undefined,
    );
  }

  @Post('wallet/top-up')
  @Idempotent('wallet.topup')
  @RateLimit({ name: 'wallet.topup', limit: 10, windowSeconds: 3600, keyBy: 'user' })
  topUp(
    @CurrentUser() user: RequestUser,
    @ZodBody(topUpWalletSchema) input: TopUpWalletInput,
    @HttpHeaders('idempotency-key') idempotencyKey: string | undefined,
    @ZodQuery(walletQuerySchema) query: WalletQuery,
  ) {
    return this.wallet.topUp(
      user,
      input,
      requireIdempotencyKey(idempotencyKey),
      query.owner as WalletOwner | undefined,
    );
  }

  @Post('wallet/withdrawals')
  @RequireRole('PARTNER')
  @Idempotent('wallet.withdrawal')
  @RateLimit({ name: 'wallet.withdrawal', limit: 10, windowSeconds: 3600, keyBy: 'user' })
  requestWithdrawal(
    @CurrentUser() user: RequestUser,
    @ZodBody(withdrawalRequestSchema) input: WithdrawalRequestInput,
    @HttpHeaders('idempotency-key') idempotencyKey: string | undefined,
  ) {
    return this.wallet.requestWithdrawal(user, input, requireIdempotencyKey(idempotencyKey));
  }

  @Get('wallet/withdrawals')
  @RequireRole('PARTNER')
  @AllowRestricted()
  myWithdrawals(
    @CurrentUser() user: RequestUser,
    @ZodQuery(withdrawalListSchema) query: WithdrawalListQuery,
  ) {
    return this.wallet.listWithdrawals({
      partnerId: user.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  @Get('partners/me/earnings')
  @RequireRole('PARTNER')
  @AllowRestricted()
  earnings(@CurrentUser() user: RequestUser, @ZodQuery(earningsQuerySchema) query: EarningsQuery) {
    return this.wallet.partnerEarnings(user.id, query.period as EarningsPeriod);
  }

  /* ---------------------------------------------------------------- admin */

  @Post('admin/wallets/adjust')
  @RequirePermission(Permission.WALLET_ADJUST)
  @Audited({ action: 'wallet.adjust', entity: 'wallet', entityIdFrom: 'walletId', sensitive: true })
  adjust(
    @ZodBody(walletAdjustmentSchema) input: WalletAdjustmentInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.wallet.adjust(input, actor, requestId);
  }

  /**
   * Commission history for one partner, the same figures the partner sees in their app.
   * The console could show a balance but nothing behind it.
   */
  @Get('admin/partners/:id/earnings')
  @RequirePermission(Permission.PARTNERS_READ)
  partnerEarnings(
    @Param('id', UuidPipe) id: string,
    @ZodQuery(earningsQuerySchema) query: EarningsQuery,
  ) {
    return this.wallet.partnerEarnings(id, query.period as EarningsPeriod);
  }

  /**
   * Resolves a wallet from its owner. Statements are keyed by walletId, which previously
   * could only be discovered by scanning the ledger accounts list.
   */
  @Get('admin/wallets/by-owner/:ownerType/:ownerId')
  @RequirePermission(Permission.LEDGER_READ)
  walletByOwner(
    @Param('ownerType') ownerType: string,
    @Param('ownerId', UuidPipe) ownerId: string,
  ) {
    const parsed = walletOwnerParamSchema.safeParse({ ownerType });
    if (!parsed.success)
      throw AppException.validation([
        { field: 'ownerType', message: 'ownerType must be PARTNER or CUSTOMER' },
      ]);
    return this.wallet.findByOwner(parsed.data.ownerType, ownerId);
  }

  @Get('admin/withdrawals')
  @RequirePermission(Permission.WITHDRAWALS_MANAGE)
  listWithdrawals(@ZodQuery(withdrawalListSchema) query: WithdrawalListQuery) {
    return this.wallet.listWithdrawals(query);
  }

  @Post('admin/withdrawals/:id/decision')
  @RequirePermission(Permission.WITHDRAWALS_MANAGE)
  @Audited({
    action: 'withdrawal.decision',
    entity: 'withdrawal',
    entityIdFrom: 'id',
    sensitive: true,
  })
  decide(
    @Param('id', UuidPipe) id: string,
    @ZodBody(withdrawalDecisionSchema) input: WithdrawalDecisionInput,
    @CurrentUser() actor: RequestUser,
    @RequestId() requestId: string,
  ) {
    return this.wallet.decideWithdrawal(id, input, actor, requestId);
  }
}
