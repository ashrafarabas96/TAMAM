import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { AppConfigService } from '../../config';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'> implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({
      datasources: { db: { url: config.env.DATABASE_URL } },
      log: config.env.LOG_LEVEL === 'trace' ? [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'error' }] : [{ emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Serializable-ish helper for money-critical work: runs the callback in a transaction
   * with the ledger write flag enabled so wallet balance triggers accept the update.
   */
  async ledgerTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL tamam.ledger_write = 'on'`);
        return fn(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 15000 },
    );
  }

  /** Atomic counter (job numbers etc.) backed by the counters table. */
  async nextCounter(key: string, tx?: Tx): Promise<bigint> {
    const client = tx ?? this;
    const rows = await client.$queryRaw<Array<{ value: bigint }>>`SELECT tamam_next_counter(${key}) AS value`;
    const value = rows[0]?.value;
    if (value === undefined) throw new Error(`counter ${key} failed`);
    return BigInt(value);
  }

  /** Zone containing the point, using the PostGIS helper (spec §74). */
  async zoneIdForPoint(lat: number, lng: number, tx?: Tx): Promise<string | null> {
    const client = tx ?? this;
    const rows = await client.$queryRaw<Array<{ id: string | null }>>`SELECT tamam_zone_for_point(${lat}::double precision, ${lng}::double precision) AS id`;
    return rows[0]?.id ?? null;
  }
}
