# Fifteen-minute demo guide

Demonstrate with your own voice and the supplied synthetic scenario. Keep the engine label visible and say which engine is running before the rehearsal. The employee is a simulation, so a convincing reply is not a prediction of what Rohit will say.

## Before the interview

- Run the README from a fresh copy. Start `python3 app.py --port 8765`, then open Chrome at `http://127.0.0.1:8765`.
- If using Gemini, verify the key and configured model with a real request. Do not show `.env` or a terminal containing credentials. Provider/model availability can change.
- Use headphones. Check Chrome's site microphone permission, your selected input device, speaker volume, and the video-call option for sharing computer audio. Confirm the interviewer can hear both your microphone and the browser's speech.
- Run P5 and P6 with your own voice. Write down what actually happened in `PROBE_RESULTS.md`, including missed words or delays. Do not substitute typed checks for these results.
- Check that the spoken mode labels are audible. If only one voice is available, verify the labels still distinguish coach and employee.
- Start a fresh session after testing. Keep the writeup and probe report open separately. Have a terminal ready to restart the local server if necessary.

## Live sequence

| Time | Action and explanation |
|---|---|
| 0:00–2:00 | Open Context. Explain the attendance allowlist, the missing reference date and impact, and why confidential peer/HR/pay data never enters the prompt. State the current engine. |
| 2:00–4:00 | In Prepare, ask for help with an opening, then try one risky prompt such as “Honestly he's just lazy and entitled. How do I tell him that?” Show the redirection to observable behaviour. Point out the editable framework file. |
| 4:00–9:00 | Enter Rehearse and speak the opening below. Let Rohit reply. Listen, respond to the actual concern, and agree a concrete next step and review point. Use the interrupt control during one reply and then speak your interruption. Show what the transcript records. |
| 9:00–12:00 | Open Debrief. Read the readiness line first, then inspect one useful quoted moment and one change. Read the revised opening aloud. Check that two objections come from this rehearsal, with any sparse-evidence limitation made clear. |
| 12:00–14:00 | Export the takeaway locally. Explain how the manager would use the opening and objection responses tomorrow. Show the probe report, including the distinction between scripted, live-model, and physical voice evidence. |
| 14:00–15:00 | Name the weakest part: browser voice turn boundaries and latency. Explain the next validation step and the deliberate cuts. |

## Opening to say in your own voice

> “Rohit, I'd like to talk about the attendance record: it shows 14 late arrivals in the recorded 90-day period, averaging 38 minutes after the 9:30 start. I'd like us to check those details, understand what's getting in the way, and agree what changes from here. How do you see it?”

This is specific without inventing individual dates or business impact. It intentionally leaves the impact unclaimed. If you want to practise a full SBI opening, explicitly declare an invented work impact as a **hypothetical rehearsal assumption** before using it; do not imply it came from the record.

## Follow the employee, rather than reciting a script

The employee's next lines depend on the engine and the conversation. Use these as possible responses to practise, not guaranteed prompts or facts about Rohit:

| If the simulated employee says… | A response to practise |
|---|---|
| “I still get the work done.” | “I hear that completing the work matters to you. I want to understand the start-time issue separately and confirm its actual impact, rather than assume it.” |
| “You don't know what's going on.” | “You're right that I don't know the whole picture. What would you like me to understand, and what support would help us agree a workable plan?” |
| “Are you trying to get rid of me?” | “I'm raising a specific attendance concern and want to hear your perspective. Let's agree clear expectations and support rather than jump to a conclusion.” |
| “I can't promise it will never happen again.” | “Let's agree a realistic expectation, what you will do if you're delayed, and when we will review how it is working.” |

An invented personal or work circumstance in the reply is simulation material. Do not repeat it later as an employee-record fact.

## Interruption demonstration

While the employee is still speaking, activate the microphone/interrupt control. Wait for the visible listening state, then say: “Let me pause you there. I want to check that I've understood what you're saying.” Use Stop & send. Observe whether playback stops, whether the next turn appears once, and whether the employee transcript has a partial/uncertain interruption marker. Automatic voice detection over playback is outside this prototype's scope.

Read the latency display as an estimate from a manager turn ending to the browser's TTS start event. It is not proof of when sound physically reached the headphones. Report the actual values, the engine, and any sample with no sound.

## If the setup fails

- Microphone permission denied: use Chrome's site controls to allow it and repeat the spoken check. Check operating-system microphone access too.
- Recognition or network error: show the visible error, check connectivity, and retry. Typing can demonstrate the remaining flow, but explicitly say voice is not working.
- Model error: show the error and identify the provider/model problem. To demonstrate scripted mode deliberately, remove/clear the key locally and start a fresh session; explain the engine change.
- Browser has no recognition API: use desktop Chrome and retest. Do not claim cross-browser voice support.
- Audio stops unexpectedly or an interruption is lost: record that outcome in P6. Continue with the visible transcript and describe the limitation candidly.
