const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..', 'static') + path.sep;
const html = fs.readFileSync(root + 'index.html', 'utf8');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.textContent = ''; this.value = ''; this.listeners = {}; this.dataset = {}; this.classList = { toggle() {} }; this.attributes = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = [...items]; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  click() { this.listeners.click?.({ preventDefault() {} }); }
  remove() {}
  pause() { this.pauseCalls = (this.pauseCalls || 0) + 1; }
  play() { this.playCalls = (this.playCalls || 0) + 1; if (this.blockPlay) return Promise.reject(new Error('Autoplay blocked')); this.onplaying?.(); return Promise.resolve(); }
}
const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Element()]));
elements['speech-rate'].value = '1';
elements['engine-select'].value = 'auto';
elements['engine-select'].options = [new Element('option'), new Element('option')];
elements['voice-input'].value = 'browser';
elements['voice-input'].options = [new Element('option'), new Element('option')];
elements['audio-consent'].checked = false;
const nav = ['context', 'prepare', 'rehearse', 'debrief'].map((mode) => { const element = new Element(); element.dataset.mode = mode; return element; });
const requests = [], utterances = [], recognitions = [], speechRequests = [], scheduled = [], transcriptions = [], recorders = [];
let microphoneRequests = 0, trackStops = 0, failTranscription = false;
class FakeRecorder {
  static isTypeSupported(type) { return type.startsWith('audio/webm'); }
  constructor(stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) }); this.onstop?.(); }
}
let deferred = null, clock = 1000, currentUtterance = null, providerError = null;
class FakeRecognition {
  constructor() { recognitions.push(this); }
  start() {}
  stop() { this.onend?.(); }
  abort() { this.onerror?.({ error: 'aborted' }); this.onend?.(); }
}
const synth = {
  resume() {},
  getVoices: () => [], addEventListener() {},
  speak(u) { utterances.push(u); currentUtterance = u; },
  cancel() { const old = currentUtterance; currentUtterance = null; old?.onerror?.({ error: 'canceled' }); }
};
const contextData = { employee: { name: 'Rohit', role: 'Analyst', tenure_months: 18, manager_name: 'Asha', attendance: { scheduled_start: '09:00', late_arrivals_last_90_days: 14, average_lateness_minutes: 20, prior_conversation_logged: false, pattern_note: 'Pattern supplied.' } }, framework: { name: 'SBI', steps: [{ name: 'Situation', guidance: 'Be specific' }] }, engine: 'scripted', exclusions: ['Private health data'], assumptions: ['No impact invented'] };
async function fakeFetch(path, options) {
  if (!options) return { ok: true, json: async () => contextData };
  const request = { path, payload: JSON.parse(options.body), signal: options.signal };
  if (path === '/api/transcribe') { transcriptions.push(request); return { ok: !failTranscription, status: failTranscription ? 502 : 200, json: async () => failTranscription ? { error: 'Transcription unavailable' } : { text: 'Let us agree a realistic next step', engine: 'gemini', model: 'transcription-test' } }; }
  if (path === '/api/speech') { speechRequests.push(request); return { ok: true, blob: async () => new Blob([new Uint8Array(100)]) }; }
  requests.push(request);
  if (deferred) { const promise = deferred; deferred = null; return promise; }
  const data = path === '/api/debrief' ? { readiness: { level: 'practice', text: 'Practise once more.' }, moments: [], opening: 'Rohit, can we talk?', objections: [], next_steps: ['Listen.'], limitations: ['Simulation only.'], engine: 'scripted' } : { reply: 'I hear you, but my commute has been difficult. Can we discuss it?', engine: 'scripted', agreed: false };
  if (providerError && path === '/api/rehearse') data.provider_error = providerError;
  return { ok: true, json: async () => data };
}
const sandbox = {
  document: { getElementById: (id) => { assert.ok(elements[id], id); return elements[id]; }, createElement: (tag) => new Element(tag), querySelectorAll: () => nav, body: new Element('body') },
  window: { MediaRecorder: FakeRecorder, navigator: { mediaDevices: { async getUserMedia() { microphoneRequests += 1; return { getTracks: () => [{ stop() { trackStops += 1; } }] }; } } }, SpeechRecognition: FakeRecognition, speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, addEventListener() {}, print() {} },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  Option: class extends Element { constructor(text, value) { super('option'); this.textContent = text; this.value = value; } },
  fetch: fakeFetch, performance: { now: () => clock }, AbortController, Blob, URL, btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  setTimeout(callback, delay) { const timer = { callback, delay, cancelled: false }; scheduled.push(timer); return timer; },
  clearTimeout(timer) { if (timer) timer.cancelled = true; }, Date, console
};
vm.runInNewContext(fs.readFileSync(root + 'app.js', 'utf8'), sandbox);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const submit = (form, input, value) => { elements[input].value = value; elements[form].listeners.submit({ preventDefault() {} }); };
const text = (element) => [element.textContent, ...element.children.map(text)].join(' ');
function recognitionResult(rec, finalText, interim = '') {
  const results = [];
  if (finalText) { const item = [{ transcript: finalText }]; item.isFinal = true; results.push(item); }
  if (interim) { const item = [{ transcript: interim }]; item.isFinal = false; results.push(item); }
  rec.onresult({ results });
}
(async () => {
  await tick();
  assert.equal(elements['employee-name'].textContent, 'Rohit');
  assert.equal(elements['start-prepare'].disabled, false);
  assert.equal(elements['engine-select'].disabled, false, 'engine available after context');
  elements['engine-select'].value = 'scripted';
  elements['engine-select'].listeners.change();
  assert.match(elements['engine-badge'].textContent, /SCRIPTED REPLIES/);
  elements['start-prepare'].click();
  assert.match(utterances.at(-1).text, /^Coach speaking\. Prepare mode/);
  submit('prepare-form', 'prepare-input', 'Help me open');
  await tick();
  assert.equal(requests.at(-1).payload.history.length, 0, 'latest turn excluded from history');
  assert.equal(requests.at(-1).payload.message, 'Help me open');
  assert.equal(requests.at(-1).payload.engine, 'scripted', 'manual fallback added to POST');
  assert.match(text(elements['prepare-transcript']), /Scripted replies · no coaching model/, 'reply engine visible in transcript');
  elements['engine-select'].value = 'auto';
  elements['engine-select'].listeners.change();
  assert.match(text(elements['prepare-transcript']), /Help me open/, 'switching engine retains transcript');
  elements['prepare-to-rehearse'].click();
  assert.match(utterances.at(-1).text, /^Coach speaking\. Rehearsal mode/);
  submit('typed-form', 'typed-input', 'You have been late 14 times. What is happening?');
  await tick();
  let reply = utterances.at(-1);
  assert.match(reply.text, /^I hear you/, 'employee reply has no repeated speaker preface');
  clock = 1600; reply.onstart();
  const prefixLength = 0;
  reply.onboundary({ charIndex: prefixLength + 10 });
  elements['speak-button'].click();
  const rec = recognitions.at(-1);
  assert.equal(elements['engine-select'].disabled, true, 'engine cannot change during microphone capture');
  recognitionResult(rec, 'I want to understand', 'your commute');
  recognitionResult(rec, 'I want to understand your commute');
  clock = 2000;
  elements['stop-send'].click();
  await tick();
  const spoken = requests.at(-1);
  assert.equal(spoken.payload.message, 'I want to understand your commute', 'final and interim not duplicated');
  assert.equal(spoken.payload.engine, 'auto', 'configured engine sent explicitly');
  assert.equal(spoken.payload.history.length, 2);
  assert.equal(spoken.payload.history[1].interrupted, true);
  assert.equal(spoken.payload.history[1].text, 'I hear you', 'only safe heard prefix sent');
  assert.ok(!JSON.stringify(spoken.payload.history).includes('commute has been difficult'));
  clock = 2450; utterances.at(-1).onstart();
  assert.match(elements['latency-summary'].textContent, /1 spoken sample/);
  assert.match(elements['latency-latest'].textContent, /0\.45 s/);
  elements['speak-button'].click();
  recognitionResult(recognitions.at(-1), 'Can we agree a next step?');
  elements['stop-send'].click();
  await tick();
  const unknownHistory = requests.at(-1).payload.history;
  assert.equal(unknownHistory.at(-1).text, '[Playback interrupted; heard portion unavailable.]');
  assert.equal(unknownHistory.at(-1).interrupted, true);
  // A late fetch may resolve despite abort; it must never become employee audio.
  let resolveLate;
  deferred = new Promise((resolve) => { resolveLate = resolve; });
  submit('typed-form', 'typed-input', 'A pending request');
  const countBeforeLate = utterances.length;
  elements['speak-button'].click();
  assert.equal(requests.at(-1).signal.aborted, true);
  resolveLate({ ok: true, json: async () => ({ reply: 'STALE REPLY', engine: 'scripted' }) });
  await tick();
  assert.equal(utterances.length, countBeforeLate, 'aborted stale response cannot play');
  const countBeforeError = requests.length;
  const errorRec = recognitions.at(-1);
  errorRec.onerror({ error: 'not-allowed' });
  errorRec.onend();
  await tick();
  assert.equal(requests.length, countBeforeError, 'mic error never becomes manager text');
  assert.match(elements['global-status'].textContent, /denied/);
  elements['speak-button'].click();
  recognitionResult(recognitions.at(-1), '', 'This is only an interim draft');
  elements['stop-send'].click();
  await tick();
  assert.equal(requests.length, countBeforeError, 'interim-only capture is not submitted');
  assert.equal(elements['typed-input'].value, 'This is only an interim draft', 'unfinalized draft available for explicit review');
  elements['speak-button'].click();
  const preservedCapture = recognitions.at(-1);
  recognitionResult(preservedCapture, 'Preserve this spoken turn before the debrief');
  assert.equal(elements['finish-rehearsal'].disabled, true, 'finish disabled while recording');
  assert.ok(nav.every((button) => button.disabled), 'all mode navigation disabled while recording');
  elements['finish-rehearsal'].click(); // Simulate a programmatic click despite disabled UI.
  await tick();
  assert.equal(requests.length, countBeforeError, 'guard prevents navigation and retains capture');
  assert.match(elements['global-status'].textContent, /Stop & send/);
  elements['stop-send'].click();
  await tick();
  assert.equal(requests.at(-1).payload.message, 'Preserve this spoken turn before the debrief');
  assert.equal(elements['finish-rehearsal'].disabled, false, 'finish enabled after finalized manager turn');
  elements['finish-rehearsal'].click();
  await tick();
  assert.equal(requests.length, countBeforeError + 2, 'preserved manager turn sent before debrief');
  assert.match(utterances.at(-1).text, /^Coach speaking\. Rehearsal has ended\. Debrief mode/);
  assert.match(text(elements['debrief-content']), /Practise once more/);
  assert.equal(elements['print-takeaway'].disabled, false);
  elements['test-voice'].click();
  assert.equal(utterances.at(-1).volume, 1, 'browser speech volume explicit');
  assert.match(elements['voice-status'].textContent, /Preparing audio/, 'not speaking before onstart');
  scheduled.findLast((timer) => timer.delay === 2500 && !timer.cancelled).callback();
  assert.match(elements['global-status'].textContent, /Audio did not start/, 'silent browser audio detected');
  assert.equal(elements['replay-reply'].disabled, false, 'replay available after interrupted audio');
  const transcriptBeforeReplay = text(elements['rehearse-transcript']);
  elements['replay-reply'].click();
  assert.match(utterances.at(-1).text, /commute has been difficult/, 'replay retains original generated text');
  assert.equal(text(elements['rehearse-transcript']), transcriptBeforeReplay, 'replay does not fabricate heard transcript');
  contextData.speech_available = true;
  elements['native-audio'].blockPlay = true;
  elements['test-voice'].click();
  await tick();
  assert.equal(speechRequests.at(-1).payload.role, 'employee', 'local test voice uses employee role');
  assert.match(speechRequests.at(-1).payload.text, /Rohit’s voice/, 'local test bypasses model');
  assert.equal(elements['native-audio'].hidden, false, 'visible local playback controls');
  assert.match(elements['global-status'].textContent, /requires a click/, 'autoplay failure actionable');
  elements['native-audio'].blockPlay = false;
  elements['replay-reply'].click();
  await tick();
  const audioRequestsBeforePlay = speechRequests.length;
  elements['replay-reply'].click();
  assert.equal(speechRequests.length, audioRequestsBeforePlay, 'loaded reply plays directly without new request');
  assert.match(elements['voice-status'].textContent, /Simulated Rohit is speaking/, 'native playing event confirms playback');
  const pausesBefore = elements['native-audio'].pauseCalls;
  elements['stop-audio'].click();
  contextData.transcription_available = true;
  nav.find((button) => button.dataset.mode === 'rehearse').click();
  elements['voice-input'].value = 'recording';
  elements['voice-input'].listeners.change();
  assert.equal(elements['speak-button'].disabled, true, 'audio consent required before recording');
  elements['speak-button'].click();
  await tick();
  assert.equal(microphoneRequests, 0, 'unchecked consent blocks microphone/upload path');
  elements['audio-consent'].checked = true;
  elements['audio-consent'].listeners.change();
  elements['speak-button'].click();
  await tick();
  assert.equal(microphoneRequests, 1);
  assert.match(elements['voice-status'].textContent, /Recording/);
  clock = 3500;
  elements['stop-send'].click();
  await tick();
  assert.equal(transcriptions.length, 1, 'one upload per completed recording');
  assert.equal(transcriptions[0].payload.audio, 'AQID', 'audio bytes encoded exactly once');
  assert.equal(transcriptions[0].payload.mime_type, 'audio/webm', 'codec parameters stripped');
  assert.equal(transcriptions[0].payload.consent, true, 'explicit checked consent propagated to backend');
  assert.equal(requests.at(-1).payload.message, 'Let us agree a realistic next step', 'only transcribed words become manager turn');
  assert.ok(trackStops > 0, 'microphone tracks stopped after capture');
  elements['stop-audio'].click();
  const requestsBeforeFailedTranscription = requests.length;
  failTranscription = true;
  elements['speak-button'].click();
  await tick();
  elements['stop-send'].click();
  await tick();
  assert.equal(requests.length, requestsBeforeFailedTranscription, 'failed transcription cannot invent a manager turn');
  assert.match(elements['global-status'].textContent, /No manager turn was added/);
  const uploadsBeforeCancelledRecording = transcriptions.length;
  const stoppedBeforeCancel = trackStops;
  elements['speak-button'].click();
  await tick();
  recorders.at(-1).ondataavailable({ data: new Blob([new Uint8Array(3 * 1024 * 1024 + 1)]) });
  await tick();
  assert.equal(transcriptions.length, uploadsBeforeCancelledRecording, 'cancelled oversized recording never uploads');
  assert.ok(trackStops > stoppedBeforeCancel, 'cancelling recording stops all microphone tracks');
  assert.equal(requests.length, requestsBeforeFailedTranscription, 'cancelled recording invents no manager turn');
  assert.ok(elements['native-audio'].pauseCalls > pausesBefore, 'native interruption pauses synchronously');
  nav.find((button) => button.dataset.mode === 'rehearse').click();
  providerError = 'Connection reset';
  clock = 3000;
  submit('typed-form', 'typed-input', 'Let us agree a practical next step');
  await tick();
  assert.match(elements['global-status'].textContent, /Gemini unavailable: Connection reset.*scripted demo reply/, 'automatic fallback explicitly disclosed');
  assert.match(text(elements['rehearse-transcript']), /Gemini unavailable: Connection reset/, 'fallback retained alongside turn');
  const latencyBeforeRepeat = elements['typed-latency'].textContent;
  elements['native-audio'].onplaying();
  assert.equal(elements['typed-latency'].textContent, latencyBeforeRepeat, 'native playing records latency once');
  assert.ok(!speechRequests.at(-1).payload.text.startsWith('Simulated Rohit speaking'), 'native prefix added only by server');
  elements['stop-audio'].click();
  submit('typed-form', 'typed-input', 'Continue after interruption');
  await tick();
  assert.equal(requests.at(-1).payload.history.at(-1).text, '[Playback interrupted; heard portion unavailable.]', 'native interruption never invents heard prefix');
  elements['stop-audio'].click();
  console.log('PASS: context; mode audio; history de-duplication; final-only recognition; no-final draft preserved without submit; mode-change prevention and spoken-turn preservation; synchronous interruption; safe heard prefix; unknown-prefix marker; stale response discard; mic error exclusion; voice latency; structured debrief.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
