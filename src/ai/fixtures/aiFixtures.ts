import { test as base, expect, Page, TestInfo } from '@playwright/test';
import { executeWithSelfHealing, HealingSuggestion } from '../healer';

export interface SmartActionResult {
  usedSelector: string;
  healed: boolean;
  suggestion?: HealingSuggestion;
}

export interface SmartPage {
  page: Page;
  /**
   * Navigates to a practice route on ExpandTesting, automatically resolving
   * relative paths against `[https://practice.expandtesting.com](https://practice.expandtesting.com)` so practice routes
   * load directly without marketing-site redirects.
   */
  gotoPractice: (routePath: string) => Promise<void>;
  /**
   * Attempts a standard Playwright click (3000ms timeout). On failure, invokes
   * the AI DOM Healer (`confidence >= 0.8`), logs to `healing-logs/healed-selectors.json`,
   * pushes a `test.info().annotations` warning, and retries with the healed selector.
   */
  smartClick: (selector: string, description: string) => Promise<SmartActionResult>;
  /**
   * Attempts a standard Playwright fill (3000ms timeout). On failure, invokes
   * the AI DOM Healer (`confidence >= 0.8`), logs to `healing-logs/healed-selectors.json`,
   * pushes a `test.info().annotations` warning, and retries with the healed selector.
   */
  smartFill: (selector: string, value: string, description: string) => Promise<SmartActionResult>;
  /**
   * Returns any third-party ad/tracker URLs intercepted and aborted during the test.
   */
  getBlockedAdRequests: () => string[];
}

type AIFixtures = {
  smartPage: SmartPage;
};

const BLOCKED_AD_DOMAINS = [
  'googlesyndication',
  'doubleclick',
  'google-analytics',
  'googletagmanager',
  'adservice.google',
  'pagead2.googlesyndication',
];

export const test = base.extend<AIFixtures>({
  smartPage: async ({ page }, use, testInfo: TestInfo) => {
    const blockedRequests: string[] = [];

    // Intercept and abort third-party ad & analytics scripts so public practice pages never hang
    await page.route('**/*', async (route) => {
      const requestUrl = route.request().url().toLowerCase();
      const shouldBlock = BLOCKED_AD_DOMAINS.some((domain) => requestUrl.includes(domain));

      if (shouldBlock) {
        blockedRequests.push(requestUrl);
        await route.abort();
        return;
      }
      await route.continue();
    });

    // src/ai/fixtures/aiFixtures.ts (or src/fixtures/aiFixtures.ts)
    const PRACTICE_ORIGIN = (
      process.env.PRACTICE_ORIGIN || 'https://practice.expandtesting.com'
    ).replace(/\/$/, '');

    const smartPage: SmartPage = {
      page,
      gotoPractice: async (routePath: string) => {
        const targetUrl = routePath.startsWith('http')
          ? routePath
          : `${PRACTICE_ORIGIN}${routePath.startsWith('/') ? '' : '/'}${routePath}`;
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      },
      smartClick: async (selector: string, description: string) => {
        return executeWithSelfHealing(page, 'click', selector, description, undefined, testInfo);
      },
      smartFill: async (selector: string, value: string, description: string) => {
        return executeWithSelfHealing(page, 'fill', selector, description, value, testInfo);
      },
      getBlockedAdRequests: () => [...blockedRequests],
    };

    await use(smartPage);
  },
});

export { expect };
