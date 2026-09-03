import type { BroadcastNotificationInput, UpsertNotificationTemplateInput } from '@tamam/validation';

import { api } from '@/lib/api';
import type { NotificationTemplateRow } from '@/lib/api/types';

export const notificationsApi = {
  templates: () => api.get<NotificationTemplateRow[]>('/admin/notification-templates'),
  upsertTemplate: (input: UpsertNotificationTemplateInput) => api.put<NotificationTemplateRow>('/admin/notification-templates', input),
  broadcast: (input: BroadcastNotificationInput) => api.post<{ queued?: number; ok?: boolean }>('/admin/notifications/broadcast', input),
};
