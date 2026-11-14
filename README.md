# 🛡️ Playwright AI Sentinel

<p align="left">
  <a href="https://github.com/sahu1234/playwright-ai-sentinel/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/sahu1234/playwright-ai-sentinel/ai-qa-showcase.yml?branch=main&label=AI%20QA%20Pipeline&logo=github" alt="GitHub Actions" />
  </a>
  <a href="https://playwright.dev/">
    <img src="https://img.shields.io/badge/Playwright-1.49+-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  </a>
  <a href="https://groq.com/">
    <img src="https://img.shields.io/badge/LLM-Ollama%20%7C%20Groq-FF6F00" alt="Zero-Cost AI" />
  </a>
</p>


> **Live Interactive Reports (Auto-Deployed via GitHub Actions):**  
> 📊 **[View Executive AI Command Center Dashboard](https://sahu1234.github.io/playwright-ai-sentinel/executive-dashboard.html)**  
> 🔍 **[View Deep-Dive Playwright Trace & HTML Report](https://sahu1234.github.io/playwright-ai-sentinel/)**

An enterprise-grade, **Zero-Cost AI-Augmented QA Automation Framework** built with **Playwright + TypeScript** targeting [ExpandTesting](https://practice.expandtesting.com/). Designed to showcase practical, production-safe AI patterns in end-to-end testing without recurring SaaS or token bills.

## ✨ Core Capabilities

- **🩹 Self-Healing Locators (`src/ai/healer.ts`):** Attempts fast native Playwright actions first (`3000ms`), strips noisy tags (`<script>`, `<style>`, `<svg>`), queries the LLM for a resilient replacement, enforces `confidence >= 0.80`, and surfaces broken selectors via `test.info().annotations` + `healing-logs/healed-selectors.json`.
- **⚖️ LLM-as-a-Judge & Persona Fuzzing (`src/ai/semanticJudge.ts`):** Dynamically generates boundary and injection test personas for `/form-validation` and semantically evaluates rendered UI feedback.
- **⚡ Hybrid REST API + React UI Testing (`tests/hybrid-api-ui.spec.ts`):** Seeds authenticated test data directly via the ExpandTesting Notes REST API (`/notes/api`) and verifies rendering in the React Notes UI (`/notes/app`) with zero UI setup overhead.
- **🐛 Automated AI Failure Triage (`src/ai/failureSummarizer.ts`):** Captures uncaught `pageerror` and console exceptions on `/javascript-error` and generates developer-ready Markdown bug reports (`healing-logs/latest-bug-triage.md`).
- **📊 Azure-Style Executive Dashboard & JUnit XML (`src/reporters/executiveAiReporter.ts`):** Generates a dark-mode client KPI dashboard (`executive-dashboard.html`) with pass-rate donut charts, self-healing diffs, semantic verdicts, and Azure DevOps-compatible `junit-results.xml`.

## 🏗️ System Architecture

```text
+-----------------------------------------------------------------------------------+
|                           PLAYWRIGHT TEST RUNNER (TS)                             |
|  +-------------------+  +-------------------+  +---------------+  +------------+  |
|  | self-healing.spec |  |  ai-fuzzing.spec  |  | hybrid-api-ui |  |  failure-  |  |
|  |  (/dynamic-id &   |  | (/form-validation |  | (/notes/api + |  | triage.spec|  |
|  | /challenging-dom) |  |  persona fuzzing) |  |  /notes/app)  |  | (/js-error)|  |
|  +---------+---------+  +---------+---------+  +-------+-------+  +-----+------+  |
|            |                      |                    |                |         |
|            +----------------------+--------------------+----------------+         |
|                                   |                                               |
|                                   v                                               |
|  +-----------------------------------------------------------------------------+  |
|  |                CUSTOM FIXTURE LAYER (src/fixtures/aiFixtures.ts)            |  |
|  |  • Network Interceptor: Aborts googlesyndication, doubleclick, analytics    |  |
|  |  • SmartPage Wrapper: smartClick() / smartFill() with 3000ms fast try       |  |
|  +--------------------------------+--------------------------------------------+  |
+-----------------------------------|-----------------------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                                                       |
        v (Fast Action Succeeds)                                v (Locator Timeout & AI_HEAL=true)
+-------+----------------------------+        +-----------------+---------------------------------+
|   TARGET APPLICATION UNDER TEST    |        |            AI SENTINEL LAYER (src/ai/)            |
|  [https://practice.expandtesting.com](https://practice.expandtesting.com)|        |  • healer.ts: Clones body, strips <script>/<svg>, |
|  • /dynamic-id & /challenging-dom  |        |    enforces JSON schema & confidence >= 0.80      |
|  • /form-validation                |        |  • semanticJudge.ts: Persona generation & judge   |
|  • /notes/api & /notes/app (React) |        |  • failureSummarizer.ts: JS error -> Bug MD       |
|  • /javascript-error               |        +-----------------+---------------------------------+
+------------------------------------+                          |
                                                                v (OpenAI SDK via Env Vars)
                                              +-----------------+---------------------------------+
                                              |         ZERO-COST DUAL INFERENCE ENGINE           |
                                              |  [Local Dev] Ollama (http://localhost:11434/v1)   |
                                              |              Model: qwen2.5-coder:7b              |
                                              |  [GitHub CI] Groq Cloud ([api.groq.com/openai/v1](https://api.groq.com/openai/v1))  |
                                              |              Model: llama-3.3-70b-versatile       |
                                              +---------------------------------------------------+
                                                                |
                                                                v
                                              +---------------------------------------------------+
                                              |     EXECUTIVE REPORTING & AZURE DEVOPS READY      |
                                              |  • playwright-report/executive-dashboard.html     |
                                              |  • playwright-report/index.html (Traces & Video)  |
                                              |  • test-results/junit-results.xml (ADO Pipelines) |
                                              +---------------------------------------------------+
```

## ⚡ 2-Command Zero-Cost Local Quickstart (via Ollama)

1. **Pull and start the local coding model in [Ollama](https://ollama.com/):**
   ```bash
   ollama run qwen2.5-coder:7b
   ```
2. **Install dependencies, run the AI-Augmented suite, and open the Executive Dashboard:**
   ```bash
   npm ci && npx playwright install chromium && npm run test:heal
   ```
   Open `playwright-report/executive-dashboard.html` in your browser (or run `npm run report` for the Playwright trace viewer).

## 🧠 Key Engineering Trade-offs & Guardrails

1. **Confidence Threshold Gating (`confidence >= 0.80`):**  
   Blindly accepting LLM-suggested selectors causes false positives by clicking arbitrary buttons. `src/ai/healer.ts` enforces structured JSON output (`{ newSelector, confidence, reason }`), verifies the element exists in the live DOM, and aborts healing if `confidence < 0.80`.
2. **Aggressive DOM Token Stripping (`extractCleanedDOM`):**  
   Sending raw full-page HTML overflows context windows and adds latency. Before inference, `healer.ts` clones `document.body` in-browser and removes `<script>`, `<style>`, `<svg>`, `<noscript>`, and `<iframe>` nodes, reducing payload size by ~75–85%.
3. **No Silent Green Tests (Auditability First):**  
   Self-healing should never hide technical debt. Every healed selector writes structured telemetry to `healing-logs/healed-selectors.json` and pushes a `test.info().annotations` warning (`AI_SELF_HEALED_SELECTOR`) directly into both the Playwright HTML report and Executive Dashboard.
4. **Zero-Cost CI/CD Cost Controls:**  
   Developers iterate locally at $0 using Ollama (`qwen2.5-coder:7b`). In GitHub Actions, the same `openai` SDK switches via environment variables to Groq's free-tier `llama-3.3-70b-versatile` endpoint, with a deterministic structural fallback so CI pipelines stay resilient even offline or rate-limited.
5. **Deterministic Ad & Tracker Blocking:**  
   Public practice portals inject third-party ad overlays that cause random layout shifts and timeouts. `aiFixtures.ts` aborts `googlesyndication`, `doubleclick`, and `google-analytics` requests at the browser context level.

## 📋 Sample AI Healing Log Output (`healing-logs/healed-selectors.json`)

```json
[
  {
    "timestamp": "2026-11-14T05:00:00.000Z",
    "pageUrl": "[https://practice.expandtesting.com/dynamic-id](https://practice.expandtesting.com/dynamic-id)",
    "action": "click",
    "elementDescription": "Primary playground button labeled 'Button with Dynamic ID'",
    "brokenSelector": "#recorded-dynamic-id-10492",
    "healedSelector": "button:has-text('Button with Dynamic ID')",
    "confidence": 0.96,
    "reason": "The button ID is dynamically generated per request, whereas the visible label 'Button with Dynamic ID' remains deterministic."
  }
]
```
