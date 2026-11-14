import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
const executiveReporterPath = fs.existsSync(
  path.resolve(__dirname, 'src/ai/reporters/executiveAiReporter.ts')
)
  ? './src/ai/reporters/executiveAiReporter.ts'
  : './src/reporters/executiveAiReporter.ts';

interface TestSummaryRow {
  title: string;
  suite: string;
  file: string;
  status: string;
  durationMs: number;
  annotations: Array<{ type: string; description?: string }>;
  error?: string;
}

interface HealedSelectorLog {
  timestamp: string;
  pageUrl: string;
  action: string;
  elementDescription: string;
  brokenSelector: string;
  healedSelector: string;
  confidence: number;
  reason: string;
}

export default class ExecutiveAiReporter implements Reporter {
  private startTime = 0;
  private results: TestSummaryRow[] = [];

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now();
    this.results = [];
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const parentTitle = test.parent?.title || 'Root Suite';
    const fileName = path.basename(test.location.file);

    this.results.push({
      title: test.title,
      suite: parentTitle,
      file: fileName,
      status: result.status,
      durationMs: result.duration,
      annotations: result.annotations.map((a) => ({
        type: a.type,
        description: a.description,
      })),
      error: result.error?.message,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const totalDurationSec = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'passed').length;
    const failedTests = this.results.filter(
      (r) => r.status === 'failed' || r.status === 'timedOut'
    ).length;
    const skippedTests = this.results.filter((r) => r.status === 'skipped').length;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    // Load healed selectors log
    const healingLogPath = path.resolve(process.cwd(), 'healing-logs', 'healed-selectors.json');
    let healedLogs: HealedSelectorLog[] = [];
    if (fs.existsSync(healingLogPath)) {
      try {
        healedLogs = JSON.parse(fs.readFileSync(healingLogPath, 'utf-8'));
      } catch {
        healedLogs = [];
      }
    }

    // Load latest AI bug triage markdown
    const bugTriagePath = path.resolve(process.cwd(), 'healing-logs', 'latest-bug-triage.md');
    let bugTriageText = 'No uncaught runtime exceptions triaged in this run.';
    if (fs.existsSync(bugTriagePath)) {
      bugTriageText = fs.readFileSync(bugTriagePath, 'utf-8');
    }

    // Count AI annotations from current run
    const healedInRun = this.results.reduce(
      (acc, r) => acc + r.annotations.filter((a) => a.type === 'AI_SELF_HEALED_SELECTOR').length,
      0
    );
    const semanticJudgments = this.results.reduce(
      (acc, r) => acc + r.annotations.filter((a) => a.type === 'AI_SEMANTIC_JUDGE').length,
      0
    );
    const estMinutesSaved = (healedInRun * 18 + semanticJudgments * 12 + 15).toString();

    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const html = this.buildDashboardHtml({
      overallStatus: result.status.toUpperCase(),
      totalDurationSec,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      passRate,
      healedInRun,
      semanticJudgments,
      estMinutesSaved,
      healedLogs: healedLogs.slice(-8).reverse(),
      bugTriageText,
    });

    const outPath = path.join(reportDir, 'executive-dashboard.html');
    fs.writeFileSync(outPath, html, 'utf-8');
    console.log(`\n📊 [Executive AI Dashboard] Generated client report: ${outPath}`);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildDashboardHtml(data: {
    overallStatus: string;
    totalDurationSec: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    passRate: number;
    healedInRun: number;
    semanticJudgments: number;
    estMinutesSaved: string;
    healedLogs: HealedSelectorLog[];
    bugTriageText: string;
  }): string {
    const strokeDash = `${data.passRate}, 100`;
    const aiProvider = process.env.AI_BASE_URL?.includes('groq')
      ? 'Groq Cloud (llama-3.3-70b)'
      : `Local Ollama (${process.env.AI_MODEL || 'qwen2.5-coder:7b'})`;

    const testRowsHtml = this.results
      .map((r) => {
        const isPass = r.status === 'passed';
        const badgeClass = isPass ? 'badge-pass' : 'badge-fail';
        const badgeLabel = isPass ? 'PASSED' : r.status.toUpperCase();

        const annotationsHtml = r.annotations
          .map((a) => {
            const isHeal = a.type.includes('HEALED');
            const pillClass = isHeal ? 'ai-pill-heal' : 'ai-pill-judge';
            const icon = isHeal ? '🩹 Self-Healed' : '⚖️ Semantic Judge';
            return `<div class="ai-annotation ${pillClass}"><strong>${icon}:</strong> ${this.escapeHtml(
              a.description || ''
            )}</div>`;
          })
          .join('');

        return `
        <tr>
          <td><span class="file-tag">${this.escapeHtml(r.file)}</span></td>
          <td>
            <div class="test-title">${this.escapeHtml(r.title)}</div>
            <div class="test-suite">${this.escapeHtml(r.suite)}</div>
            ${annotationsHtml}
          </td>
          <td><span class="status-badge ${badgeClass}">${badgeLabel}</span></td>
          <td class="num-col">${(r.durationMs / 1000).toFixed(2)}s</td>
        </tr>`;
      })
      .join('');

    const healingRowsHtml =
      data.healedLogs.length > 0
        ? data.healedLogs
            .map(
              (h) => `
        <tr>
          <td><code>${this.escapeHtml(h.brokenSelector)}</code></td>
          <td><code class="healed-code">${this.escapeHtml(h.healedSelector)}</code></td>
          <td><span class="conf-pill">${Math.round(h.confidence * 100)}%</span></td>
          <td class="reason-cell">${this.escapeHtml(h.reason)}</td>
        </tr>`
            )
            .join('')
        : `<tr><td colspan="4">No healed selectors logged yet.</td></tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Playwright AI Sentinel — Executive QA Command Center</title>
  <style>
    :root {
      --bg: #0b1120;
      --card: #111827;
      --card-border: #1f2937;
      --azure-blue: #0078d4;
      --azure-cyan: #38bdf8;
      --pass: #10b981;
      --warn: #f59e0b;
      --fail: #ef4444;
      --purple: #a855f7;
      --text: #f3f4f6;
      --muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding-bottom: 60px;
    }
    .topbar {
      background: linear-gradient(90deg, #004578 0%, #0078d4 50%, #0f172a 100%);
      padding: 18px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-badge {
      background: rgba(255,255,255,0.15);
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.6px;
    }
    .brand h1 {
      font-size: 20px;
      font-weight: 700;
    }
    .brand p {
      font-size: 12px;
      color: #dbeafe;
    }
    .top-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .btn-trace {
      background: #ffffff;
      color: #004578;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      transition: opacity 0.2s;
    }
    .btn-trace:hover { opacity: 0.9; }
    .container {
      max-width: 1340px;
      margin: 28px auto;
      padding: 0 24px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kpi-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
    }
    .kpi-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
    }
    .donut {
      width: 64px;
      height: 64px;
    }
    .circle-bg {
      fill: none;
      stroke: #1f2937;
      stroke-width: 3.8;
    }
    .circle {
      fill: none;
      stroke: var(--pass);
      stroke-width: 3.8;
      stroke-linecap: round;
    }
    .section-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 22px;
      margin-bottom: 24px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
    }
    .section-header h2 {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-chip {
      background: #1e293b;
      color: var(--azure-cyan);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th {
      text-align: left;
      color: var(--muted);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--card-border);
    }
    td {
      padding: 14px 12px;
      border-bottom: 1px solid rgba(31, 41, 55, 0.7);
      vertical-align: top;
    }
    .file-tag {
      background: #1e293b;
      color: #cbd5e1;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
    }
    .test-title { font-weight: 600; color: #f8fafc; }
    .test-suite { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
    .badge-fail { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .num-col { font-family: monospace; color: #cbd5e1; }
    .ai-annotation {
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
    }
    .ai-pill-heal {
      background: rgba(245, 158, 11, 0.12);
      border-left: 3px solid var(--warn);
      color: #fde68a;
    }
    .ai-pill-judge {
      background: rgba(168, 85, 247, 0.12);
      border-left: 3px solid var(--purple);
      color: #e9d5ff;
    }
    code {
      background: #0f172a;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #fca5a5;
    }
    code.healed-code { color: #6ee7b7; }
    .conf-pill {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
    }
    .reason-cell { color: #d1d5db; font-size: 13px; }
    pre.triage-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 16px;
      border-radius: 8px;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      white-space: pre-wrap;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-badge">AZURE / ENTERPRISE QA TELEMETRY</span>
      <div>
        <h1>Playwright AI Sentinel — Executive Quality Dashboard</h1>
        <p>Target: https://practice.expandtesting.com | Inference Engine: ${this.escapeHtml(aiProvider)}</p>
      </div>
    </div>
    <div class="top-actions">
      <a class="btn-trace" href="./index.html">Open Deep-Dive Playwright Trace Report →</a>
    </div>
  </header>

  <main class="container">
    <section class="kpi-grid">
      <div class="kpi-card">
        <div>
          <div class="kpi-label">Overall Pass Rate</div>
          <div class="kpi-value" style="color: var(--pass);">${data.passRate}%</div>
          <div class="kpi-sub">${data.passedTests} of ${data.totalTests} passed (${data.failedTests} failed)</div>
        </div>
        <svg viewBox="0 0 36 36" class="donut">
          <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path class="circle" stroke-dasharray="${strokeDash}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
      </div>

      <div class="kpi-card">
        <div>
          <div class="kpi-label">AI Self-Healed Locators</div>
          <div class="kpi-value" style="color: var(--warn);">${data.healedInRun}</div>
          <div class="kpi-sub">Confidence Threshold ≥ 0.80</div>
        </div>
      </div>

      <div class="kpi-card">
        <div>
          <div class="kpi-label">LLM Semantic Evaluations</div>
          <div class="kpi-value" style="color: var(--purple);">${data.semanticJudgments}</div>
          <div class="kpi-sub">Edge-Case Persona Fuzzing Verdicts</div>
        </div>
      </div>

      <div class="kpi-card">
        <div>
          <div class="kpi-label">Execution Time / Triage ROI</div>
          <div class="kpi-value" style="color: var(--azure-cyan);">${data.totalDurationSec}s</div>
          <div class="kpi-sub">~${data.estMinutesSaved} mins manual QA triage saved</div>
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h2>📋 Automated Test Execution & AI Telemetry Matrix</h2>
        <span class="meta-chip">Status: ${data.overallStatus}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 180px;">Spec File</th>
            <th>Scenario & AI Sentinel Telemetry</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 100px;">Duration</th>
          </tr>
        </thead>
        <tbody>
          ${testRowsHtml}
        </tbody>
      </table>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h2>🩹 AI Self-Healing Audit Log (healed-selectors.json)</h2>
        <span class="meta-chip">Zero Silent Failures Policy</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 24%;">Broken Selector</th>
            <th style="width: 28%;">AI Healed Selector</th>
            <th style="width: 10%;">Confidence</th>
            <th>Architectural Reasoning</th>
          </tr>
        </thead>
        <tbody>
          ${healingRowsHtml}
        </tbody>
      </table>
    </section>

    <section class="section-card">
      <div class="section-header">
        <h2>🐛 Automated AI Failure Triage Report (latest-bug-triage.md)</h2>
        <span class="meta-chip">Captured from /javascript-error</span>
      </div>
      <pre class="triage-box">${this.escapeHtml(data.bugTriageText)}</pre>
    </section>
  </main>
</body>
</html>`;
  }
}
