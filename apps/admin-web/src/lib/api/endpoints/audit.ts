import type { AuditLogDto, Page } from '@tamam/shared-types';
import type { AuditListFilterInput } from '@tamam/validation';

import { api } from '@/lib/api';

export const auditApi = {
  list: (filter: Partial<AuditListFilterInput>) =>
    api.get<Page<AuditLogDto>>('/admin/audit-logs', { ...filter }),
};
