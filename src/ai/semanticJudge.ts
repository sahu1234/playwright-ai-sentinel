import { completeJSON } from './aiClient';

export interface PersonaFuzzInput {
  personaName: string;
  contactName: string;
  contactNumber: string;
  pickupDate: string;
  paymentMethod: 'cash on delivery' | 'card' | '';
  expectedValid: boolean;
  rationale: string;
}

export interface SemanticAssertionVerdict {
  passed: boolean;
  score: number;
  reasoning: string;
}

const FALLBACK_PERSONAS: PersonaFuzzInput[] = [
  {
    personaName: 'Unicode & Hyphenated Name with Valid Formatted Phone',
    contactName: 'Jean-Luc Picard',
    contactNumber: '012-3456789',
    pickupDate: '2026-12-15',
    paymentMethod: 'card',
    expectedValid: true,
    rationale:
      'Matches ExpandTesting Contact Number pattern (3 digits - 7 digits) with valid name, date, and card payment.',
  },
  {
    personaName: 'SQL Injection & Malformed Phone Edge Case',
    contactName: "Robert'); DROP TABLE Students;--",
    contactNumber: '999-INVALID-PHONE',
    pickupDate: '2026-12-20',
    paymentMethod: 'cash on delivery',
    expectedValid: false,
    rationale:
      'Contact number violates the required 012-3456789 format, triggering Bootstrap invalid-feedback validation.',
  },
  {
    personaName: 'Missing Required Payment & Blank Contact Name',
    contactName: '',
    contactNumber: '12345',
    pickupDate: '',
    paymentMethod: '',
    expectedValid: false,
    rationale:
      'All required fields are either empty or improperly formatted, ensuring client-side validation blocks submission.',
  },
];

/**
 * Generates edge-case testing personas for `/form-validation` using the configured LLM,
 * with a deterministic fallback when running without a live inference endpoint.
 */
export async function generateEdgeCasePersonas(count = 3): Promise<PersonaFuzzInput[]> {
  const systemPrompt = `You are a Principal Security & Edge-Case QA Engineer.
Generate ${count} realistic edge-case test personas for a Bootstrap Form Validation page with these fields:
- contactName: non-empty string
- contactNumber: must match pattern "012-3456789" (3 digits, hyphen, 7 digits) to be valid
- pickupDate: YYYY-MM-DD date string
- paymentMethod: either "cash on delivery", "card", or "" (empty)

Include exactly 1 valid persona that satisfies all rules and ${count - 1} invalid boundary/fuzzing personas (e.g., malformed phone number, empty fields, injection strings).
Return strictly JSON in the format:
{
  "personas": [
    {
      "personaName": "string",
      "contactName": "string",
      "contactNumber": "string",
      "pickupDate": "YYYY-MM-DD",
      "paymentMethod": "cash on delivery" | "card" | "",
      "expectedValid": boolean,
      "rationale": "string"
    }
  ]
}`;

  try {
    const response = await completeJSON<{ personas: PersonaFuzzInput[] }>({
      systemPrompt,
      userPrompt: `Generate ${count} diverse form-validation personas now.`,
      temperature: 0.3,
    });

    if (Array.isArray(response.personas) && response.personas.length >= count) {
      return response.personas.slice(0, count);
    }
  } catch {
    // Use deterministic fallback personas if LLM endpoint is unreachable
  }

  return FALLBACK_PERSONAS.slice(0, count);
}

/**
 * LLM-as-a-Judge helper that evaluates whether the rendered UI feedback semantically
 * aligns with the expected validation outcome for a given persona.
 */
export async function evaluateSemanticOutcome(params: {
  scenario: string;
  expectedBehavior: string;
  actualUIText: string;
}): Promise<SemanticAssertionVerdict> {
  const systemPrompt = `You are an impartial LLM-as-a-Judge for automated UI testing.
Compare the "Expected Behavior" with the "Actual UI Text" captured from the page.
Return strictly JSON:
{
  "passed": boolean,
  "score": number,
  "reasoning": "Concise explanation of why the UI state matches or violates the expected semantic behavior"
}`;

  const userPrompt = `Scenario: ${params.scenario}
Expected Behavior: ${params.expectedBehavior}
Actual UI Text: ${params.actualUIText}`;

  try {
    const verdict = await completeJSON<SemanticAssertionVerdict>({
      systemPrompt,
      userPrompt,
      temperature: 0.0,
    });

    if (typeof verdict.passed === 'boolean' && typeof verdict.score === 'number') {
      return verdict;
    }
  } catch {
    // Deterministic semantic evaluation fallback
  }

  const normalizedActual = params.actualUIText.toLowerCase();
  const expectsSuccess =
    params.expectedBehavior.toLowerCase().includes('thank you') ||
    params.expectedBehavior.toLowerCase().includes('validating') ||
    params.expectedBehavior.toLowerCase().includes('success');

  if (expectsSuccess) {
    const passed =
      normalizedActual.includes('thank you for validating your ticket') ||
      normalizedActual.includes('looks good');
    return {
      passed,
      score: passed ? 0.95 : 0.2,
      reasoning: passed
        ? 'UI displays confirmation message confirming valid form submission.'
        : `Expected confirmation text not found in: "${params.actualUIText}"`,
    };
  }

  const hasValidationPrompt =
    normalizedActual.includes('please provide') ||
    normalizedActual.includes('please enter') ||
    normalizedActual.includes('please select');

  return {
    passed: hasValidationPrompt,
    score: hasValidationPrompt ? 0.94 : 0.15,
    reasoning: hasValidationPrompt
      ? 'UI surfaced informative field-level validation feedback rejecting invalid persona input.'
      : `Expected validation error prompts were missing from: "${params.actualUIText}"`,
  };
}
