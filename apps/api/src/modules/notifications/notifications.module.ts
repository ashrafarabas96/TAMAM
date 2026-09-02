import { Global, Module, type OnModuleInit } from '@nestjs/common';

import { NotificationTemplateService } from './notification-template.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTemplateService, NotificationsProcessor],
  exports: [NotificationsService, NotificationTemplateService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly templates: NotificationTemplateService) {}
  async onModuleInit(): Promise<void> {
    await this.templates.seedDefaults();
  }
}
