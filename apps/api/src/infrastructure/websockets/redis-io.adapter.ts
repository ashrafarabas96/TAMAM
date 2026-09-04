import type { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/** Socket.IO adapter backed by Redis pub/sub so rooms work across API replicas. */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(app: INestApplication) {
    super(app);
  }

  async connect(redisUrl: string): Promise<void> {
    const pub = new Redis(redisUrl);
    const sub = pub.duplicate();
    await Promise.all([
      new Promise((r) => pub.once('ready', r)),
      new Promise((r) => sub.once('ready', r)),
    ]);
    this.adapterConstructor = createAdapter(pub, sub);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: true, credentials: true },
      pingInterval: 20000,
      pingTimeout: 15000,
      maxHttpBufferSize: 64 * 1024, // location + chat payloads are tiny; block abuse
      transports: ['websocket', 'polling'],
    }) as { adapter(a: unknown): void };
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
