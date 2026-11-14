# 🛡️ Playwright AI Sentinel (`playwright-ai-sentinel`)

[[https://img.shields.io/badge/Playwright-1.49+-2EAD33?logo=playwright&logoColor=white]](https://playwright.dev/)
[[https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?logo=typescript&logoColor=white]](https://www.typescriptlang.org/)
[[https://img.shields.io/github/actions/workflow/status/your-username/playwright-ai-sentinel/ai-qa-showcase.yml?branch=main&label=AI%20QA%20Pipeline&logo=github]](https://github.com/your-username/playwright-ai-sentinel/actions)
[[https://img.shields.io/badge/LLM-Ollama%20%7C%20Groq-FF6F00]](https://groq.com/)

> **Live Interactive Report & AI Healing Telemetry:**  
> 🔗 **[View Latest Playwright HTML Report & AI Healing Summary on GitHub Pages](https://your-username.github.io/playwright-ai-sentinel/)**

An enterprise-grade, **Zero-Cost AI-Augmented QA Automation Framework** built with **Playwright + TypeScript** targeting [ExpandTesting](https://practice.expandtesting.com/). Designed to showcase practical, production-safe AI patterns in end-to-end testing without recurring SaaS or token bills.

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
|  https://practice.expandtesting.com|        |  • healer.ts: Clones body, strips <script>/<svg>, |
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
                                              |  [GitHub CI] Groq Cloud (api.groq.com/openai/v1)  |
                                              |              Model: llama-3.3-70b-versatile       |
                                              +---------------------------------------------------+
```

## ⚡ 2-Command Zero-Cost Local Quickstart (via Ollama)

1. **Pull the local coding model in [Ollama](https://ollama.com/):**
   ```bash
   ollama run qwen2.5-coder:7b
   ```
2. **Install dependencies and run the AI-Augmented Playwright suite:**
   ```bash
   npm ci && npx playwright install chromium && npm run test:heal
   ```

## 🧠 Key Engineering Trade-offs & Guardrails

1. **Confidence Threshold Gating (`confidence >= 0.80`):**  
   Blindly accepting LLM-suggested selectors causes false positives by clicking arbitrary buttons. `src/ai/healer.ts` enforces structured JSON output (`{ newSelector, confidence, reason }`) and immediately aborts healing if `confidence < 0.80`.
2. **Aggressive DOM Token Stripping (`extractCleanedDOM`):**  
   Sending raw full-page HTML to an LLM overflows context windows and increases latency. Before inference, `healer.ts` clones `document.body` in-browser and removes `<script>`, `<style>`, `<svg>`, `<noscript>`, and `<iframe>` nodes, reducing payload size by ~75–85%.
3. **No Silent Green Tests (Auditability First):**  
   Self-healing should never hide technical debt. Every healed selector writes structured telemetry to `healing-logs/healed-selectors.json` and pushes a `test.info().annotations` warning (`AI_SELF_HEALED_SELECTOR`) directly into the Playwright HTML report so engineers can patch the permanent Page Object selector.
4. **Zero-Cost CI/CD Cost Controls:**  
   Developers iterate locally at $0 using Ollama (`qwen2.5-coder:7b`). In GitHub Actions, the same `openai` SDK switches via environment variables to Groq's free-tier `llama-3.3-70b-versatile` endpoint, with a deterministic structural fallback so CI pipelines remain resilient even if rate-limited.
5. **Deterministic Ad & Tracker Blocking:**  
   Public practice portals inject Google AdSense overlays that cause random layout shifts and navigation timeouts. `aiFixtures.ts` aborts `googlesyndication`, `doubleclick`, and `google-analytics` requests at the browser context level.

## 📋 Sample AI Healing Log Output (`healing-logs/healed-selectors.json`)

```json
[
  {
    "timestamp": "2026-11-14T05:00:00.000Z",
    "pageUrl": "https://practice.expandtesting.com/dynamic-id",
    "action": "click",
    "elementDescription": "Primary playground button labeled 'Button with Dynamic ID'",
    "brokenSelector": "#recorded-dynamic-id-10492",
    "healedSelector": "button.btn-primary:has-text('Button with Dynamic ID')",
    "confidence": 0.96,
    "reason": "The button ID is dynamically generated per request, whereas the class 'btn-primary' and visible label 'Button with Dynamic ID' remain deterministic."
  }
]
```
