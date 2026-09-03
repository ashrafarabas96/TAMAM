'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/form';
import { useI18n } from '@/i18n';
import { setAccessToken } from '@/lib/auth/token-store';
import { useTheme } from '@/lib/theme';
import { getOrCreateDeviceId } from '@/lib/utils/id';

/** Mirrors `adminLoginSchema` (email + password ≥ 12 chars); the API remains the authority. */
const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(12).max(200),
});
type LoginValues = z.infer<typeof loginSchema>;

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export function LoginForm() {
  const { t, locale, setLocale, errorMessage } = useI18n();
  const { resolved, toggle } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get('reason') === 'expired' ? t('login.sessionExpired') : null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...values, deviceId: getOrCreateDeviceId(), deviceName: navigator.userAgent.slice(0, 120) }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string; message?: string } | null;
      setError(body?.code ? errorMessage(body.code, body.message ?? t('login.failed')) : t('login.failed'));
      return;
    }
    const data = (await response.json()) as { accessToken: string; expiresAt: string };
    setAccessToken(data.accessToken, data.expiresAt);
    router.replace(safeNext(params.get('next')));
    router.refresh();
  });

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-purple-700 p-10 text-neutral-0 lg:flex">
        <div className="absolute -end-24 -top-24 h-96 w-96 rounded-pill bg-purple-500/60 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -start-16 h-96 w-96 rounded-pill bg-accent/30 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-12 w-12" />
          <div>
            <p className="text-2xl font-extrabold tracking-wide">TAMAM</p>
            <p className="text-sm text-purple-200">{t('app.consoleName')}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight">{t('login.heroTitle')}</h2>
          <p className="mt-3 text-sm text-purple-100">{t('login.heroSubtitle')}</p>
        </div>
        <p className="relative text-xs text-purple-200">© {new Date().getFullYear()} TAMAM · تمام</p>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="mb-6 flex w-full max-w-md items-center justify-between">
          <img src="/logo.svg" alt="TAMAM" className="h-10 lg:hidden" />
          <div className="ms-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
              {locale === 'ar' ? 'English' : 'العربية'}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggle}>
              {resolved === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            </Button>
          </div>
        </div>
        <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4 p-8" noValidate>
          <div>
            <h1 className="text-xl font-extrabold text-text-primary">{t('login.title')}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t('login.subtitle')}</p>
          </div>
          <FormError message={error} />
          <TextField control={form.control} name="email" label={t('common.email')} type="email" autoComplete="username" dir="ltr" required />
          <TextField control={form.control} name="password" label={t('login.password')} type="password" autoComplete="current-password" dir="ltr" required />
          <Button type="submit" variant="accent" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            {t('login.submit')}
          </Button>
          <p className="text-center text-[11px] text-text-tertiary">{t('login.securityNote')}</p>
        </form>
      </main>
    </div>
  );
}
