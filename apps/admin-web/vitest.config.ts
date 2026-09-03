import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${root}src`,
      // Tests compile the workspace sources directly so they never depend on a prior `dist` build.
      '@tamam/shared-types': `${root}../../packages/shared-types/src/index.ts`,
      '@tamam/validation': `${root}../../packages/validation/src/index.ts`,
      '@tamam/ui-tokens': `${root}../../packages/ui-tokens/dist/tokens.ts`,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Formatting tests assert wall-clock output in the platform timezone.
    env: { TZ: 'Asia/Jerusalem' },
    css: false,
  },
});
