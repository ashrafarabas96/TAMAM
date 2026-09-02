import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@tamam/shared-types';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { AppConfigService } from './config';
import { RedisIoAdapter } from './infrastructure/websockets/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  const config = app.get(AppConfigService);

  app.set('trust proxy', config.env.TRUST_PROXY ? 1 : false);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: config.isProduction ? undefined : false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: (origin, cb) => {
      // Mobile apps send no Origin; browsers (admin) must match the allowlist.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id', 'X-Device-Id', 'X-App-Version', 'Accept-Language', 'X-Timezone'],
    exposedHeaders: ['X-Request-Id', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Idempotent-Replayed'],
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health/live', 'health/ready', 'metrics'] });
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.enableShutdownHooks();

  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connect(config.env.REDIS_URL);
  app.useWebSocketAdapter(ioAdapter);

  if (!config.isProduction) {
    const doc = new DocumentBuilder()
      .setTitle('TAMAM API')
      .setDescription('Universal local services platform — Ride · Delivery · Home Services')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc), { swaggerOptions: { persistAuthorization: true } });
  }

  await app.listen(config.env.PORT, '0.0.0.0');
  logger.log(`TAMAM API listening on :${config.env.PORT} (${config.env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
