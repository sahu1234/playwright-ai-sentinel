import { Locator } from '@playwright/test';
import { SmartPage, SmartActionResult } from '../fixtures/aiFixtures';

export class DynamicIdPage {
  private readonly smartPage: SmartPage;

  constructor(smartPage: SmartPage) {
    this.smartPage = smartPage;
  }

  async openDynamicIdPlayground(): Promise<void> {
    await this.smartPage.gotoPractice('/dynamic-id');
  }

  async openChallengingDomPlayground(): Promise<void> {
    await this.smartPage.gotoPractice('/challenging-dom');
  }

  /**
   * Intentionally uses a brittle legacy ID selector (`#legacy-recorded-id-99412`)
   * to demonstrate self-healing recovery on `/dynamic-id`.
   */
  async clickDynamicButtonWithBrokenId(
    brokenSelector = '#legacy-recorded-id-99412'
  ): Promise<SmartActionResult> {
    return this.smartPage.smartClick(
      brokenSelector,
      "Primary playground button labeled 'Button with Dynamic ID' on the Dynamic ID practice page"
    );
  }

  /**
   * Intentionally uses a stale selector on `/challenging-dom` to heal and click
   * the Edit action for row `Iuvaret0`.
   */
  async clickChallengingDomRowEditWithBrokenSelector(
    rowKey = 'Iuvaret0',
    brokenSelector = 'table#non-existent-grid tr.row-0 a.legacy-edit-btn'
  ): Promise<SmartActionResult> {
    return this.smartPage.smartClick(
      brokenSelector,
      `The 'Edit' action link inside the table row containing cell text '${rowKey}' on the Challenging DOM page`
    );
  }

  getHeading(): Locator {
    return this.smartPage.page.getByRole('heading', { level: 1 });
  }

  getChallengingTableRows(): Locator {
    return this.smartPage.page.locator('table tbody tr');
  }
}
