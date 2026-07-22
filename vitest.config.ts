import { defineConfig } from 'vitest/config';

/**
 * Vitest yapılandırması, Vite'ınkinden ayrı tutuluyor.
 *
 * Tek sebebi kapsam sınırı: e2e testleri (`e2e/*.e2e.ts`) Playwright ile
 * çalışıyor ve gerçek bir tarayıcı gerektiriyor; Vitest onları yanlışlıkla
 * toplayıp `@playwright/test` importunda çökmemeli.
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
