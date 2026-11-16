# Streamlit hosting design

The user requests a public hosted portfolio demo on Streamlit Community Cloud and requires all account actions in the Amulya Chrome profile. The existing local app must remain available without a rewrite. The user explicitly approved storing the existing Gemini key as a private Streamlit app secret; no key may enter Git history, component arguments, or logs.

## Approach

Add a Streamlit entrypoint and a small bidirectional component transport around the existing HTML/JavaScript interface. Keep `app.py`, the coaching policy, curated data, and audio-transcription implementation reusable. The original HTTP transport continues to work when the interface is opened through the local server. Streamlit's component iframe communicates with Python using request IDs, a sequential queue, response messages, and session-scoped deduplication.

A plain static deployment cannot run the Python APIs. Rebuilding the interface with Streamlit widgets would duplicate existing interaction and voice state, so the component adapter is the smaller change. Render was considered but the user explicitly chose Streamlit.

## Hosted behavior

- Context, Prepare, Rehearse, and Debrief retain the existing interface and policies.
- The hosted entrypoint uses browser speech output, because Community Cloud runs Linux and cannot run macOS `say`.
- Microphone recording and consent remain in the frontend; only consented recordings reach Gemini.
- The component dispatches only the existing application routes, validates request shape and size, and never accepts arbitrary Python calls or filesystem paths.
- Provider-backed calls have process-wide rate and concurrency limits. These reduce accidental or anonymous quota consumption but are not a durable billing cap; provider-side quota controls remain relevant.
- The browser owns conversational history. Streamlit reruns must not repeat provider requests or reset the component iframe for each turn.
- Private `.streamlit/secrets.toml` files are ignored. Only dependency and non-secret deployment configuration is committed.

## Verification

Run the existing Python suite and frontend harness. Add focused tests for component route validation, duplicate request handling, body limits, error redaction, rate/concurrency controls, and browser bridge queue/abort/response behavior. Start Streamlit locally and verify the app and component assets. After deployment verify the public HTTPS page, same-interface startup, a scripted turn, and (if provider availability allows) a synthetic live turn. Real microphone audibility and interruption must be reported separately from automated checks.

Account terms, verification codes, passwords, or new OAuth permission grants are completed by the user in the Amulya Chrome profile. No paid service or payment details are authorized.
