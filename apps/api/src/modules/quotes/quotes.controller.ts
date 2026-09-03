import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type DecideQuoteInput, type SimpleTransitionInput, type SubmitQuoteInput, decideQuoteSchema, simpleTransitionSchema, submitQuoteSchema } from '@tamam/validation';

import { AllowRestricted, CurrentUser, RequestId, RequireRole, ZodBody } from '../../common/decorators';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import type { RequestUser } from '../../common/types/request-user';
import { QuotesService } from './quotes.service';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('jobs/:id/quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  @AllowRestricted()
  list(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string) {
    return this.quotes.listForJob(id, user);
  }

  @Post()
  @RequireRole('PARTNER')
  submit(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(submitQuoteSchema) input: SubmitQuoteInput, @RequestId() rid: string) {
    return this.quotes.submit(id, user, input, rid);
  }

  @Post('decision')
  @HttpCode(200)
  decide(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(decideQuoteSchema) input: DecideQuoteInput, @RequestId() rid: string) {
    return this.quotes.decide(id, user, input, rid);
  }

  @Post('close-inspection-only')
  @HttpCode(200)
  @RequireRole('CUSTOMER')
  async closeInspectionOnly(@CurrentUser() user: RequestUser, @Param('id', UuidPipe) id: string, @ZodBody(simpleTransitionSchema) input: SimpleTransitionInput, @RequestId() rid: string) {
    await this.quotes.closeInspectionOnly(id, user, input.version, rid);
    return { ok: true };
  }
}
