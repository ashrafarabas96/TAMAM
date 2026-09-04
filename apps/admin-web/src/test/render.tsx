import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import { I18nProvider, type Locale } from '@/i18n';

function Wrapper({ children, locale = 'en' }: { children: ReactNode; locale?: Locale }) {
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}

/** Renders a component inside the i18n provider (English, so assertions read naturally). */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { locale?: Locale },
) {
  const locale = options?.locale ?? 'en';
  return render(ui, {
    wrapper: ({ children }) => <Wrapper locale={locale}>{children}</Wrapper>,
    ...options,
  });
}
