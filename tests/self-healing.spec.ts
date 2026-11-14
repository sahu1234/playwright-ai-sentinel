import { test, expect } from '../src/ai/fixtures/aiFixtures';
import { DynamicIdPage } from '../src/ai/pages/DynamicIdPage';
import * as fs from 'fs';
import * as path from 'path';

test.describe('AI Self-Healing Locator Suite (@self-healing)', () => {
  test('heals a broken recorded ID selector on /dynamic-id and logs telemetry', async ({
    smartPage,
  }, testInfo) => {
    const dynamicPage = new DynamicIdPage(smartPage);
    await dynamicPage.openDynamicIdPlayground();

    await expect(dynamicPage.getHeading()).toContainText('Dynamic ID');

    // Intentionally pass a stale recorded ID selector to trigger AI self-healing
    const result = await dynamicPage.clickDynamicButtonWithBrokenId('#recorded-dynamic-id-10492');

    expect(result.healed).toBe(true);
    expect(result.suggestion).toBeDefined();
    expect(result.suggestion!.confidence).toBeGreaterThanOrEqual(0.8);

    // Verify test annotation was pushed for developer visibility
    const healingAnnotation = testInfo.annotations.find(
      (a) => a.type === 'AI_SELF_HEALED_SELECTOR'
    );
    expect(healingAnnotation).toBeDefined();
    expect(healingAnnotation?.description).toContain('#recorded-dynamic-id-10492');

    // Verify healed event was persisted to healing-logs/healed-selectors.json
    const logPath = path.resolve(process.cwd(), 'healing-logs', 'healed-selectors.json');
    expect(fs.existsSync(logPath)).toBe(true);
  });

  test('heals a stale table action locator on /challenging-dom while blocking ad noise', async ({
    smartPage,
  }) => {
    const dynamicPage = new DynamicIdPage(smartPage);
    await dynamicPage.openChallengingDomPlayground();

    await expect(dynamicPage.getChallengingTableRows()).toHaveCount(10);

    const healResult = await dynamicPage.clickChallengingDomRowEditWithBrokenSelector(
      'Iuvaret0',
      'table#legacy-grid tr:nth-child(1) a.obsolete-edit'
    );

    expect(healResult.healed).toBe(true);
    expect(healResult.suggestion!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(healResult.usedSelector.toLowerCase()).toContain('edit');
  });
});
