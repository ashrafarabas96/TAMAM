import { Global, Module } from '@nestjs/common';

import { MediaModule } from '../media/media.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Global()
@Module({
  imports: [MediaModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
