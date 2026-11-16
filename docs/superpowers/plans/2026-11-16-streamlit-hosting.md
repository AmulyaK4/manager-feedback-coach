# Streamlit Hosting Implementation Plan

> **For agentic workers:** Use the existing implementation and verification workflows; keep the original local app functional.

**Goal:** Host the existing manager-feedback-coach interface and Python behavior on Streamlit Community Cloud.

**Architecture:** A stable Streamlit custom component renders the existing static interface. A small JavaScript transport relays the existing API requests to a validated Python dispatcher and returns responses without putting secrets in the browser.

**Tech Stack:** Existing Python standard library and browser JavaScript, plus a pinned Streamlit dependency.

**Spec:** `docs/superpowers/specs/2026-11-16-streamlit-hosting-design.md`

## Global constraints

- Use only the Amulya Chrome profile for account and hosting UI actions.
- Preserve the local `python3 app.py --port 8765` behavior and existing project files.
- Never commit, print, or pass secrets to the custom component.
- Keep the hosted app's API use bounded and clearly identify scripted responses.
- Use only free hosting; the user completes authentication, terms acceptance, and permission grants.

## Tasks

- [x] Add and test the validated Python component dispatcher, request deduplication, and provider-use limits.
- [x] Add and test the browser component bridge with request IDs, sequential dispatch, cancellation, and stable rerender behavior.
- [x] Add a Streamlit entrypoint, pin Streamlit, and ignore `.streamlit/secrets.toml`.
- [x] Replace localhost-only browser guidance with wording that also applies to the HTTPS hosted app; retain local instructions in the README.
- [x] Run existing and adapter-focused tests, then start Streamlit locally and verify its page, health endpoint, and entrypoint request/rerun behavior. A real browser microphone/audio check remains separate.
- [x] Show the new commit file list, rescan staged content for secrets, commit, and publish to the verified AmulyaK4 repository.
- [x] Configure and deploy Community Cloud through the Amulya Chrome profile after the user completes account steps.
- [x] Configure the approved Gemini secret privately and verify the hosted Context, model label, backend health and assets. Live URL: https://amulya-manager-feedback-coach.streamlit.app/ . Full own-voice rehearsal and human audibility remain manual checks.
