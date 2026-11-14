import * as fs from 'fs';
import * as path from 'path';
import { completeJSON } from './aiClient';

export interface TelemetryFailureInput {
  testTitle: string;
  pageUrl: string;
  pageErrors: string[];
  consoleErrors: string[];
  domExcerpt?: string;
}

export interface StructuredBugReport {
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  rootCause: string;
  reproductionSteps: string[];
  suggestedFix: string;
  markdownReport: string;
}

const TRIAGE_OUTPUT_PATH = path.resolve(process.cwd(), 'healing-logs', 'latest-bug-triage.md');

/**
 * Parses uncaught page errors, console logs, and test context into a structured
 * developer-ready Markdown bug report using the configured LLM.
 */
export async function summarizeFailureToMarkdown(
  input: TelemetryFailureInput
): Promise<StructuredBugReport> {
  const systemPrompt = `You are a Staff QA Architect triaging a frontend runtime error captured during Playwright execution.
Analyze the uncaught JavaScript exceptions and console errors, and return strictly JSON matching this schema:
{
  "title": "Concise bug title",
  "severity": "High",
  "rootCause": "Technical explanation of why the JavaScript exception occurred",
  "reproductionSteps": ["Step 1", "Step 2"],
  "suggestedFix": "Code-level recommendation (e.g., null-check, optional chaining, or DOMContentLoaded guard)"
}`;

  const userPrompt = `Test Title: ${input.testTitle}
Page URL: ${input.pageUrl}
Uncaught Page Errors:
${input.pageErrors.join('\n') || 'None'}

Console Errors:
${input.consoleErrors.join('\n') || 'None'}

DOM Excerpt:
${input.domExcerpt || 'N/A'}`;

  let parsed: Omit<StructuredBugReport, 'markdownReport'> | undefined;

  try {
    const llmResult = await completeJSON<Omit<StructuredBugReport, 'markdownReport'>>({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
    });

    if (llmResult && llmResult.title && llmResult.rootCause) {
      parsed = {
        title: llmResult.title,
        severity: llmResult.severity || 'High',
        rootCause: llmResult.rootCause,
        reproductionSteps: Array.isArray(llmResult.reproductionSteps)
          ? llmResult.reproductionSteps
          : [`Navigate to ${input.pageUrl}`, 'Inspect browser console on window.onload'],
        suggestedFix:
          llmResult.suggestedFix ||
          'Guard property access with optional chaining or verify element existence before reading properties.',
      };
    }
  } catch {
    // Fallback deterministic parser when LLM is offline
  }

  if (!parsed) {
    const primaryError =
      input.pageErrors[0] || input.consoleErrors[0] || 'Uncaught TypeError in window.onload handler';
    parsed = {
      title: `Uncaught Runtime Exception on ${input.pageUrl}: ${primaryError.slice(0, 80)}`,
      severity: 'High',
      rootCause: `During the page onload lifecycle at ${input.pageUrl}, the script attempted to read or assign a property on an undefined reference (${primaryError}).`,
      reproductionSteps: [
        `Open Chromium and attach a pageerror listener.`,
        `Navigate to ${input.pageUrl}.`,
        `Observe the synchronous exception thrown during body onload execution.`,
      ],
      suggestedFix:
        'Add defensive null/undefined checks (or optional chaining `?.`) in the `loadError()` / `window.onload` handler before accessing nested DOM or object properties.',
    };
  }

  const markdownReport = [
    `# 🐛 AI Bug Triage Report: ${parsed.title}`,
    ``,
    `- **Test Case:** \`${input.testTitle}\``,
    `- **Target URL:** ${input.pageUrl}`,
    `- **Severity:** **${parsed.severity}**`,
    `- **Captured Timestamp:** ${new Date().toISOString()}`,
    ``,
    `## 1. Telemetry & Uncaught Exceptions`,
    '```text',
    ...(input.pageErrors.length ? input.pageErrors : ['(No uncaught pageerror events)']),
    ...(input.consoleErrors.length ? input.consoleErrors : []),
    '```',
    ``,
    `## 2. Root Cause Analysis`,
    `${parsed.rootCause}`,
    ``,
    `## 3. Steps to Reproduce`,
    ...parsed.reproductionSteps.map((step, idx) => `${idx + 1}. ${step}`),
    ``,
    `## 4. Recommended Engineering Fix`,
    `${parsed.suggestedFix}`,
    ``,
  ].join('\n');

  const dir = path.dirname(TRIAGE_OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TRIAGE_OUTPUT_PATH, markdownReport, 'utf-8');

  return {
    ...parsed,
    markdownReport,
  };
}
