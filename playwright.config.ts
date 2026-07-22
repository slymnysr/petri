import { defineConfig, devices } from '@playwright/test';

/**
 * E2e testleri gerçek bir tarayıcıda, gerçek dev sunucusuna karşı çalışır.
 *
 * Bu testlerin varlık sebebi, birim testlerin göremediği katman: WebGL'in
 * gerçekten çizip çizmediği, tıklamanın doğru organizmayı seçip seçmediği,
 * arayüzün panellerinin çökmeden dolup dolmadığı. Bunlar simülasyon
 * mantığından bağımsız; kod doğru olsa bile render veya DOM tarafında
 * sessizce bozulabilirler.
 *
 * `webServer` Vite'ı testlerden önce başlatır ve sonunda kapatır — CI'da elle
 * sunucu yönetmeye gerek kalmasın.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    // WebGL, headless yazılım oluşturucuda çalışmalı. Bu bayraklar SwiftShader'ı
    // zorlayıp GPU'suz ortamda da bağlamın kurulmasını sağlar.
    launchOptions: {
      args: [
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
