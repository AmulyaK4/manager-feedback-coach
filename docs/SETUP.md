# Setup and technical notes

A private, local prototype for practising one difficult conversation: repeated lateness. Review the selected context, prepare with Situation–Behaviour–Impact, rehearse as a spoken conversation with a simulated Rohit, then leave with a readiness call and words to use tomorrow.

The supplied employee record is synthetic. **Rohit's responses are simulated possibilities, not predictions or evidence about a person.** The application is coaching practice, not legal advice or an employment decision system.

## Run

Requirements: Python **3.10 or newer**, desktop **Google Chrome**, a microphone, headphones, and internet access. Preferred recorded input uses Gemini transcription when a key is configured; browser recognition remains an alternative. There are **no third-party Python dependencies** and no build step. Speech recognition may use the browser vendor's online service; running this website locally does not make speech processing local or private. See [MDN's SpeechRecognition documentation](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

From the project directory:

```sh
python3 app.py --port 8765
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765) in Chrome. Keep the terminal running. Allow the site's microphone request. Stop the server with `Ctrl+C`.

Without an API key the app uses its **explicitly labelled scripted engine**. This demonstrates the flow and its safety boundaries; it is not evidence of a live model's conversation quality. If Gemini fails during Rehearse, the app supplies a clearly labelled scripted reply so practice can continue. The provider error remains visible and the response turn records its actual engine. This fallback is not successful model evaluation. Prepare provider errors remain visible; invalid model debriefs use a disclosed grounded fallback.

The header's **Session engine** selector defaults to **Auto**, which uses configured Gemini when a key is present. Choose **Scripted Demo** explicitly to use rule-based coaching replies, including when provider requests fail. **Recorded input still calls Gemini for transcription**, even in Scripted Demo; the selector only changes the coaching engine. This selection applies to Prepare, Rehearse, and Debrief; returned turns retain their engine/model labels. Browser speech recognition may still require its vendor's network service. Start a fresh rehearsal when changing engines so evaluation results remain interpretable.

To enable the optional model, copy the example only in a fresh checkout and edit the resulting file locally:

```sh
cp .env.example .env
```

```dotenv
GEMINI_API_KEY=replace_with_your_own_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Keep the real key in `.env` or the server's environment. Do not put it in JavaScript, screenshots, exports, or a repository. `.env` is ignored by Git. The backend reads configuration for each request, so changing the file does not require restarting the server. Reload the context screen after changing engines and start a new rehearsal before comparing results.

Gemini uses the [generateContent REST API](https://ai.google.dev/api/generate-content). The configured model is [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), used for efficient, short text turns. A minimal live request succeeded with this model during integration; the earlier `gemini-2.5-flash` availability check returned HTTP 404. The preferred input records audio for Gemini transcription; Python generates local speech output on macOS. This is not native model voice. Check availability with your account before the demo, and rerun the probes after changing `GEMINI_MODEL`; results from one model do not establish another model's behavior. This prototype does not promise free API access or a particular price.

## Use

1. Read **Context**. It shows the attendance evidence used in this scenario and the important unknowns. Check that the engine label is the one you intend to demonstrate.
2. In **Prepare**, describe the conversation you want to have. The coach teaches the editable framework and challenges labels, confidential-data requests, and a predetermined dismissal goal.
3. In **Rehearse**, select voice input. With a key configured, the preferred path uses the browser's MediaRecorder: first check the explicit consent to send your own practice audio to Google, start speaking, then use **Stop & send**. Python sends the recording to Gemini for verbatim transcription and then uses its text for the coaching turn. Each recording is limited to 60 seconds and 3 MB; audio is held in memory, with no backend recording history. The transcription request contains no employee context. Browser recognition remains an alternative. On this Mac, Python generates employee WAV audio with the male **Rishi** voice and coach audio with female **Samantha**; the browser plays a visible audio element. Other hosts use the browser's [SpeechSynthesis API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).
4. To interrupt, use the microphone/interrupt control while Rohit is speaking, then speak your next turn. This is **explicit interruption by a button**, not automatic detection of someone talking over playback. Inspect the transcript's interrupted-response marker.
5. Open **Debrief** for the readiness call, actual transcript quotes, a revised opening, and objection responses. A very short rehearsal may have insufficient evidence; the app should say so. Export the takeaway locally if you want to keep it.

Typing in Rehearse is a troubleshooting aid. A typed session is not a completed voice evaluation. Use your own voice only when testing; do not record another person.

## Data and limits

- `data/employee_context.json` is the curated attendance context. The source record's confidential 360 feedback, HR notes, compensation, performance ratings, and unrelated goals are deliberately absent from application context and prompts. The raw source record is not required at runtime.
- `data/framework.json` holds editable coaching content so framework wording can change without editing Python or JavaScript. Keep valid JSON and preserve the existing structure.
- The supplied rolling 90-day figures have no reference date. Individual incident dates and concrete business impact are not supplied. Check the underlying record before a real conversation; do not infer that lateness caused missed targets.
- A simulated employee may offer a hypothetical concern to practise listening. Treat it as invented rehearsal material, never a newly discovered employee fact. Agreement should follow what the manager says, with no fixed minimum number of turns.
- The transcript lives in browser memory. There is no account, history database, or server-side session store. Reloading loses the session; an exported file remains on your device. Model-enabled requests send selected context and transcript text to Google. Browser speech processing can involve a separate provider.
- The server binds to `127.0.0.1`. It is a local demonstration server, not a production deployment.
- The practice manager is **Aditi Rao**, matching the supplied record. The application reads the manager name from the employee context file. Male Rishi employee output, female Samantha coach output, mode announcements, and standing simulation labels distinguish roles. The per-reply “Simulated Rohit speaking” prefix was deliberately removed. Other-platform voices vary. Interrupted transcript prefixes and latency timestamps are approximate.

## Verification and submission

```sh
python3 -m unittest discover -s tests -v
node tests/frontend_checks.cjs
python3 scripts/verify_clean_copy.py
```

Verification completed: **24 Python tests passed**, the controlled frontend harness passed **72 assertions**, and `python3 scripts/verify_clean_copy.py` passed with no `.env` copied and no third-party dependencies. The clean source copy started, served the page/assets, rejected private paths and invalid requests, and returned an insufficient-evidence debrief for an empty rehearsal. Evidence is in [docs/VERIFICATION.json](VERIFICATION.json). Node is only needed for the development harness, not to run the application.

Automated tests and typed HTTP checks cannot prove that a physical microphone, speaker playback, or video-call audio routing works. The current results and remaining checks are in [docs/PROBE_RESULTS.md](PROBE_RESULTS.md). A user screenshot confirmed a spoken manager turn was captured in desktop Chrome, but the Gemini reply failed with `ConnectionResetError`; employee audio was not demonstrated. The earlier Codex embedded-browser attempt had a speech-network error. Physical P5/P6 completion and audible latency remain unverified.

Provider reliability is a known weakness: some equivalent requests succeeded while others reset the connection or timed out. The server retries one connection reset or HTTP 502/503/504 within the original 25-second request budget. The configured 3.5 model uses minimal thinking and a 2,048-token output bound. These controls do not guarantee a live response; choose Scripted Demo explicitly for rule-based replies. Recorded input still requires Gemini transcription; browser recognition is a separate alternative that may use its vendor cloud.

The short submission is [WRITEUP.md](../WRITEUP.md), with a standalone two-page A4 print layout in [WRITEUP.html](../WRITEUP.html). Open the HTML in Chrome and print at 100% scale with browser headers and footers off. Use [docs/DEMO_GUIDE.md](DEMO_GUIDE.md) for a 15-minute run and [docs/INTERVIEW_NOTES.md](INTERVIEW_NOTES.md) for discussion preparation. Keep the source and the supplied synthetic record private; do not publish a public repository.

## Audio recovery update

On macOS the app now prefers local WAV speech generated with `/usr/bin/say` and installed male Rishi for the employee and female Samantha for the coach. The browser uses an HTML audio player rather than relying on a silent speech-synthesis queue. Speech is generated to a temporary file, validated to contain audio frames, returned to the browser, and deleted from the server filesystem. This path needs an installed macOS voice and permission to use the system speech service. Other platforms retain browser synthesis.

Use **Test Rohit’s voice** to test output without a model request. **Play Rohit’s last reply** retries a generated reply using a direct click when autoplay is blocked. The visible audio player can also be played directly. Interruption pauses audio and cancels pending work. Native audio has no word-boundary events, so an interrupted heard portion is marked unknown instead of inventing a prefix.

Executed audio checks include the earlier 8.9-second WAV and the current Rishi voice output containing 96,879 frames (4.39 seconds). The sample is `docs/rohit-audio-check.wav`. This proves non-empty audio generation and serving; human audibility and physical microphone interruption still require the candidate's own test.

## Recorded-input verification

The actual `/api/transcribe` endpoint transcribed generated synthetic Rishi audio as “Hello Amulya, I am ready to talk. What would you like to discuss?” in **2.93 seconds**. Evidence: [docs/TRANSCRIPTION_CHECK.json](TRANSCRIPTION_CHECK.json). This is a synthetic-audio endpoint check, **not a human microphone test**. Browser recognition currently fails on the tested Chrome/in-app service path; the new recorded-input path still needs the candidate's own voice and complete P5/P6 checks. Audio consent is required before recording and sending practice audio to Google.
