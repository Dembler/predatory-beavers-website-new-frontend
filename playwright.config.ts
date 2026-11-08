import { defineConfig, devices } from '@playwright/test'

const browserName = process.env.E2E_BROWSER || 'chromium'
if (browserName !== 'chromium' && browserName !== 'firefox' && browserName !== 'webkit') {
  throw new Error('E2E_BROWSER must be chromium, firefox or webkit')
}
const desktopDevice = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
}[browserName]!
const artifactsDir = process.env.E2E_ARTIFACTS_DIR || '.data'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  outputDir: `${artifactsDir}/test-results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${artifactsDir}/playwright-report`, open: 'never' }],
    ['json', { outputFile: `${artifactsDir}/playwright-results.json` }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    channel: browserName === 'chromium' ? process.env.E2E_BROWSER_CHANNEL || undefined : undefined,
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
      use: { ...desktopDevice, viewport: { width: 1440, height: 1000 } },
    },
    // Firefox does not support Playwright's isMobile emulation. WebKit runs the
    // iPhone profile; Chromium remains the default for the existing workflow.
    ...(browserName === 'firefox'
      ? []
      : [
          {
            name: 'mobile',
            use: {
              ...devices['iPhone 13'],
              defaultBrowserType: browserName as 'chromium' | 'webkit',
            },
          },
        ]),
  ],
})
