import { test, expect } from '../src/ai/fixtures/aiFixtures';
import { FormValidationPage } from '../src/ai/pages/FormValidationPage';
import { generateEdgeCasePersonas, evaluateSemanticOutcome } from '../src/ai/semanticJudge';

test.describe('LLM Persona Fuzzing & Semantic Judge Suite (@ai-fuzzing)', () => {
  test('generates edge-case personas and validates UI feedback via LLM-as-a-Judge on /form-validation', async ({
    smartPage,
  }, testInfo) => {
    const formPage = new FormValidationPage(smartPage);
    const personas = await generateEdgeCasePersonas(3);

    expect(personas.length).toBeGreaterThanOrEqual(2);

    for (const persona of personas) {
      await test.step(`Execute persona: ${persona.personaName}`, async () => {
        await formPage.open();
        await formPage.submitPersonaForm(persona);

        const actualUIText = await formPage.captureValidationFeedbackText();
        expect(actualUIText.length).toBeGreaterThan(0);

        const expectedBehavior = persona.expectedValid
          ? 'Form submission succeeds and displays a confirmation or thank you message for validating the ticket.'
          : 'Form submission is blocked and displays field-level validation prompts asking the user to provide valid contact details or payment method.';

        const verdict = await evaluateSemanticOutcome({
          scenario: `${persona.personaName} (${persona.rationale})`,
          expectedBehavior,
          actualUIText,
        });

        testInfo.annotations.push({
          type: 'AI_SEMANTIC_JUDGE',
          description: `[${persona.personaName}] Passed=${verdict.passed} (Score=${verdict.score}): ${verdict.reasoning}`,
        });

        expect(verdict.passed, `Semantic judge failed for ${persona.personaName}: ${verdict.reasoning}`).toBe(
          true
        );
      });
    }
  });
});
