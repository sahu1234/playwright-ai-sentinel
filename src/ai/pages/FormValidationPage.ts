import { Locator } from '@playwright/test';
import { SmartPage } from '../fixtures/aiFixtures';
import { PersonaFuzzInput } from '../semanticJudge';

export class FormValidationPage {
    private readonly smartPage: SmartPage;

    constructor(smartPage: SmartPage) {
        this.smartPage = smartPage;
    }

    async open(): Promise<void> {
        await this.smartPage.gotoPractice('/form-validation');
    }

    get contactNameInput(): Locator {
        return this.smartPage.page.locator('input[name="ContactName"]');
    }

    get contactNumberInput(): Locator {
        return this.smartPage.page.locator('input[name="contactnumber"]');
    }

    get pickupDateInput(): Locator {
        return this.smartPage.page.locator('input[name="pickupdate"]');
    }

    get paymentMethodSelect(): Locator {
        return this.smartPage.page.locator('select[name="payment"]');
    }

    get registerButton(): Locator {
        return this.smartPage.page.locator('button[type="submit"], button:has-text("Register")');
    }

    async submitPersonaForm(persona: PersonaFuzzInput): Promise<void> {
        await this.contactNameInput.fill(persona.contactName);
        await this.contactNumberInput.fill(persona.contactNumber);

        if (persona.pickupDate) {
            await this.pickupDateInput.fill(persona.pickupDate);
        } else {
            await this.pickupDateInput.fill('');
        }

        if (persona.paymentMethod) {
            await this.paymentMethodSelect.selectOption(persona.paymentMethod);
        }

        await this.registerButton.first().click();
    }

    /**
     * Collects visible validation messages or confirmation alert text after form submission.
     */
    async captureValidationFeedbackText(): Promise<string> {
        const page = this.smartPage.page;
        const feedbackLocator = page.locator('[role="alert"], .invalid-feedback:visible').first();

        await feedbackLocator.waitFor({ state: 'visible', timeout: 10_000 });

        const alertText = (await page.getByRole('alert').allInnerTexts()).join(' ').trim();
        const invalidText = (await page.locator('.invalid-feedback:visible').allInnerTexts())
            .join(' | ')
            .trim();

        return [alertText, invalidText].filter(Boolean).join(' || ');
    }

}
