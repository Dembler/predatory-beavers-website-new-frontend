import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: '.data/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.data/playwright-report', open: 'never' }],
    ['json', { outputFile: '.data/playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    channel: process.env.E2E_BROWSER_CHANNEL || 'chromium',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    // The login form contains a local disposable password. Do not record it in traces/videos.
    trace: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})
