# Streamlit hosting

This is the hosting path requested after the original local take-home was built. The user has authorized a public GitHub repository and Streamlit Community Cloud app for this portfolio deployment. That later request supersedes the original assessment's private/local-only delivery instructions for this deployment. Do not treat the historical local test results as evidence that the hosted build has passed.

**Deployment status:** source changes and hosting checks are in progress. A live URL, validated Cloud Python version, and passed cloud checks have not yet been confirmed. Python 3.13 should be selected only after the hosting validation run confirms it. No real API key belongs in this document.

## Two ways to run

The original local server remains available:

```sh
python3 app.py --port 8765
```

It serves the interface at `http://127.0.0.1:8765` and retains the original HTTP API flow. The new bridge asset is the only extra static route needed for hosting support. macOS can still generate local WAV speech with `say`.

The hosted entrypoint adds a Streamlit transport around the same interface and Python coaching functions:

```sh
python3 -m pip install -r requirements.txt
streamlit run streamlit_app.py
```

The hosted dependency is pinned to `streamlit==1.67.0` in `requirements.txt`. That dependency is for the Streamlit entrypoint; it does not change the original dependency-free `app.py` startup. Open the local address printed by Streamlit when testing the hosting path.

## Secrets

For local Streamlit development, keep secrets in `.streamlit/secrets.toml`. That file must be ignored by Git; verify the ignore before adding any value:

```sh
git check-ignore .streamlit/secrets.toml
```

Use this TOML structure, replacing the placeholder privately:

```toml
GEMINI_API_KEY = "replace_with_your_own_key"
GEMINI_MODEL = "gemini-3.5-flash-lite"
```

In Community Cloud, put the same fields in the app's **Secrets** settings. The user approved using the existing key as a private Streamlit secret. Do not copy it into repository files, frontend component arguments, screenshots, logs, or this guide. The hosting adapter reads secret values on the Python side; the browser receives engine/model labels, not credentials. The earlier `.env` remains a private local-server configuration file and must not be published.

## Community Cloud settings

Complete all account, GitHub, and Cloud actions in the user's **Amulya Chrome profile**. Use the intended account and these deployment values:

| Field | Value |
|---|---|
| Repository | `AmulyaK4/manager-feedback-coach` |
| Branch | `main` |
| Main file path | `streamlit_app.py` |
| Dependency file | Root `requirements.txt`, pinned `streamlit==1.67.0` |
| Secrets | Private TOML fields shown above |
| Python version | Select 3.13; local validation used Python 3.13.7 |
| Live URL | Pending successful deployment |

After setting secrets, deploy or reboot the app as required by the Cloud interface. Do not claim success from a completed upload alone: inspect the app's actual HTTPS page and complete the checks below. No paid plan or billing change is part of these instructions.

## How the adapter works

```text
Existing browser interface in a Streamlit component iframe
  -> sequential JavaScript request queue, each request with an ID
  -> Streamlit Python route dispatcher
  -> existing coaching/transcription functions
  -> response matched to the request ID in the iframe
```

The adapter lets the existing interface keep its voice controls, transcript, modes, and data boundaries. It dispatches only supported application routes rather than accepting arbitrary Python calls or file paths. The original `app.py` HTTP flow is still available separately.

Streamlit reruns Python when the component sends a value. A stable component identity keeps the iframe in place, and the frontend queue sends requests in sequence. Python's per-session duplicate-ID guard reuses the stored response instead of repeating the same provider request on a rerun. A changed request using an already-seen ID must be rejected. Aborted or stale responses must not appear as new conversation turns.

The conversation still lives in the browser iframe's memory. Reruns are intended to preserve it; reloading the page, remounting the component, or losing the browser session can discard it. The duplicate-response cache is also session-scoped and bounded to 128 entries; an evicted ID no longer has replay protection. This is not durable conversation storage or a durable audit log. Export a takeaway locally if you need to keep it.

## Hosted voice and provider use

Community Cloud runs Linux, so the hosted adapter selects **browser SpeechSynthesis**, not macOS `say` or its installed Rishi/Samantha voices. Available browser voices depend on the visitor's device. Mode announcements and standing simulation labels still distinguish coach and simulated employee. Use the voice-test/replay controls and check actual audible output.

Microphone recording requires a secure HTTPS page (localhost is the development exception), browser permission, and the explicit consent checkbox before sending the candidate's own practice audio to Google. The surrounding host and component iframe must both allow microphone access; the deployed page needs a real browser check. Browser recognition remains an alternative and can involve a vendor service.

**Scripted Demo changes coaching replies only.** With recorded input selected, Gemini transcription still receives the consented audio. The transcription request contains no employee context. The application does not add a backend recording history. The source scenario remains synthetic; do not upload real employee records or another person's recording.

The adapter admits **60 provider-backed requests per rolling hour and 2 concurrent requests**, shared across sessions in one server process. These configured values are confirmed in `streamlit_app.py` and `streamlit_backend.py` and covered by the adapter tests. The limiter counts admitted requests, including failures, rather than individual outbound provider calls. A transcription and a coaching response are separate requests, and a retry inside a request can make another provider call. These controls are **per-process**, reset when that process restarts, and are not a provider billing cap. They are not durable or distributed quota enforcement. Provider-side quotas remain separate.

## Verification before sharing

Local validation on 16 November 2026 used Python 3.13.7 and Streamlit 1.67.0. The complete Python suite passed 41 tests, the existing frontend lifecycle harness passed, and the new bridge harness passed 38 checks. Streamlit AppTest reported no exceptions and one registered component. A scripted Prepare request returned HTTP-style status 200 through the real Streamlit entrypoint; a subsequent rerun reused the cached response without another dispatch. The local Streamlit page and health endpoint both returned HTTP 200. The public deployment and real browser voice checks remain pending.

On the actual hosted HTTPS page, verify:

1. Context and framework load, with no secret in component arguments or responses.
2. A labelled scripted conversation works and survives ordinary Streamlit reruns without duplicate turns or repeated provider requests.
3. An available provider request returns the correct engine label; failures and any scripted substitution are disclosed.
4. Rate/concurrency rejection is visible and scripted text practice remains available where supported.
5. Microphone consent and permission work, then an own-voice turn is transcribed and an employee reply is audible.
6. The explicit interruption control stops playback, preserves honest transcript state, and ignores stale replies.
7. Debrief uses actual evidence and export produces a usable local takeaway.

Separate automated component checks, synthetic-audio calls, and human voice observations. A successful page load does not prove speech capture, audio playback, or P5/P6. Measure hosted time to first sound separately from provider HTTP timings. Add the live URL and final verification results only after they have been observed.
