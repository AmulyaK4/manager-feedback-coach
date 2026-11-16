# Interview rehearsal script

The brief gives **60 minutes: 15 demo, 20 decisions, 15 extension, 10 questions**. The introduction is part of the first 15 minutes. Practise these ideas in your own words. Bring headphones and check that the interview call shares browser audio as well as your microphone before the interview starts.

Latest reported checks: **24 Python tests passed**. The prior frontend harness passed **57 controlled assertions**; the final count for new recording-input checks is pending. The real scripted rehearsal endpoint returned a reply; the real speech endpoint returned a WAV containing 196,159 audio frames, about 8.9 seconds, generated in about 0.9 seconds. That proves the endpoint produced structured audio. **Human listening, complete spoken P5, interruption P6, and spoken latency are not yet confirmed.** Refresh these notes from final evidence before presenting.

## Two-minute opening

“I understood the assignment as a practice tool for a manager who needs to have a difficult conversation. The manager should leave knowing whether they are ready, what to say first, and how to respond when the employee pushes back.

“I built one repeated-lateness scenario with Prepare, Rehearse, and Debrief. Before those modes, I show the context the application uses. My most important decision was choosing which parts of the supplied record belong in the exercise.

“I kept Rohit's role and attendance facts. I excluded confidential peer feedback, HR notes, pay, ratings, and unrelated goals before sending anything to the model. The rolling 90-day period has no reference date, and there is no verified business impact. I do not fill those gaps with invented facts.

“The application uses a small Python server and browser JavaScript. Gemini generates text; speech input and output are separate. The framework is editable JSON, so changing its wording does not require changing the application code.

“I will show the conversation and useful takeaway, and distinguish live-model results from the labelled scripted demo. The main weaknesses are model reliability and proving the complete spoken flow. Chrome captured a spoken manager turn, and the local speech endpoint produces a WAV, but I am not treating those separate successes as proof of an audible conversation or interruption.”

Update that final sentence only when your own-voice check establishes more.

## Minutes 0–15: demo

| Time | What I do and say |
|---|---|
| 0–2 | Give the introduction. State the selected engine. If scripted: “These employee replies use rules, not Gemini.” |
| 2–4 | Show Context. “This is the attendance allowlist. Confidential information is excluded before prompting. Missing dates and impact remain visible.” |
| 4–6 | Open Prepare. Ask for an opening, then try “lazy and entitled.” “The coach should challenge the label, describe observable behaviour, and ask for an actual impact.” |
| 6–10 | Enter Rehearse and speak the opening below. Listen and respond to the actual concern. If Gemini fails and the reply switches to scripted, show the warning and turn label. If audio fails, show the error; typing is a troubleshooting aid, not successful voice. |
| 10–11 | If employee audio works, click Speak / interrupt Rohit during playback, then speak. Show the transcript. “This is interruption by a control; speaking alone does not trigger it.” |
| 11–13 | Open Debrief. Show readiness first, then quotes, the revised opening, and objection responses. “These should come from this rehearsal. Sparse evidence gets a limitation.” |
| 13–15 | Export the takeaway. Show the probe evidence and explain the cuts. “The useful thing tomorrow is a sentence I can say and responses I have practised.” |

Opening to say in your own voice:

> “Rohit, the record shows 14 arrivals after the 9:30 start in the recorded 90-day period, averaging 38 minutes late. I'd like to check those details, understand your perspective, and agree what changes from here. How do you see it?”

The record supplies no impact. For a full SBI practice input, first say: “For this rehearsal only, I am assuming I had to cover a morning handover.” That is invented practice material, not employee evidence.

If he raises fairness: “I hear that you want your work recognised. I want to understand that and discuss the attendance concern separately.” To explore agreement: “What would make the 9:30 start workable, how should we handle a delay, and when should we review this together?” Follow what he actually says rather than reciting these lines.

## Minutes 15–35: decisions and suggested answers

**Why this stack and scope?**

“I used simple Python and browser JavaScript so I could follow and explain the flow. The server starts with one command and no third-party Python packages. The brief did not require a database, login, or deployment, so I used that time on data selection, the conversation, and the takeaway. It runs on localhost; this is not a production server.”

**What happens when I speak?**

```text
My voice -> browser MediaRecorder (explicit Google consent)
  -> Python /api/transcribe -> Gemini verbatim transcription -> text
  -> Python -> curated context + framework + mode prompt
  -> Gemini -> JSON text response -> Python validation
  -> browser displays reply -> Python /api/speech
  -> macOS say creates temporary WAV -> browser audio playback

Other hosts use browser SpeechSynthesis for speech output.
```

“Gemini is not providing native voice. On this Mac, Python uses `say` with male Rishi for Rohit and female Samantha for the coach, then the browser plays a visible audio element. The local endpoint has generated a valid WAV. Human audibility still needs checking. The preferred recording input sends my audio to Google after explicit consent. Browser recognition remains an alternative and may use its vendor cloud. Local output does not make the application offline or private.”

**What is an API, and why not a ChatGPT subscription?**

“An API lets my Python program send a request and receive a response. A subscription to a chat application is not an API credential for this app. This application calls Gemini's `generateContent` endpoint. Python reads the key from local `.env` or the environment. The key stays on the backend and is excluded from source control, browser code, and exports. I would never open that file in the demo.”

**Why not use the complete employee record?**

“The model does not need it. Only `data/employee_context.json` is loaded at runtime. It contains the selected attendance context. Even the 360 aggregates were collected under confidentiality, so I did not assume they could be shared. HR notes, pay, ratings, and unrelated goals could encourage false connections. A convincing simulation is not worth exposing hidden information. A manager should verify the attendance period and business impact before the real conversation.”

**How are prompts and the employee different across modes?**

“Prepare is the coach, Rehearse is Rohit, and Debrief returns to the coach. Each mode has its own instruction and response structure. The employee should speak briefly and respond to what the manager actually says. A good opening earns a thoughtful response, not instant surrender. The live prompt allows agreement when the manager listens and proposes a workable change and review; it does not force a fixed turn count. The scripted engine is a simpler rule-based demonstration. Invented objections remain simulation material, not discovered employee facts.”

**How can HR change the framework?**

“The steps and wording are in `data/framework.json`: Situation, Behaviour, Impact, listen, agree a change, agree a check. Python reads this content for context and prompts. HR can change wording while preserving valid JSON and its structure. In a real product I would add versioning, preview, approval, and regression checks. Editable JSON is the prototype's content handoff, not a complete editing system.”

**What makes the debrief trustworthy and useful?**

“The manager needs language for tomorrow, rather than an empathy score. I lead with readiness, then aim for two moments using actual manager quotes, a rewritten opening, and two responses to concerns raised in this rehearsal. Python checks structure and that quotes occur in the relevant transcript. It rejects ‘ready’ without an employee agreement marker. Short sessions omit unsupported items and explain why. These checks reduce errors; they do not prove the advice is always right. It is rehearsal guidance, not legal advice or an HR decision.”

**Where is state, and what does interruption do?**

“The transcript stays in browser memory and goes with each request. There is no history database; reload loses it unless I export. The interrupt control stops playback, cancels pending work, and changes a request identifier so late replies are ignored. Browser word-boundary events can support a heard prefix. Where that is unreliable, including local WAV playback, I keep an uncertainty marker instead of pretending the whole reply was heard. Physical interruption still needs my own-voice test.”

**What did evaluation actually show?**

“The initial live P1–P4 responses redirected the risky requests. A later P4 failed with a connection reset. Typed P5 completed two employee replies without agreement, then the third failed. That is not spoken P5. A model debrief once falsely called the manager ready, so I added an employee-agreement guard and a regression test. Chrome captured my spoken turn, but that did not produce a confirmed audible model reply. Model HTTP replies in that rehearsal took about 13–22 seconds; those are not spoken time-to-first-sound measurements.”

“My latest backend run has 24 tests; the earlier frontend run had 57 assertions and the new input checks need a final count. Tests cover boundaries, malformed requests, grounded quotes, readiness, audio handling, and cancellation events. A clean source copy starts without secrets or installed Python packages. I still need a real audible loop, P6, and spoken latency on the interview setup.”

**What happens if the provider fails, and what would you improve?**

“The model has intermittent resets. One retry stays within the original 25-second budget. The current rehearsal route can return a disclosed scripted reply, carrying the provider error and a scripted engine label; the browser displays a warning. I can also choose Scripted Demo explicitly. That keeps practice moving, but it is not successful Gemini evidence. Invalid model debriefs can also produce a disclosed local result. I must never call either a silent model success.”

“I used Codex for planning, implementation, boundary review, checks, and documentation. I began with the brief and data allowlist, then developed routes and safeguards alongside browser voice controls. My lesson is that I should have proved audible output earlier: it was the largest delivery risk. Next I would finish the physical voice checks, improve reliability, and broaden coaching evaluation. I cut accounts, persistent history, integrations, other scenarios, automatic barge-in, streaming, and deployment.”

## Minutes 35–50: unfamiliar extension

Start with one high-value question:

> “Who is this extension for, and what is the smallest outcome you want that person to achieve?”

Then think aloud through five steps:

1. **Success:** “I would describe one user journey and how we would know it worked.” A new scenario needs a clear behaviour and useful takeaway; a new user role needs explicit access rules.
2. **Smallest complete path:** “I would get one path through context, rehearsal, and debrief working before adding options.” Preserve the existing lateness scenario and name what you postpone.
3. **Data contract:** “I would list the allowed fields, unknowns, expected response, and owner.” Exclude sensitive material before prompting. If the framework changes, record which version the session used.
4. **Voice and failure:** “What does the manager hear, how can they interrupt, and what happens when recognition, generation, or playback fails?” Consider switching modes during a pending request and interrupting while audio is being prepared.
5. **Evidence:** “I would test one good path and the failures that could mislead the manager.” Check privacy, quotes, unsupported readiness, malformed output, cancellation, and a real own-voice flow. Measure delay without hiding failed samples.

Finish with a tradeoff: “Given the time, I would build X first, postpone Y, and validate Z before claiming it works.” If you do not know an API detail: “I would check that contract rather than assume it supports cancellation.” You are showing reasoning, not instant recall.

## Minutes 50–60: six questions for the interviewers

Choose three or four and follow the answers.

1. “What would convince you the tool improved a real conversation rather than only increased confidence?”
2. “What makes a manager return for a second rehearsal, and where do they struggle most today?”
3. “Who decides which employee information the product may use, especially confidential or sensitive material?”
4. “Who owns framework changes, and what evidence would you want before releasing new coaching behaviour?”
5. “Which early tradeoff matters most: natural conversation, reliability, privacy controls, or cost?”
6. “When should coaching stop and direct the manager to a human HR partner, and who sets that boundary?”

## Ninety-second cheat sheet

“The product is rehearsal before a real conversation. I prioritised selected context, spoken practice, and a useful takeaway. All supplied data is synthetic.

“SBI means Situation, Behaviour, Impact, then listen, agree change, agree a check. The record has 14 late starts, a 9:30 expectation, and a 38-minute average. It lacks a reference date and verified impact. I do not guess them.

“STT means speech to text; TTS means text to speech. The browser records speech after consent, and Gemini transcribes it; browser recognition is an alternative. Python sends curated context and transcript to Gemini and validates JSON. On this Mac, `say` generates a WAV for browser playback. That is not native Gemini voice. The API key stays on the backend.

“The session is browser memory. Interrupt means stop playback and pending work, ignore stale replies, and avoid claiming unspoken text was heard. Simulation and engine labels stay visible.

“Debrief means readiness, actual quotes, an opening, and objection responses. Sparse evidence stays sparse. False readiness led to a guard. Typed tests are not voice evidence. Provider resets and physical voice verification remain the weaknesses. I will show the latest evidence rather than promise perfection.”

Keep `PROBE_RESULTS.md`, `LIVE_EVAL.json`, `FINAL_VALIDATION.json`, and `VERIFICATION.json` open. Prefer the final recorded run over these drafting notes if results change.

## Final input and voice update — use this over earlier wording

“The practice manager is Aditi Rao, matching the supplied employee record. Rohit uses the male Rishi voice and the coach uses female Samantha. I removed the repeated ‘Simulated Rohit speaking’ prefix at my request. Different voices, mode announcements, and standing labels still distinguish the roles. Current Rishi output is a verified 4.39-second WAV; audibility is a separate check.

“Chrome/in-app speech recognition failed on the tested service path, so the preferred input now records my own voice with MediaRecorder. I must first check the consent to send practice audio to Google. Stop & send posts at most 60 seconds / 3 MB to Python, which asks Gemini for verbatim JSON text. This transcription request contains no employee context, and the application keeps no backend audio history. Audio is held in memory. Browser recognition is still an alternative.

“The real transcription endpoint correctly transcribed generated synthetic Rishi audio in 2.93 seconds. That is not a human microphone test. My own-voice recording, full spoken P5/P6, and time to first sound are still pending. The Scripted Demo selector changes coaching replies only: recording input still makes a Gemini transcription request. I must not call it a no-AI or fully offline mode.”

Evidence: `docs/TRANSCRIPTION_CHECK.json`. In the demo, explain the consent, choose the voice input, record your own opening, and inspect the recognised text before interpreting the response.
