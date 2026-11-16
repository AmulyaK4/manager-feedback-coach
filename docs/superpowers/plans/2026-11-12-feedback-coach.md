# Manager feedback coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a demoable local Python feedback coach and honest assessment documentation within 30 minutes.

**Architecture:** Stateless Python HTTP routes, curated context and editable coaching content. Browser controls speech and holds session transcript. Gemini is optional; scripted fallback is explicitly disclosed.

**Tech Stack:** Python 3.10+ standard library, HTML/CSS/JavaScript, Web Speech API, optional Gemini REST.

**Spec:** docs/superpowers/specs/2026-11-12-feedback-coach-design.md

## Global Constraints
- Only supplied synthetic attendance context; no real employee data.
- Live voice verification uses candidate's own voice; automated tests are not microphone evidence.
- No secrets in source/frontend; localhost only; no persistence or public publication.
- Written submission maximum two pages; separate probe results and README.

## Review Focus
- Confidential fields must not reach context or prompts (backend tests).
- Early debrief cannot fabricate quotes/objections (backend tests).
- Interruption must cancel playback, retain partial heard text and ignore stale response (browser logic inspection and controlled browser harness).
- Missing speech APIs/permission/key must produce honest visible instructions (browser smoke).
- Malformed inputs and external-provider failures must return actionable errors, not successful fake AI results (HTTP checks).

### Task 1: Python coaching and HTTP service (main agent)
Files: app.py, coach.py, data/employee_context.json, data/framework.json, tests/test_coach.py.
- [x] Write safety/grounding tests and observe failure for missing implementation.
- [x] Implement curated data, prepare/rehearse/debrief logic and optional Gemini REST; GET/POST routes from design contract.
- [x] Run unittest discovery, real local HTTP checks and probe export.

### Task 2: Browser experience (frontend agent, disjoint static/ ownership)
Files: static/index.html, static/app.js, static/style.css.
- [x] Implement context/modes/transcript/voice/interrupt/latency and export against contract.
- [x] Check JavaScript syntax and smoke browser flows; report real voice limitations.

### Task 3: Submission documents (docs agent, README and docs ownership excluding plans/specs)
Files: README.md, WRITEUP.md, docs/DEMO_GUIDE.md, docs/PROBE_RESULTS.md, .env.example, .gitignore.
- [x] Write reproducible run instructions and short design write-up; never invent evaluation results.
- [x] Main agent replaces pending probe results with executed evidence.

### Task 4: Integrate and review
- [x] Independent review of completed code against brief; address material defects.
- [x] Verify fresh copied checkout starts without dependencies; package private zip.
- [x] Open local app and provide run/demo handoff with limitations.

## Deadline ruling
User's 30-minute deadline makes a blocking series of design/plan approval questions impractical. Use already requested build scope and Python preference; document implementation choices and continue. Dependency-free server replaces proposed Flask because Flask is not installed. No external publication or messages.

## Final verification
16 Python checks pass; frontend39 assertions pass; clean source-copy starts without keys/dependencies. Live probe evidence retains provider resets and invalid readiness output; final validator rejects ready without employee agreement. Physical employee audio, P6 and acoustic latency remain unverified and explicitly documented. Packaging excludes.env and caches.
