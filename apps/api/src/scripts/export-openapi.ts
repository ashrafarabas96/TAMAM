import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../app.module';

/** Writes docs/openapi.json for the admin/mobile teams and CI contract checks. */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('TAMAM API').setVersion('1.0').addBearerAuth().build());
  const out = resolve(__dirname, '../../../../docs/openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.warn(`OpenAPI written to ${out}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
