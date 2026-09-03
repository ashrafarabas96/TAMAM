import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

import tokens from '@tamam/ui-tokens/json';

/**
 * Every colour comes from `@tamam/ui-tokens`. Theme-dependent colours point at the CSS custom
 * properties emitted by `@tamam/ui-tokens/css` (light on `:root`, dark on `[data-theme="dark"]`);
 * brand scales and semantic colours are theme-independent and are read from tokens.json.
 */
const purple = tokens.color.brand.purple;
const yellow = tokens.color.brand.yellow;
const neutral = tokens.color.neutral;
const semantic = tokens.color.semantic;
const service = tokens.color.service;

const scale = (prefix: string, keys: string[]): Record<string, string> =>
  Object.fromEntries(keys.map((k) => [k, `var(--${prefix}-${k})`]));

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--c-background)',
        surface: {
          DEFAULT: 'var(--c-surface)',
          alt: 'var(--c-surfaceAlt)',
          brand: 'var(--c-surfaceBrand)',
          'brand-soft': 'var(--c-surfaceBrandSoft)',
        },
        border: { DEFAULT: 'var(--c-border)', strong: 'var(--c-borderStrong)' },
        text: {
          primary: 'var(--c-textPrimary)',
          secondary: 'var(--c-textSecondary)',
          tertiary: 'var(--c-textTertiary)',
          'on-brand': 'var(--c-textOnBrand)',
          'on-accent': 'var(--c-textOnAccent)',
        },
        primary: { DEFAULT: 'var(--c-primary)', hover: 'var(--c-primaryHover)', pressed: 'var(--c-primaryPressed)' },
        accent: { DEFAULT: 'var(--c-accent)', hover: 'var(--c-accentHover)', pressed: 'var(--c-accentPressed)' },
        overlay: 'var(--c-overlay)',
        skeleton: 'var(--c-skeleton)',
        map: { route: 'var(--c-mapRoute)', pickup: 'var(--c-mapPickup)', destination: 'var(--c-mapDestination)' },
        purple: { ...scale('purple', Object.keys(purple)) },
        yellow: { ...scale('yellow', Object.keys(yellow)) },
        neutral: { ...scale('neutral', Object.keys(neutral)) },
        success: { DEFAULT: semantic.success.base, soft: semantic.success.soft, strong: semantic.success.strong },
        warning: { DEFAULT: semantic.warning.base, soft: semantic.warning.soft, strong: semantic.warning.strong },
        danger: { DEFAULT: semantic.danger.base, soft: semantic.danger.soft, strong: semantic.danger.strong },
        info: { DEFAULT: semantic.info.base, soft: semantic.info.soft, strong: semantic.info.strong },
        service: { ride: service.ride, delivery: service.delivery, home: service.homeService, urgent: service.urgent },
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-xxl)',
        pill: 'var(--radius-pill)',
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
        sheet: 'var(--radius-sheet)',
        banner: 'var(--radius-banner)',
      },
      fontFamily: {
        arabic: ['var(--font-arabic)'],
        latin: ['var(--font-latin)'],
        sans: ['var(--font-ui)'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: `0 ${tokens.elevation.card.y}px ${tokens.elevation.card.blur}px ${tokens.elevation.card.color}`,
        raised: `0 ${tokens.elevation.raised.y}px ${tokens.elevation.raised.blur}px ${tokens.elevation.raised.color}`,
        floating: `0 ${tokens.elevation.floating.y}px ${tokens.elevation.floating.blur}px ${tokens.elevation.floating.color}`,
      },
      transitionDuration: {
        fast: `${tokens.motion.durationFast}ms`,
        base: `${tokens.motion.durationBase}ms`,
        slow: `${tokens.motion.durationSlow}ms`,
      },
      transitionTimingFunction: {
        standard: tokens.motion.easingStandard,
        emphasized: tokens.motion.easingEmphasized,
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-end': { from: { transform: 'translateX(var(--slide-in-from))' }, to: { transform: 'translateX(0)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in var(--motion-base) var(--easing-standard)',
        'slide-up': 'slide-up var(--motion-base) var(--easing-emphasized)',
        'slide-in-end': 'slide-in-end var(--motion-slow) var(--easing-emphasized)',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      // Direction-aware variants driven by the `dir` attribute set on <html>.
      addVariant('rtl', '[dir="rtl"] &');
      addVariant('ltr', '[dir="ltr"] &');
    }),
  ],
};

export default config;
