import { Injectable } from '@nestjs/common';
import { type NotificationChannel, NotificationEvent } from '@tamam/shared-types';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

export interface RenderedTemplate {
  title: string;
  body: string;
}

interface TemplateDef {
  ar: { title: string; body: string };
  en: { title: string; body: string };
}

/** Default AR/EN templates seeded into notification_templates (editable by Marketing/Admin — spec §63). */
export const DEFAULT_TEMPLATES: Record<string, TemplateDef> = {
  OTP_CODE: {
    ar: {
      title: 'رمز التحقق',
      body: 'رمز الدخول إلى تمام: {{code}} — صالح لمدة {{minutes}} دقائق. لا تشاركه مع أحد.',
    },
    en: {
      title: 'Verification code',
      body: 'Your TAMAM code is {{code}} — valid for {{minutes}} minutes. Never share it.',
    },
  },
  JOB_CREATED: {
    ar: { title: 'تم استلام طلبك', body: 'طلبك رقم {{jobNumber}} قيد البحث عن أقرب شريك.' },
    en: {
      title: 'Request received',
      body: 'Request {{jobNumber}} is searching for the nearest partner.',
    },
  },
  JOB_OFFER: {
    ar: {
      title: 'طلب جديد بالقرب منك',
      body: '{{serviceName}} على بعد {{distanceKm}} كم — الأرباح المتوقعة {{earnings}}.',
    },
    en: {
      title: 'New job nearby',
      body: '{{serviceName}} {{distanceKm}} km away — estimated earnings {{earnings}}.',
    },
  },
  JOB_ACCEPTED: {
    ar: {
      title: 'تم قبول طلبك',
      body: '{{partnerName}} في الطريق إليك، الوصول خلال {{etaMinutes}} دقيقة.',
    },
    en: {
      title: 'Your request was accepted',
      body: '{{partnerName}} is on the way, arriving in {{etaMinutes}} min.',
    },
  },
  PARTNER_ARRIVING: {
    ar: { title: 'الشريك يقترب', body: '{{partnerName}} سيصل خلال {{etaMinutes}} دقيقة.' },
    en: { title: 'Partner arriving', body: '{{partnerName}} arrives in {{etaMinutes}} min.' },
  },
  PARTNER_ARRIVED: {
    ar: { title: 'وصل الشريك', body: '{{partnerName}} في انتظارك الآن.' },
    en: { title: 'Partner arrived', body: '{{partnerName}} is waiting for you.' },
  },
  JOB_STARTED: {
    ar: { title: 'بدأ الطلب', body: 'بدأ تنفيذ طلبك رقم {{jobNumber}}.' },
    en: { title: 'Job started', body: 'Your request {{jobNumber}} has started.' },
  },
  QUOTE_RECEIVED: {
    ar: {
      title: 'عرض سعر جديد',
      body: 'أرسل {{partnerName}} عرض سعر بقيمة {{total}} — راجعه ووافق عليه.',
    },
    en: {
      title: 'New quote',
      body: '{{partnerName}} sent a quote of {{total}} — review and approve.',
    },
  },
  QUOTE_APPROVED: {
    ar: {
      title: 'تمت الموافقة على العرض',
      body: 'وافق العميل على عرض السعر {{total}}. يمكنك بدء العمل.',
    },
    en: {
      title: 'Quote approved',
      body: 'The customer approved the quote {{total}}. You can start the work.',
    },
  },
  QUOTE_REJECTED: {
    ar: { title: 'تم رفض العرض', body: 'رفض العميل عرض السعر. يمكنك إرسال عرض معدّل.' },
    en: {
      title: 'Quote rejected',
      body: 'The customer rejected the quote. You may submit a revised one.',
    },
  },
  JOB_COMPLETED: {
    ar: {
      title: 'اكتمل الطلب',
      body: 'اكتمل طلبك رقم {{jobNumber}} — الإجمالي {{total}}. قيّم تجربتك.',
    },
    en: {
      title: 'Job completed',
      body: 'Request {{jobNumber}} is complete — total {{total}}. Rate your experience.',
    },
  },
  JOB_CANCELLED: {
    ar: { title: 'تم إلغاء الطلب', body: 'تم إلغاء الطلب رقم {{jobNumber}}. {{reason}}' },
    en: { title: 'Job cancelled', body: 'Request {{jobNumber}} was cancelled. {{reason}}' },
  },
  NO_PARTNER_AVAILABLE: {
    ar: {
      title: 'لا يوجد شريك متاح حاليًا',
      body: 'لم نجد شريكًا متاحًا لطلبك رقم {{jobNumber}}. حاول مرة أخرى بعد قليل.',
    },
    en: {
      title: 'No partner available',
      body: 'We could not find a partner for {{jobNumber}}. Please try again shortly.',
    },
  },
  PAYMENT_SUCCESS: {
    ar: { title: 'تم الدفع بنجاح', body: 'تم استلام {{total}} لطلبك رقم {{jobNumber}}.' },
    en: { title: 'Payment successful', body: '{{total}} received for request {{jobNumber}}.' },
  },
  PAYMENT_FAILED: {
    ar: {
      title: 'فشل الدفع',
      body: 'تعذّر إتمام الدفع لطلبك رقم {{jobNumber}}. يرجى اختيار طريقة أخرى.',
    },
    en: {
      title: 'Payment failed',
      body: 'Payment for {{jobNumber}} could not be completed. Please choose another method.',
    },
  },
  DOCUMENT_EXPIRING: {
    ar: {
      title: 'وثيقة على وشك الانتهاء',
      body: 'تنتهي صلاحية {{documentType}} بتاريخ {{expiresAt}}. حدّثها لتجنب إيقاف الحساب.',
    },
    en: {
      title: 'Document expiring',
      body: 'Your {{documentType}} expires on {{expiresAt}}. Update it to avoid suspension.',
    },
  },
  DOCUMENT_REVIEWED: {
    ar: { title: 'نتيجة مراجعة الوثيقة', body: '{{documentType}}: {{decision}}. {{reason}}' },
    en: { title: 'Document reviewed', body: '{{documentType}}: {{decision}}. {{reason}}' },
  },
  PARTNER_APPROVED: {
    ar: {
      title: 'تمت الموافقة على حسابك',
      body: 'مرحبًا بك في تمام! يمكنك الآن الاتصال واستقبال الطلبات.',
    },
    en: {
      title: 'Account approved',
      body: 'Welcome to TAMAM! You can go online and receive jobs now.',
    },
  },
  NEW_MESSAGE: {
    ar: { title: 'رسالة جديدة', body: '{{senderName}}: {{preview}}' },
    en: { title: 'New message', body: '{{senderName}}: {{preview}}' },
  },
  SUPPORT_REPLY: {
    ar: { title: 'رد من الدعم', body: 'تم الرد على تذكرتك رقم {{ticketNumber}}.' },
    en: { title: 'Support replied', body: 'Your ticket {{ticketNumber}} has a new reply.' },
  },
  PROMO_CAMPAIGN: {
    ar: { title: '{{title}}', body: '{{body}}' },
    en: { title: '{{title}}', body: '{{body}}' },
  },
  SCHEDULED_REMINDER: {
    ar: { title: 'تذكير بموعدك', body: 'طلبك رقم {{jobNumber}} مجدول الساعة {{time}}.' },
    en: {
      title: 'Upcoming appointment',
      body: 'Your request {{jobNumber}} is scheduled at {{time}}.',
    },
  },
};

@Injectable()
export class NotificationTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Seeds missing templates for every event × channel (SMS/PUSH/IN_APP/EMAIL share text). */
  async seedDefaults(): Promise<void> {
    for (const event of Object.values(NotificationEvent)) {
      const def = DEFAULT_TEMPLATES[event];
      if (!def) continue;
      for (const channel of ['PUSH', 'IN_APP', 'SMS', 'EMAIL'] as NotificationChannel[]) {
        await this.prisma.notificationTemplate.upsert({
          where: { event_channel: { event, channel } },
          update: {},
          create: {
            event,
            channel,
            titleAr: def.ar.title,
            titleEn: def.en.title,
            bodyAr: def.ar.body,
            bodyEn: def.en.body,
          },
        });
      }
    }
  }

  async render(
    event: string,
    channel: NotificationChannel,
    language: 'ar' | 'en',
    vars: Record<string, string>,
  ): Promise<RenderedTemplate> {
    const cacheKey = `tpl:${event}:${channel}`;
    let tpl = await this.redis.getJson<{
      titleAr: string;
      titleEn: string;
      bodyAr: string;
      bodyEn: string;
      isActive: boolean;
    }>(cacheKey);
    if (!tpl) {
      const row = await this.prisma.notificationTemplate.findUnique({
        where: { event_channel: { event, channel } },
      });
      const def = DEFAULT_TEMPLATES[event];
      tpl = row
        ? {
            titleAr: row.titleAr,
            titleEn: row.titleEn,
            bodyAr: row.bodyAr,
            bodyEn: row.bodyEn,
            isActive: row.isActive,
          }
        : def
          ? {
              titleAr: def.ar.title,
              titleEn: def.en.title,
              bodyAr: def.ar.body,
              bodyEn: def.en.body,
              isActive: true,
            }
          : { titleAr: event, titleEn: event, bodyAr: '', bodyEn: '', isActive: true };
      await this.redis.setJson(cacheKey, tpl, 120);
    }
    const title = language === 'en' ? tpl.titleEn : tpl.titleAr;
    const body = language === 'en' ? tpl.bodyEn : tpl.bodyAr;
    return { title: this.interpolate(title, vars), body: this.interpolate(body, vars) };
  }

  async invalidate(event: string, channel: NotificationChannel): Promise<void> {
    await this.redis.del(`tpl:${event}:${channel}`);
  }

  private interpolate(text: string, vars: Record<string, string>): string {
    return text
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
