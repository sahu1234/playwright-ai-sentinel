import { test, expect } from '../src/ai/fixtures/aiFixtures';
import { summarizeFailureToMarkdown } from '../src/ai/failureSummarizer';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Automated JS Error Capture & AI Failure Triage (@triage)', () => {
  test('captures uncaught onload JS errors on /javascript-error and generates an AI bug report', async ({
    smartPage,
  }, testInfo) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    smartPage.page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    smartPage.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await smartPage.gotoPractice('/javascript-error');

    // Verify that the practice page triggered its intentional onload TypeError
    expect(pageErrors.length + consoleErrors.length).toBeGreaterThan(0);

    const bodyExcerpt = await smartPage.page.locator('body').innerText();

    const bugReport = await summarizeFailureToMarkdown({
      testTitle: testInfo.title,
      pageUrl: smartPage.page.url(),
      pageErrors,
      consoleErrors,
      domExcerpt: bodyExcerpt.slice(0, 500),
    });

    expect(bugReport.title.length).toBeGreaterThan(5);
    expect(bugReport.rootCause.length).toBeGreaterThan(15);
    expect(bugReport.markdownReport).toContain('## 2. Root Cause Analysis');

    await testInfo.attach('ai-bug-triage-report.md', {
      body: Buffer.from(bugReport.markdownReport, 'utf-8'),
      contentType: 'text/markdown',
    });

    const reportPath = path.resolve(process.cwd(), 'healing-logs', 'latest-bug-triage.md');
    expect(fs.existsSync(reportPath)).toBe(true);
  });
});
