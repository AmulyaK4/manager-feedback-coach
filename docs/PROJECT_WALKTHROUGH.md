# How this project was built: a practical walkthrough

These notes explain the working prototype in beginner-friendly terms and give you language you can use in the interview. They describe the current source, the visible implementation stages and the failures observed during development. They are not a claim that every line was written manually or that the complete physical voice experience has passed. AI assistance helped interpret the brief, generate and revise code, review edge cases, run checks and prepare documentation. You should describe that assistance openly and take responsibility for the decisions you can explain.

## The explanation in 30 seconds

“I built a local Python web application that helps a manager prepare, rehearse and debrief a conversation about repeated lateness. I deliberately selected attendance facts instead of sending the whole employee record to a model. The browser captures the manager’s speech, Python obtains a transcript and generates a simulated employee reply, and the browser plays the reply. On this Mac, speech output uses local macOS voices. The debrief checks its quotations against the transcript and provides a readiness call, a better opening and responses to objections. I prioritised a credible practice loop, clear privacy boundaries and honest failure handling over extra features.”

## The explanation in two minutes

“The brief was about practising a difficult conversation, so the central requirement was speaking and hearing a response. A typed chatbot would not satisfy it. I kept one scenario and four screens: Context, Prepare, Rehearse and Debrief. The context screen shows both what the tool knows and what it does not know.

“I chose Python’s standard library and plain browser JavaScript so the project runs without installing packages or building a frontend. Python serves the page and exposes small JSON endpoints. Gemini is optional for coaching responses; a visibly labelled scripted engine keeps the flow demonstrable when the provider is unavailable.

“The initial browser speech approach exposed real reliability problems. Browser recognition returned a network error, and browser synthesis could remain silent. I added an explicitly consented recording route for transcription and local WAV generation for output. Audio playback has a visible player, a test button, replay and a startup watchdog. Interruption cancels playback and pending requests, and the transcript excludes words that were not reliably heard.

“The model is prompted differently in each mode. It receives curated employee context, the framework and conversation history, but never the original confidential record. Its debrief must pass structural and quotation checks. One model result said the manager was ready although the employee had not agreed, so I added a guard for recorded employee agreement. That guard improves the result but does not turn the prototype into an HR decision system.

“I verified individual components and controlled state transitions. Physical P5 and P6, audible latency and video-call routing still need my own live test. I would explain those limits rather than present synthetic audio or mocked browser events as proof of the whole experience.”

## 1. Turning the brief into a small product

The brief asks for a working browser application and a short write-up, not a complete HR platform. Its most important outcomes are a spoken rehearsal and a takeaway the manager can use tomorrow. The implementation therefore concentrates on the three coaching modes, a preceding context screen, a transcript and actionable debrief content.

Prepare teaches Situation–Behaviour–Impact, then listening, agreeing a change and agreeing a check. Rehearse plays Rohit as a person who may challenge the manager’s assumptions. Debrief stops the roleplay and becomes the coach again. Clear mode announcements, different voices and a standing simulation notice reduce confusion about who is speaking.

Authentication, a database, deployment, multiple scenarios and persistent session history were deliberately left out. They were unnecessary for the local demonstration and would have consumed time better spent on voice and data judgment. The extra test coverage was chosen for risky boundaries: disclosure, misleading readiness, interruptions, consent and malformed model responses.

## 2. The most important data decision

The original record is not the runtime dataset. [employee_context.json](../data/employee_context.json) contains only Rohit’s name, role, tenure, original manager and attendance information. It preserves Aditi Rao as the record’s manager. The current practice identity also uses Aditi Rao. Both the displayed identity and `practice_manager_name` are read from the employee context file.

The context includes a scheduled 09:30 start, 14 late arrivals over the supplied 90-day window, average lateness of 38 minutes, the Monday/Tuesday pattern and the logged prior conversation. These are usable observations, subject to verification. The application explicitly says the rolling window has no reference date and that the record supplies no verified team or client impact.

Confidential 360 comments and aggregates without sharing permission are excluded. HR notes include information outside the line manager’s access; medical details, compensation, ratings and unrelated goals are also unnecessary for this scenario. Excluding them from the runtime file is stronger than sending everything to Gemini and merely asking it not to disclose anything.

The manager must supply an impact they actually observed. The application should not infer that lateness caused a backlog, that medical leave explains attendance, or that a hypothetical commute mentioned during roleplay is a newly discovered employee fact. A simulation can offer practice material; it cannot establish the real person’s motives.

## 3. Why Python without a framework

[app.py](../app.py) uses `http.server`, `json`, `pathlib` and related standard-library modules. `ThreadingHTTPServer` lets separate requests be handled in separate threads. This matters when one request is waiting for a model and another needs to serve an asset, although it is still a development server rather than production infrastructure.

There is no Flask, FastAPI, React or package-install requirement. HTML defines the page, CSS handles presentation and JavaScript manages interaction. This made a clean copy easier to start and kept the request flow understandable for someone learning Python.

The tradeoff is that request validation, routing and errors are written explicitly. A production framework would provide more established conventions and supporting middleware. Avoiding dependencies is useful for this deadline; it is not a claim that standard-library servers are the best foundation for every deployed application.

## 4. Where everything lives

| File | Responsibility |
|---|---|
| [app.py](../app.py) | Starts the local server, routes requests, validates bodies and returns JSON or WAV audio. |
| [coach.py](../coach.py) | Loads curated context and settings, builds role prompts, calls Gemini, runs scripted coaching and validates debriefs. |
| [audio_input.py](../audio_input.py) | Checks recording consent, base64, size and audio-container format before requesting transcription. |
| [speech.py](../speech.py) | Generates temporary macOS WAV speech and rejects empty output. |
| [static/index.html](../static/index.html) | Context, Prepare, Rehearse and Debrief screens and controls. |
| [static/app.js](../static/app.js) | Session state, requests, recording, playback, interruption, transcript and exports. |
| [static/style.css](../static/style.css) | Layout, readable feedback cards, mode styling and print presentation. |
| [data/framework.json](../data/framework.json) | Editable framework name, steps, guidance and boundaries. |
| [tests](../tests/) | Python unit checks and the controlled JavaScript browser harness. |
| [scripts/verify_clean_copy.py](../scripts/verify_clean_copy.py) | Starts an isolated source copy without the private configuration and checks important routes. |
| [scripts/run_probes.py](../scripts/run_probes.py) | Exercises the supplied coaching probes and records results. |
| [README.md](../README.md), [WRITEUP.md](../WRITEUP.md), [docs](./) | Run instructions, the short submission and detailed evidence and preparation notes. |

## 5. The visible development sequence

The saved design and implementation plan establish the starting approach: local Python, browser speech, curated attendance data, editable framework and explicit scripted mode. The basic screens and request contracts created an end-to-end skeleton before additional voice recovery paths were added.

Review then exposed transcript and debrief issues. Finishing during recognition could lose the final manager turn. Unknown interrupted audio could be mistaken for an employee objection. A model debrief could contain duplicated or missing evidence. The implementation added navigation guards, placeholder filtering and stronger validation.

Subsequent hands-on use exposed different problems from the unit tests: recognition failed through a browser service, some Gemini connections reset, and speech synthesis could appear queued while producing no sound. The response was to add visible diagnostics and recovery controls, bounded provider retries, an explicitly labelled rehearsal fallback, local WAV output and a separately consented recorded-input path.

Later refinements separated Amulya’s practice identity from Aditi’s record identity, selected male Rishi for Rohit and Samantha for the coach, and removed the repeated Rohit introduction from every reply. The role is still introduced when rehearsal begins, with persistent visual simulation labels. This is a reconstruction from available code, design files and observed fixes, not a minute-by-minute claim about who typed each line.

## 6. Understanding HTTP, JSON and base64

HTTP is how the browser asks Python for something. `GET` retrieves context or a static file. `POST` submits a message, transcript or recording. A route such as `/api/rehearse` is simply a named destination that `app.py` recognises.

JSON is a text representation of structured data. A JavaScript object becomes JSON using `JSON.stringify`; Python reads it with `json.loads`. Python’s dictionary response becomes JSON, and the browser reads it with `response.json()`. Keys such as `message`, `history` and `engine` form a contract shared by both sides.

Recorded audio is binary, so it is converted into base64 text to fit inside the JSON request. Base64 is an encoding, not encryption. It increases the transmitted size by roughly one third, which is why the decoded audio limit is 3 MB while the transcription request-body allowance is larger. The MIME type describes the container, such as WebM or WAV. Python checks the container signature instead of trusting that label alone.

## 7. The endpoint contracts

`GET /api/context` returns the curated `employee`, editable `framework`, `practice_manager_name`, engine/model labels, exclusions, assumptions and capability flags. `speech_available` indicates the local macOS path exists; `transcription_available` indicates a model key is configured. Neither flag proves a complete voice session will succeed.

Prepare and Rehearse accept the same general request shape:

```json
{
  "message": "Rohit, can we discuss the recorded late starts?",
  "history": [],
  "engine": "scripted"
}
```

`POST /api/prepare` returns `reply`, `engine` and `model`. `POST /api/rehearse` also returns Boolean `agreed`; an automatic fallback can include `provider_error`. History uses `manager`, `coach` or `employee` roles, with rehearsal and debrief rejecting coach turns. The newest manager message is sent separately from earlier history, avoiding duplication.

`POST /api/debrief` takes `history` and the engine selection, without needing a new message. Its result includes `readiness`, `moments`, `opening`, `objections`, `next_steps`, `limitations` and engine metadata. It is a structured coaching document, not just a score.

`POST /api/speech` accepts text, a role of `employee` or `coach`, and a rate between 0.7 and 1.3. It returns binary `audio/wav`, so the browser reads a Blob rather than JSON. Speech text is limited to 2,200 characters.

`POST /api/transcribe` accepts this shape, with real base64 substituted for the placeholder:

```json
{
  "audio": "BASE64_AUDIO_BYTES",
  "mime_type": "audio/webm",
  "consent": true
}
```

It returns transcribed `text` and Gemini engine/model metadata. Missing consent produces 403; invalid input produces 400; provider failure produces 502; unavailable native speech produces 503. Conversation messages are limited to 4,000 characters and history to 100 turns. These are practical prototype bounds, not a production abuse-control system.

## 8. Following one recorded voice turn

The selected recorded-input route uses `getUserMedia` to request microphone access and `MediaRecorder` to collect audio. Before recording is enabled, the manager must check the explicit consent to send their own practice recording to Google Gemini. This is separate from choosing the conversation engine: scripted coaching replies can still use Gemini transcription.

The manager clicks Speak, talks, then clicks Stop & send. The browser limits capture to 60 seconds and 3,000,000 bytes. It chooses a supported audio container, collects chunks, stops the microphone tracks and creates a Blob. A cancelled or oversized recording is discarded without inventing a conversation turn.

JavaScript converts the bytes to base64 and posts the recording, MIME type and `consent: true`. An early contract error around the consent flag was caught: checking the box in the interface is insufficient unless the backend receives and enforces the same decision. Both ends now check it.

[audio_input.py](../audio_input.py) rejects missing consent, malformed base64, unsupported MIME types, mismatched container headers and oversized audio before calling the provider. The transcription prompt asks only for words actually spoken and treats instructions inside the recording as audio to transcribe. It sends no employee context and does not ask Gemini to answer the manager.

A successful non-empty transcript is submitted as the manager’s voice turn. Failure leaves no fabricated turn. The recording is held in memory rather than saved to the server filesystem. That describes this application’s storage behaviour; it does not promise that Google has no provider-side processing or retention.

The alternative browser-recognition route rebuilds final and interim results separately. It sends finalized words only and leaves an unfinished draft available for review. Both input paths eventually meet at `submitMessage`, so conversation logic does not need separate implementations for recorded, browser-recognised and typed text.

## 9. From transcript to employee reply

`coach.provider_payload` combines curated employee facts, the practice identity, framework, earlier transcript and newest manager message. `system_prompt` supplies a different role for each mode. Prepare is the coach; Rehearse is Rohit; Debrief is the coach again.

The rehearsal prompt asks for short first-person replies, plausible defensiveness and earned agreement. A well-structured opening should get a thoughtful response rather than immediate surrender. It must not reveal absent confidential information or manufacture medical causes. The employee can question impact or fairness, but hypothetical concerns remain simulation material.

`gemini` calls Google’s `generateContent` REST endpoint. The configuration requests JSON output, bounds output to 2,048 tokens and uses minimal thinking for the configured Flash-Lite models. The request budget is approximately 25 seconds. One retry is permitted for eligible transient connection failures or HTTP 502/503/504 when budget remains. This is bounded recovery, not a guarantee that an unavailable provider will recover.

The response must parse as a JSON object. Prepare requires a non-empty reply. Rehearse additionally requires a real Boolean `agreed`. Invalid shapes become actionable errors rather than arbitrary text treated as trusted application state.

Without a configured key, or with Scripted Demo selected, deterministic rules handle the conversation. They challenge harmful labels, ask for observed impact and look for listening, a concrete start expectation and review. During a provider outage, `rehearse_with_fallback` can return those rules with the provider error disclosed. Turn-level engine labels preserve what actually happened. Prepare failures remain visible rather than quietly claiming successful model coaching.

## 10. Turning the reply into audible speech

On this Mac, [speech.py](../speech.py) invokes `/usr/bin/say` using a subprocess argument list rather than a shell command. That avoids interpreting manager text as shell code. Rishi produces employee speech; Samantha produces coach speech. The coach retains its spoken identification. Rohit’s replies no longer repeat “Simulated Rohit speaking” every turn.

The output is a temporary WAV with 16-bit PCM at 22,050 Hz. Python opens it with `wave` and verifies real frames before returning bytes. The temporary directory is removed automatically. JavaScript receives the WAV as a Blob, gives an object URL to the HTML audio element and calls `play()`.

Browser autoplay may require a click. The visible audio player and Play Rohit’s last reply provide that recovery path. Test Rohit’s voice isolates output from model generation and transcription. The interface calls playback “preparing” until an actual playback event confirms it has started.

Other hosts retain browser `SpeechSynthesis`, selected voices, explicit volume, `resume()` and a 2.5-second startup watchdog. A silent queue becomes an actionable message rather than an endless speaking indicator. Voice availability and audible output still depend on the browser and device.

## 11. State, cancellation and interruption

JavaScript’s `state` object holds the current mode, separate Prepare and Rehearse histories, active recording, active request, active speech, last generated employee reply and latency samples. There is no server-side conversation session: each request supplies the relevant history.

A generation counter invalidates old asynchronous work. Imagine asking for a reply, changing mode and then receiving the old response. Aborting the request helps, but the server may already be processing it. Comparing the saved generation number prevents that stale result from appearing or playing. Audio has its own controller and generation number.

Interruption is explicit: click Speak/interrupt, which immediately stops current playback and cancels pending work, then speak. It does not detect unprompted speech over the loudspeaker automatically. The navigation guard requires finishing capture before opening Debrief, preserving the last finalized manager turn.

For browser synthesis, trustworthy word-boundary events allow only a conservative heard prefix into subsequent history. Without reliable boundaries, including native WAV playback, the transcript records that the heard portion is unknown. It must not assume the entire generated reply was heard. Replay stores the original generated reply separately and does not rewrite uncertain transcript evidence as if it had been heard during the conversation.

Latency is measured from stopping the manager’s turn to a synthesis-start or audio-playing event, including transcription finalization and response processing. It reports approximate latest, median and range values, separating typed diagnostics from voice samples. It is an event-based estimate of first sound, not an acoustic measurement at the listener’s ear.

## 12. Why the debrief needs code checks

The requested takeaway includes a direct readiness call, one effective moment, one improvement moment, a ready-to-say opening and two rehearsal-derived objections with responses. The application requests these as separate JSON fields so the screen can make the most useful information immediately visible.

`valid_debrief` checks that manager quotations are exact contiguous substrings of real manager turns. Objections must quote usable employee evidence; unknown audio placeholders are excluded. Substantive results require both moment kinds, distinct quotations and two distinct objections. Short sessions can explicitly report insufficient evidence instead of filling the screen with invented examples.

A previous live result recommended “ready” without employee agreement. The final validator rejects that unless rehearsal history contains an employee `agreed: true`. [FINAL_VALIDATION.json](FINAL_VALIDATION.json) records why that prior result fails. Agreement is necessary for this guard, but not sufficient proof of readiness: whether listening, impact and support were handled well still relies on model judgment. Client-supplied history is also not an authenticated audit record.

If model grounding or structure fails, a disclosed scripted debrief replaces it. Its keyword-based explanations are weaker and can suggest checking a turn rather than understanding its full meaning. Exact quotation checks cannot establish that an interpretation is correct, or verify that a manager’s claimed business impact actually happened. Those are explicit limits to explain.

## 13. Privacy and security choices

The API key stays in the server environment or private `.env`; it is never needed by frontend JavaScript. The local secret file was protected with owner-only `0600` permissions during setup. Do not paste it into a demo, transcript, screenshot or submission. Source archives must exclude it and be scanned before sharing; exclusion patterns are not a reason to skip inspection.

The server exposes a fixed allowlist of page assets rather than arbitrary filesystem paths. It binds to `127.0.0.1`, checks request origins when present, requires JSON for POST requests and sets a Content Security Policy. The policy permits same-origin requests and Blob media for local audio, while restricting unrelated script and embedding sources. Browser transcript rendering uses text nodes, avoiding interpretation of model text as HTML.

There is no authentication, database or permanent server transcript store. Reloading loses browser state; downloading an export creates a persistent local file. Model-enabled coaching sends selected facts and conversation text to Google. Recorded transcription sends the recording separately. These boundaries are appropriate for a synthetic local prototype; real employee deployment would require organisational privacy, retention and access decisions.

## 14. What failed and what the evidence proves

Browser speech recognition reported a network error in the embedded browser. A separate Chrome capture showed manager words but did not establish a successful full reply. This motivated recording plus Gemini transcription as a distinct input route.

Browser synthesis could remain silent despite appearing available. Early `/usr/bin/say` tests under restricted service access exited zero but produced header-only WAVs. That is why the implementation validates frames. With system speech access available, an earlier female-voice HTTP sample contained 196,159 frames, approximately 8.90 seconds. The later male Rishi check contained 96,879 frames, approximately 4.39 seconds. Those checks prove non-empty generation, not that a human heard the correct output device.

[TRANSCRIPTION_CHECK.json](TRANSCRIPTION_CHECK.json) records a real Gemini transcription of generated speech: “Hello Amulya, I am ready to talk. What would you like to discuss?” The measured round trip was 2.93 seconds. This was synthetic TTS input, not a human microphone or end-to-end rehearsal test.

The recorded final checks were 24 Python tests and 72 controlled JavaScript assertions. They cover validation, privacy boundaries, grounding, retries, consent propagation, cancellation and playback state. Mocked browser events make failures reproducible; they cannot prove microphone capture, human audibility or natural conversation. Physical P5/P6 and spoken first-sound latency remain unverified until Amulya tests with their own voice. Do not record someone else to obtain that evidence.

## 15. Running, checking and changing it

From the project directory, run:

```sh
python3 app.py --port 8765
```

Open `http://127.0.0.1:8765` in desktop Chrome and leave the terminal running. Use headphones, test output, check the selected engine and, for recorded input, read and tick the separate consent. Stop the server with `Ctrl+C`. Fresh copies can use `.env.example` as a template for a private local configuration; never overwrite an existing secret file casually.

The development checks are:

```sh
python3 -m unittest discover -s tests -v
node tests/frontend_checks.cjs
python3 scripts/verify_clean_copy.py
```

Node is needed only for the JavaScript harness. The clean-copy script excludes private configuration, removes model-key environment settings for its child server, checks assets and private-path rejection, exercises scripted routes and runs the Python suite. It writes verification evidence; it is not a physical audio check.

HR can edit framework wording and guidance in `data/framework.json`, preserving valid JSON and the existing structure. Reload to update the visible screen; requests read the framework again. This supports content revisions without engineering work. Replacing SBI entirely would also require reviewing hardcoded prompt wording, scripted rules and evaluation cases. A future version should attach a framework version to each session and validate proposed content before publishing it.

Adding another scenario means separating scenario selection, employee context, prompts, scripted behaviour and probe cases; changing the title alone is insufficient. Replacing Gemini is easier because its REST call is concentrated in `coach.gemini`, but transcription and structured-response behaviour need their own provider adapter and checks. Real deployment would add authentication, access controls, retention rules, operational monitoring, reviewed HR policy, reliable speech services and broader evaluation before real employee use.

## 16. Ten technical interview questions

**Why no database?** The brief did not require history, and browser memory was enough for one local rehearsal. Exports provide a deliberate way to keep a takeaway.

**Why not send the whole record?** The model does not need confidential or inaccessible information to practise lateness. Data selection is a product decision and reduces accidental disclosure.

**What does the model actually receive?** A role-specific instruction, curated employee facts, practice identity, editable framework, earlier transcript and latest manager message. Transcription receives audio without that employee context.

**How do you prevent prompt injection?** Separate system policy from untrusted transcript content, restrict supplied data and validate output. These reduce risk; they do not mathematically guarantee model obedience.

**How does interruption work?** The interrupt button stops playback immediately, invalidates pending work and starts capture. History retains only a reliable heard prefix or an uncertainty marker.

**Why use base64?** It puts binary audio inside JSON. It is convenient for this small prototype but increases payload size and provides no encryption itself.

**What happens if Google is unavailable?** Rehearsal can use a disclosed scripted substitute, with the failure preserved. Recorded transcription still needs Google; browser input is a separate alternative.

**What does `agreed` mean?** The simulated employee accepted a concrete next step. It helps reject unsupported readiness, but simulated agreement does not prove a real manager is ready.

**How do you know audio works?** Generated WAVs contain verified frames and playback events are monitored. I still need my own physical microphone, audible playback and interruption test before claiming the whole voice loop works.

**What would you improve first?** Complete P5/P6 with my own voice, improve the quality and reliability of short replies, and strengthen evaluation of debrief interpretations. Broader HR deployment comes after validating the central rehearsal experience.
