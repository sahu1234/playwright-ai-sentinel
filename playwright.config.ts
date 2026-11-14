import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const candidateReporterPaths = [
  './src/reporters/executiveAIReporter.ts',
  './src/reporters/executiveAiReporter.ts',
  './src/ai/reporters/executiveAIReporter.ts',
  './src/ai/reporters/executiveAiReporter.ts',
];

const resolvedReporter = candidateReporterPaths.find((relPath) =>
  fs.existsSync(path.resolve(__dirname, relPath))
);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ...(resolvedReporter ? ([[resolvedReporter]] as const) : []),
  ],
  use: {
    baseURL: 'https://expandtesting.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
