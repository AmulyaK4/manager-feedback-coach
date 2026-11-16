"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const canRecord = Boolean(window.MediaRecorder && window.navigator?.mediaDevices?.getUserMedia);
  const state = {
    context: null, mode: "context", started: false, prepare: [], rehearsal: [],
    generation: 0, request: null, speech: null, recognition: null,
    voices: [], latency: [], debrief: null, counter: 0, engineSelection: "auto", lastEmployeeReply: null,
    audioRequest: null, audioGeneration: 0, audioURL: null
  };
  const voiceError = {
    "not-allowed": "Microphone access was denied. Allow microphone access for this site in Chrome, then try again.",
    "service-not-allowed": "The browser blocked speech recognition. Check Chrome microphone and speech service settings.",
    "audio-capture": "No microphone is available. Connect a microphone and check Chrome’s input device.",
    network: "Browser speech recognition could not reach its service. Switch Voice input to Microphone recording → Gemini, then review the separate audio consent checkbox. Browser recognition may not work in the in-app browser.",
    "no-speech": "No speech was recognized. Check your microphone and try again.",
    aborted: "Microphone capture was stopped. No error text has been sent to the conversation."
  };

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined && text !== null) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  function notify(message = "", error = false) {
    $("global-status").textContent = message;
    $("global-status").className = error ? "notice error" : "notice";
    $("global-status").hidden = !message;
  }
  function updateEngine(data) {
    if (!data || !data.engine) return;
    const scripted = data.engine === "scripted";
    $("engine-badge").textContent = scripted ? "SCRIPTED REPLIES · NO COACHING MODEL" : `GEMINI · ${data.model || "configured model"}`;
    $("engine-badge").title = scripted ? "Rule-based coaching replies. The separate audio transcription input may still use Gemini." : "Conversation content is sent to the configured model provider.";
  }
  function addFact(label, value) {
    const row = node("div", null, "fact");
    row.append(node("dt", label), node("dd", value));
    $("employee-facts").append(row);
  }
  function fillList(id, items) {
    $(id).replaceChildren(...(items || []).map((item) => node("li", item)));
  }
  function renderContext(data) {
    const employee = data.employee || {};
    const attendance = employee.attendance || {};
    $("employee-name").textContent = employee.name || "Rohit";
    $("employee-role").textContent = `${employee.role || "Employee"} · ${employee.tenure_months ?? "Unknown"} months’ tenure · Record manager: ${employee.manager_name || "Not supplied"}`;
    $("employee-facts").replaceChildren();
    addFact("Scheduled start", attendance.scheduled_start || "Not supplied");
    addFact("Late arrivals · last 90 days", attendance.late_arrivals_last_90_days ?? "Not supplied");
    addFact("Average lateness", attendance.average_lateness_minutes != null ? `${attendance.average_lateness_minutes} minutes` : "Not supplied");
    addFact("Prior conversation logged", attendance.prior_conversation_logged === true ? "Yes" : attendance.prior_conversation_logged === false ? "No" : attendance.prior_conversation_logged || "Not supplied");
    $("attendance-note").textContent = attendance.pattern_note || "No further attendance pattern has been supplied.";
    fillList("exclusions", data.exclusions);
    fillList("assumptions", data.assumptions);
    $("framework-name").textContent = data.framework?.name || "Situation · Behaviour · Impact";
    const steps = data.framework?.steps || [];
    for (const id of ["framework-steps", "prepare-framework"]) {
      $(id).replaceChildren(...steps.map((step) => {
        const li = node("li");
        li.append(node("strong", step.name), node("span", step.guidance));
        return li;
      }));
    }
    $("start-prepare").disabled = false;
    $("start-rehearse").disabled = false;
    updateEngine(data);
    $("voice-input").value = data.transcription_available && canRecord ? "recording" : "browser";
    $("voice-input").options[0].disabled = !data.transcription_available || !canRecord;
    $("audio-consent-note").hidden = $("voice-input").value !== "recording";
  }

  function turn(role, text, source) {
    return { id: ++state.counter, role, text, source, created_at: new Date().toISOString() };
  }
  function renderTranscript(id, items, emptyText) {
    const target = $(id);
    target.replaceChildren();
    if (!items.length) target.append(node("p", emptyText, "transcript-empty"));
    for (const item of items) {
      const article = node("article", null, `turn turn-${item.role}`);
      const meta = node("div", null, "turn-meta");
      const managerName = state.context?.practice_manager_name || state.context?.employee?.manager_name || "You";
      const label = item.role === "manager" ? `${managerName} · manager` : item.role === "coach" ? "Coach" : "Simulated Rohit";
      meta.append(node("span", label));
      if (item.source) meta.append(node("span", item.source === "voice" ? "spoken turn" : item.source === "typed" ? "typed troubleshooting" : item.source, "turn-source"));
      if (item.engine) meta.append(node("span", item.engine === "scripted" ? "Scripted replies · no coaching model" : `${item.engine} · ${item.model || "configured model"}`, "turn-source"));
      article.append(meta, node("p", item.text));
      if (item.provider_error) article.append(node("div", `Gemini unavailable: ${item.provider_error}. This turn uses a scripted demo reply.`, "interruption-note"));
      if (item.interrupted) article.append(node("div", item.unheard ? "Audio startup was not confirmed · reply treated as unheard. Original generated reply is available with Play Rohit’s last reply." : item.heard_unknown ? "Interrupted · browser did not provide a reliable heard prefix; unspoken reply excluded." : "Interrupted · only the known heard prefix is retained.", "interruption-note"));
      target.append(article);
    }
    target.scrollTop = target.scrollHeight;
  }
  function renderAllTranscripts() {
    renderTranscript("prepare-transcript", state.prepare, "Start with a draft or a question. Your coach will help you make it specific and fair.");
    renderTranscript("rehearse-transcript", state.rehearsal, "Take a breath. Click Speak and open the conversation with Rohit.");
    renderTranscript("debrief-transcript", state.rehearsal, "No rehearsal turns have been captured yet.");
  }
  function historyFor(items) {
    return items.map(({ role, text, interrupted, agreed }) => ({ role, text, ...(interrupted ? { interrupted: true } : {}), ...(typeof agreed === "boolean" ? { agreed } : {}) }));
  }

  function updateControls() {
    const rec = state.recognition;
    const busy = Boolean(state.request);
    $("engine-select").disabled = Boolean(rec) || busy || !state.context;
    $("voice-input").disabled = Boolean(rec) || busy;
    $("audio-consent").disabled = Boolean(rec);
    $("coach-voice").disabled = Boolean(state.context?.speech_available);
    $("employee-voice").disabled = Boolean(state.context?.speech_available);
    $("coach-voice").title = $("employee-voice").title = state.context?.speech_available ? "Local device voice is selected by the server; these choices apply to browser speech fallback." : "Choose the browser speech voice.";
    $("prepare-send").disabled = busy || !state.context;
    $("prepare-input").disabled = busy;
    $("typed-send").disabled = busy || Boolean(rec);
    $("typed-input").disabled = Boolean(rec);
    const inputReady = $("voice-input").value === "recording" ? canRecord && state.context?.transcription_available && $("audio-consent").checked : Boolean(Recognition);
    $("speak-button").disabled = !inputReady || (!synth && !state.context?.speech_available) || Boolean(rec?.stopping);
    $("speak-button").textContent = rec ? (rec.stopping ? "Finishing transcription…" : "Listening — stop & send") : "Speak / interrupt Rohit";
    $("stop-send").disabled = !rec || rec.stopping;
    $("stop-audio").disabled = !state.speech;
    $("test-voice").disabled = (!synth && !state.context?.speech_available) || Boolean(rec);
    $("replay-reply").disabled = (!synth && !state.context?.speech_available) || !state.lastEmployeeReply || Boolean(rec);
    $("finish-rehearsal").disabled = Boolean(rec);
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.disabled = Boolean(rec) || (button.dataset.mode !== "context" && !state.started);
    });
    let label = "Ready when you are";
    let indicator = "voice-indicator";
    if (rec) { label = rec.stopping ? (rec.captureMethod === "media-recorder-gemini" ? "Transcribing your recording with Gemini…" : "Finalizing your words…") : rec.captureMethod === "media-recorder-gemini" ? "Recording your practice turn…" : "Listening to your voice…"; indicator += " listening"; }
    else if (busy && state.mode === "rehearse") label = "Simulated Rohit is considering your words…";
    else if (state.speech) { label = !state.speech.started ? "Preparing audio — waiting for browser playback…" : state.speech.role === "employee" ? "Simulated Rohit is speaking — you can interrupt" : "Coach is speaking"; if (state.speech.started) indicator += " speaking"; }
    $("voice-status").textContent = label;
    $("voice-indicator").className = indicator;
  }

  function cancelPlayback(markInterrupted = true) {
    const active = state.speech;
    // Clear callbacks first; cancel still runs synchronously in the user gesture.
    state.speech = null;
    if (active) clearTimeout(active.timer);
    state.audioGeneration += 1;
    $("native-audio").pause();
    if (state.audioRequest) state.audioRequest.abort();
    state.audioRequest = null;
    if (state.audioURL) { URL.revokeObjectURL(state.audioURL); state.audioURL = null; $("native-audio").removeAttribute("src"); }
    if (synth) synth.cancel();
    if (active?.entry && markInterrupted && !active.finished) {
      active.entry.interrupted = true;
      if (active.boundarySeen && active.heardLength > 0) {
        active.entry.text = active.text.slice(0, active.heardLength).trimEnd();
      } else {
        active.entry.text = "[Playback interrupted; heard portion unavailable.]";
        active.entry.heard_unknown = true;
      }
      renderAllTranscripts();
    }
    updateControls();
  }
  function abortRequest() {
    state.generation += 1;
    if (state.request) state.request.abort();
    state.request = null;
    updateControls();
  }
  function cancelRecognition() {
    const session = state.recognition;
    state.recognition = null;
    if (session) {
      session.cancelled = true;
      clearTimeout(session.timer);
      if (session.transcriptionController) session.transcriptionController.abort();
      if (session.stream) session.stream.getTracks().forEach((track) => track.stop());
      try { if (session.captureMethod === "media-recorder-gemini") { if (session.api?.state !== "inactive") session.api?.stop(); } else session.api.abort(); } catch (_) { /* Already stopped. */ }
    }
    $("live-transcript").textContent = "Your words will appear here while you speak.";
    updateControls();
  }
  function switchMode(mode) {
    if (state.recognition) {
      notify("Click Stop & send to finish and preserve your spoken turn before changing mode or opening the debrief.");
      return;
    }
    if (mode !== "context" && !state.context) return;
    cancelPlayback();
    abortRequest();
    cancelRecognition();
    state.mode = mode;
    if (mode !== "context") state.started = true;
    for (const name of ["context", "prepare", "rehearse", "debrief"]) $(name + "-view").hidden = name !== mode;
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.disabled = button.dataset.mode !== "context" && !state.started;
      button.classList.toggle("active", button.dataset.mode === mode);
      if (button.dataset.mode === mode) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
    });
    notify();
    updateControls();
    if (mode === "prepare") speak("Prepare mode. I am your coach. We will build a specific, fair opening before you practise.", "coach");
    if (mode === "rehearse") speak("Rehearsal mode. I will now play a simulated Rohit. His responses are practice possibilities, not a prediction. Click Speak to begin, and click again whenever you want to interrupt.", "coach");
    if (mode === "debrief") {
      speak("Rehearsal has ended. Debrief mode. I am your coach again. Let us look at what happened and what you can say next.", "coach");
      requestDebrief();
    }
  }

  function populateVoices() {
    if (!synth) return;
    const previous = { coach: $("coach-voice").value, employee: $("employee-voice").value };
    state.voices = synth.getVoices();
    const english = state.voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const available = [...(english.length ? english : state.voices)].sort((a, b) => Number(Boolean(b.localService)) - Number(Boolean(a.localService)));
    for (const role of ["coach", "employee"]) {
      const select = $(role + "-voice");
      select.replaceChildren();
      if (!available.length) select.append(new Option("Browser default voice", ""));
      available.forEach((voice) => select.append(new Option(`${voice.name} (${voice.lang}) · ${voice.localService ? "device" : "online"}`, voice.voiceURI)));
      if (available.some((voice) => voice.voiceURI === previous[role])) select.value = previous[role];
      else {
        const preferences = role === "coach" ? ["Samantha", "Karen", "Moira", "Daniel"] : ["Rishi", "Daniel", "Alex", "Fred"];
        const local = available.filter((voice) => voice.localService);
        const preferredPool = local.length ? local : available;
        const preferred = preferences.map((name) => preferredPool.find((voice) => voice.name === name)).find(Boolean) || preferredPool[role === "employee" && preferredPool.length > 1 ? 1 : 0];
        if (preferred) select.value = preferred.voiceURI;
        else if (role === "employee" && available.length > 1) select.selectedIndex = 1;
      }
    }
  }
  async function speakNative(text, role, entry, timing) {
    cancelPlayback();
    const controller = new AbortController();
    state.audioRequest = controller;
    const generation = state.audioGeneration;
    const active = { native: true, text, role, entry, started: false, finished: false, boundarySeen: false, heardLength: 0, timer: null, latencyRecorded: false };
    state.speech = active;
    const audio = $("native-audio");
    audio.hidden = false;
    audio.volume = 1;
    $("audio-path").textContent = "Using local device speech audio. If playback is blocked, use the audio Play control or Play Rohit’s last reply.";
    audio.onplaying = () => {
      if (state.speech !== active) return;
      active.started = true;
      clearTimeout(active.timer);
      if (timing && !active.latencyRecorded) {
        active.latencyRecorded = true;
        const now = performance.now();
        state.latency.push({ manager_turn_id: timing.turnId, source: timing.source, audio_path: "local-device", measured_at: new Date().toISOString(), time_to_first_sound_ms: Math.round(now - timing.endedAt), transcription_finalization_ms: Math.max(0, Math.round(timing.submittedAt - timing.endedAt)), request_and_playback_ms: Math.round(now - timing.submittedAt) });
        renderLatency();
      }
      updateControls();
    };
    audio.onended = () => {
      if (state.speech !== active) return;
      active.finished = true;
      clearTimeout(active.timer);
      state.speech = null;
      updateControls();
    };
    audio.onerror = () => {
      if (state.speech !== active) return;
      cancelPlayback();
      notify("Local speech audio could not play. Check your device output, then click Test Rohit’s voice or replay the last reply.", true);
    };
    updateControls();
    try {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, role, rate: Number($("speech-rate").value) }), signal: controller.signal });
      if (!response.ok) throw new Error(`Local speech request failed (${response.status}).`);
      const blob = await response.blob();
      if (generation !== state.audioGeneration || state.speech !== active) return;
      if (blob.size <= 44) throw new Error("Local speech returned no usable audio.");
      state.audioRequest = null;
      state.audioURL = URL.createObjectURL(blob);
      audio.src = state.audioURL;
      active.timer = setTimeout(() => {
        if (state.speech !== active || active.started) return;
        if (entry) { entry.text = "[Audio did not start; reply not heard.]"; entry.interrupted = true; entry.unheard = true; renderAllTranscripts(); }
        notify("Audio is ready but playback did not start. Click the audio Play control or Play Rohit’s last reply, and check your device output volume.", true);
      }, 2500);
      const playback = audio.play();
      if (playback?.catch) playback.catch(() => { if (state.speech === active) notify("Local audio is ready. Your browser requires a click: use the audio Play control or Play Rohit’s last reply.", true); });
    } catch (error) {
      if (generation !== state.audioGeneration || error.name === "AbortError") return;
      cancelPlayback();
      notify(`${error.message} Use Test Rohit’s voice to try local playback again.`, true);
    }
  }
  function speak(text, role, entry = null, timing = null) {
    if (state.context?.speech_available) { speakNative(text, role, entry, timing); return; }
    if (!synth || !window.SpeechSynthesisUtterance) {
      if (entry) entry.source = "text only · speech unavailable";
      notify("Speech playback is unavailable in this browser. Use desktop Chrome on this HTTPS site or localhost for spoken rehearsal.", true);
      return;
    }
    cancelPlayback();
    const prefix = role === "employee" ? "" : "Coach speaking. ";
    const utterance = new SpeechSynthesisUtterance(prefix + text);
    const selectedURI = $(role + "-voice").value;
    const selected = state.voices.find((voice) => voice.voiceURI === selectedURI);
    if (selected) utterance.voice = selected;
    utterance.lang = selected?.lang || "en-US";
    utterance.rate = Number($("speech-rate").value);
    utterance.volume = 1;
    const active = { utterance, entry, role, text, boundarySeen: false, heardLength: 0, finished: false, started: false, timer: null };
    state.speech = active;
    utterance.onboundary = (event) => {
      if (state.speech !== active || !Number.isFinite(event.charIndex)) return;
      active.boundarySeen = true;
      // A boundary identifies the word just starting, so retain only text before it.
      active.heardLength = Math.max(active.heardLength, Math.min(text.length, Math.max(0, event.charIndex - prefix.length)));
    };
    utterance.onstart = () => {
      if (state.speech !== active) return;
      active.started = true;
      clearTimeout(active.timer);
      if (timing) {
        const now = performance.now();
        state.latency.push({ manager_turn_id: timing.turnId, source: timing.source, measured_at: new Date().toISOString(), time_to_first_sound_ms: Math.round(now - timing.endedAt), transcription_finalization_ms: Math.max(0, Math.round(timing.submittedAt - timing.endedAt)), request_and_playback_ms: Math.round(now - timing.submittedAt) });
        renderLatency();
      }
      updateControls();
    };
    utterance.onend = () => {
      if (state.speech !== active) return;
      clearTimeout(active.timer);
      active.finished = true;
      state.speech = null;
      updateControls();
    };
    utterance.onerror = (event) => {
      if (state.speech !== active) return;
      cancelPlayback();
      if (event.error !== "canceled" && event.error !== "interrupted") notify(`Speech playback failed (${event.error || "unknown error"}). Check your browser audio output and try again. The transcript marks any uncertain heard portion.`, true);
    };
    active.timer = setTimeout(() => {
      if (state.speech !== active || active.started) return;
      cancelPlayback();
      if (entry) {
        entry.text = "[Audio did not start; reply not heard.]";
        entry.unheard = true;
        renderAllTranscripts();
      }
      notify("Audio did not start. Check your device output and volume, then click Test Rohit’s voice or Play Rohit’s last reply. The original reply is retained for replay; unconfirmed audio is excluded from heard conversation evidence.", true);
    }, 2500);
    try {
      synth.resume();
      synth.speak(utterance);
    } catch (error) {
      cancelPlayback();
      notify(`Browser audio could not start: ${error.message}. Try Test Rohit’s voice, check your output device, then replay the last reply.`, true);
    }
    updateControls();
  }

  async function post(path, payload, generation) {
    const controller = new AbortController();
    state.request = controller;
    updateControls();
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, engine: state.engineSelection }), signal: controller.signal });
      const data = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      if (generation !== state.generation) return null;
      updateEngine(data);
      return data;
    } finally {
      if (state.request === controller) state.request = null;
      updateControls();
    }
  }
  async function submitMessage(text, source, endedAt = performance.now(), captureMethod = null) {
    text = text.trim();
    if (!text || text.length > 4000) { notify("Enter a turn between 1 and 4,000 characters.", true); return; }
    const mode = state.mode;
    if (mode !== "prepare" && mode !== "rehearse") return;
    cancelPlayback();
    abortRequest();
    const generation = state.generation;
    const items = mode === "prepare" ? state.prepare : state.rehearsal;
    // Snapshot excludes the new message: the server appends the submitted message.
    const history = historyFor(items);
    const manager = turn("manager", text, source);
    if (source === "voice") manager.capture_method = captureMethod || "browser-speech-recognition";
    items.push(manager);
    renderAllTranscripts();
    notify();
    const submittedAt = performance.now();
    try {
      const data = await post(`/api/${mode}`, { message: text, history }, generation);
      if (!data || state.mode !== mode) return;
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The server returned no reply. Your manager turn remains in the transcript.");
      const reply = turn(mode === "prepare" ? "coach" : "employee", data.reply);
      reply.generated_text = data.reply;
      reply.engine = data.engine || "unknown";
      reply.model = data.model || null;
      if (data.provider_error) reply.provider_error = String(data.provider_error);
      if (typeof data.agreed === "boolean") reply.agreed = data.agreed;
      items.push(reply);
      if (mode === "rehearse") state.lastEmployeeReply = { text: data.reply, engine: data.engine, model: data.model || null };
      renderAllTranscripts();
      if (mode === "rehearse") speak(data.reply, "employee", reply, { endedAt, submittedAt, source, turnId: manager.id });
      if (data.provider_error) notify(`Gemini unavailable: ${data.provider_error}. This turn uses a scripted demo reply.`, true);
    } catch (error) {
      if (error.name !== "AbortError" && generation === state.generation) notify(`${error.message} Your manager turn is retained; you can continue or retry.`, true);
    }
  }

  function startRecognition() {
    if (state.recognition) { stopAndSend(); return; }
    if ($("voice-input").value === "recording") { startRecording(); return; }
    // User gesture immediately stops playback before opening the mic or aborting fetch.
    cancelPlayback();
    abortRequest();
    if (!Recognition || (!synth && !state.context?.speech_available)) { notify("Spoken rehearsal needs desktop Chrome with speech recognition and audio output. The typed aid is only a troubleshooting path.", true); return; }
    notify();
    const api = new Recognition();
    api.lang = "en-US";
    api.continuous = true;
    api.interimResults = true;
    const session = { api, finalText: "", interimText: "", endedAt: null, stopping: false, cancelled: false, error: null, timer: null };
    state.recognition = session;
    $("live-transcript").textContent = "Listening… speak your opening when ready.";
    api.onresult = (event) => {
      if (state.recognition !== session || session.cancelled) return;
      const finals = [], interims = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        (result.isFinal ? finals : interims).push(result[0].transcript);
      }
      // Rebuild from the recognition result list, rather than appending final/interim twice.
      session.finalText = finals.join(" ").trim();
      session.interimText = interims.join(" ").trim();
      $("live-transcript").textContent = [session.finalText, session.interimText].filter(Boolean).join(" ") || "Listening…";
    };
    api.onspeechstart = () => { if (state.recognition === session && !session.stopping) session.endedAt = null; };
    api.onspeechend = () => { if (state.recognition === session && !session.stopping) session.endedAt = performance.now(); };
    api.onerror = (event) => {
      if (state.recognition !== session || session.cancelled) return;
      session.error = event.error || "unknown";
      notify(voiceError[session.error] || `Speech recognition failed (${session.error}). Try desktop Chrome on this HTTPS site or localhost. No error text was sent as a manager turn.`, true);
    };
    api.onend = () => finishRecognition(session);
    try { api.start(); updateControls(); }
    catch (error) {
      session.error = "start-failed";
      state.recognition = null;
      notify(`Could not start microphone recognition: ${error.message}. Check Chrome microphone access and try again.`, true);
      updateControls();
    }
  }
  function stopAndSend() {
    const session = state.recognition;
    if (!session || session.stopping) return;
    if (session.captureMethod === "media-recorder-gemini") { stopRecording(session); return; }
    session.endedAt = performance.now();
    session.stopping = true;
    updateControls();
    try { session.api.stop(); }
    catch (_) { finishRecognition(session); }
    if (state.recognition !== session) return;
    session.timer = setTimeout(() => {
      if (state.recognition !== session) return;
      try { session.api.abort(); } catch (_) { /* Already ended. */ }
      finishRecognition(session);
    }, 6000);
  }
  function finishRecognition(session) {
    if (state.recognition !== session || session.cancelled) return;
    clearTimeout(session.timer);
    state.recognition = null;
    updateControls();
    if (session.error) {
      const draft = [session.finalText, session.interimText].filter(Boolean).join(" ");
      if (draft) $("typed-input").value = draft;
      $("live-transcript").textContent = draft ? `Unsent speech draft: ${draft}` : "No manager turn was sent. Try the microphone again.";
      return;
    }
    if (!session.finalText) {
      if (session.interimText) $("typed-input").value = session.interimText;
      $("live-transcript").textContent = session.interimText ? `Unsent draft (not finalized): ${session.interimText}` : "No finalized words were captured.";
      notify("The browser returned no final transcript. No turn was sent. Try again, or review the draft in the typed troubleshooting aid.", true);
      return;
    }
    const endedAt = session.endedAt ?? performance.now();
    $("live-transcript").textContent = `Captured: ${session.finalText}`;
    if (session.interimText) notify("Only finalized speech was sent. An unfinished browser draft was left out; check the transcript before continuing.");
    submitMessage(session.finalText, "voice", endedAt);
  }

  async function startRecording() {
    if (!canRecord || !state.context?.transcription_available || !$("audio-consent").checked) {
      notify("To use microphone recording, explicitly check the consent to send your own practice audio to Google Gemini for transcription.", true);
      return;
    }
    cancelPlayback();
    abortRequest();
    const session = { captureMethod: "media-recorder-gemini", api: null, stream: null, chunks: [], bytes: 0, stopping: false, cancelled: false, timer: null, endedAt: null, transcriptionController: null };
    state.recognition = session;
    $("live-transcript").textContent = "Recording only your own voice. Click Stop & send to upload this turn for Gemini transcription. Maximum 60 seconds / 3 MB.";
    notify();
    updateControls();
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
      if (state.recognition !== session || session.cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
      session.stream = stream;
      const choices = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"];
      const mime = choices.find((type) => window.MediaRecorder.isTypeSupported(type));
      const recorder = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      session.api = recorder;
      recorder.ondataavailable = (event) => {
        if (session.cancelled || !event.data?.size) return;
        session.bytes += event.data.size;
        if (session.bytes > 3_000_000) {
          cancelRecognition();
          notify("The recording exceeded 3 MB and was discarded. Try a shorter turn. No recording or manager turn was sent.", true);
          return;
        }
        session.chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (state.recognition !== session) return;
        cancelRecognition();
        notify("Microphone recording failed. Check your input device and try again. Nothing was sent to the conversation.", true);
      };
      recorder.onstop = () => transcribeRecording(session, recorder.mimeType || mime || "audio/webm");
      recorder.start(1000);
      session.timer = setTimeout(() => { if (state.recognition === session) stopRecording(session); }, 60000);
    } catch (error) {
      if (state.recognition !== session || session.cancelled) return;
      cancelRecognition();
      notify(`Could not record your microphone: ${error.message}. Allow microphone access and use only your own voice.`, true);
    }
  }
  function stopRecording(session) {
    if (state.recognition !== session || session.stopping) return;
    if (!session.api) {
      cancelRecognition();
      notify("Microphone opening was cancelled. Click Speak after checking microphone permission.");
      return;
    }
    session.endedAt = performance.now();
    session.stopping = true;
    clearTimeout(session.timer);
    updateControls();
    try { session.api.stop(); }
    catch (error) { cancelRecognition(); notify(`Recording could not finish: ${error.message}. No turn was sent.`, true); }
    session.stream?.getTracks().forEach((track) => track.stop());
  }
  async function transcribeRecording(session, mime) {
    session.stream?.getTracks().forEach((track) => track.stop());
    clearTimeout(session.timer);
    if (state.recognition !== session || session.cancelled) return;
    session.stopping = true;
    session.endedAt ??= performance.now();
    updateControls();
    try {
      if (!$("audio-consent").checked) throw new Error("Audio upload consent is not checked. The recording was discarded.");
      const mimeType = mime.split(";")[0].trim();
      if (!["audio/webm", "audio/mp4", "audio/wav", "audio/ogg"].includes(mimeType)) throw new Error(`Unsupported recording format: ${mimeType}. Try Chrome desktop.`);
      const blob = new Blob(session.chunks, { type: mimeType });
      if (!blob.size || blob.size > 3_000_000) throw new Error("The recording is empty or exceeds 3 MB. Try a shorter turn.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (state.recognition !== session || session.cancelled) return;
      const parts = [];
      for (let offset = 0; offset < bytes.length; offset += 8192) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
      if (!$("audio-consent").checked) throw new Error("Audio upload consent was removed. The recording was discarded.");
      const controller = new AbortController();
      session.transcriptionController = controller;
      const response = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: btoa(parts.join("")), mime_type: mimeType, consent: true }), signal: controller.signal });
      const data = await response.json().catch(() => ({ error: "The transcription service returned an unreadable response." }));
      if (!response.ok) throw new Error(data.error || `Transcription failed (${response.status}).`);
      if (state.recognition !== session || session.cancelled) return;
      if (typeof data.text !== "string" || !data.text.trim()) throw new Error("No words could be transcribed. Check your microphone and try again.");
      state.recognition = null;
      $("live-transcript").textContent = `Captured by Gemini transcription: ${data.text}`;
      updateControls();
      submitMessage(data.text, "voice", session.endedAt, "media-recorder-gemini");
    } catch (error) {
      if (state.recognition !== session || session.cancelled) return;
      state.recognition = null;
      updateControls();
      notify(`${error.message} No manager turn was added. You can retry or change the voice input method.`, true);
      $("live-transcript").textContent = "Recording was not added to the conversation.";
    } finally {
      session.chunks = [];
      session.stream?.getTracks().forEach((track) => track.stop());
    }
  }

  function renderLatency() {
    const voice = state.latency.filter((sample) => sample.source === "voice");
    const typed = state.latency.filter((sample) => sample.source !== "voice");
    if (voice.length) {
      const values = voice.map((sample) => sample.time_to_first_sound_ms).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
      $("latency-latest").textContent = `${(voice.at(-1).time_to_first_sound_ms / 1000).toFixed(2)} s latest`;
      $("latency-summary").textContent = `${voice.length} spoken sample${voice.length === 1 ? "" : "s"} · median ${(median / 1000).toFixed(2)} s · range ${(values[0] / 1000).toFixed(2)}–${(values.at(-1) / 1000).toFixed(2)} s. Includes final transcription.`;
    }
    $("typed-latency").textContent = `Typed diagnostic samples: ${typed.length}${typed.length ? ` · latest ${(typed.at(-1).time_to_first_sound_ms / 1000).toFixed(2)} s (not a voice sample)` : ""}`;
  }

  async function requestDebrief() {
    $("debrief-loading").replaceChildren(node("h2", "Reviewing your conversation…"), node("p", "Looking for specific moments and a useful next step."));
    $("debrief-loading").hidden = false;
    $("debrief-content").hidden = true;
    $("print-takeaway").disabled = true;
    const generation = state.generation;
    try {
      const data = await post("/api/debrief", { history: historyFor(state.rehearsal) }, generation);
      if (!data || state.mode !== "debrief") return;
      state.debrief = data;
      renderDebrief(data);
      $("debrief-loading").hidden = true;
      $("debrief-content").hidden = false;
      $("print-takeaway").disabled = false;
    } catch (error) {
      if (error.name !== "AbortError" && generation === state.generation) {
        $("debrief-loading").replaceChildren(node("h2", "The debrief could not be loaded."), node("p", error.message));
        notify("Your transcript is still available. Continue practising, then open Debrief to try again.", true);
      }
    }
  }
  function renderDebrief(data) {
    const target = $("debrief-content");
    target.replaceChildren();
    const readiness = data.readiness || { level: "insufficient", text: "There is not enough rehearsal evidence yet." };
    const readinessCard = node("article", null, `readiness ${["ready", "practice", "hr", "insufficient"].includes(readiness.level) ? readiness.level : "insufficient"}`);
    readinessCard.append(node("p", "YOUR NEXT STEP", "eyebrow"), node("h2", readiness.text), node("p", "Rehearsal guidance based on this session. This is not an HR determination or a prediction of the real conversation."));
    target.append(readinessCard);
    const grid = node("div", null, "debrief-grid");
    const moments = node("article", null, "card");
    moments.append(node("p", "FROM YOUR OWN WORDS", "eyebrow"), node("h2", "Moments to learn from"));
    if (!(data.moments || []).length) moments.append(node("p", "More rehearsal is needed before the coach can quote specific moments. No examples have been invented."));
    for (const moment of data.moments || []) {
      const item = node("div", null, "moment");
      item.append(node("span", moment.kind === "worked" ? "Keep this" : "Try differently", `speaker-tag ${moment.kind === "worked" ? "coach" : "employee"}`));
      item.append(node("blockquote", `“${moment.quote}”`), node("p", moment.explanation));
      moments.append(item);
    }
    const opening = node("article", null, "card opening-card");
    opening.append(node("p", "SOMETHING YOU CAN SAY TOMORROW", "eyebrow"), node("h2", "Your opening, rewritten"), node("blockquote", data.opening || "Practise an opening to get a grounded rewrite."));
    const objections = node("article", null, "card");
    objections.append(node("p", "PRACTISE THE PUSHBACK", "eyebrow"), node("h2", "What to say when it gets difficult"));
    objections.append(node("p", "These concerns come from the simulated conversation, not from Rohit’s employee record.", "small"));
    if (!(data.objections || []).length) objections.append(node("p", "No grounded objections yet. Rehearse further so the coach can use the pushback that actually arose."));
    for (const objection of data.objections || []) {
      const item = node("div", null, "objection");
      item.append(node("strong", `“${objection.objection}”`), node("p", objection.response));
      objections.append(item);
    }
    const next = node("article", null, "card");
    next.append(node("p", "MAKE IT PRACTICAL", "eyebrow"), node("h2", "Before the real conversation"));
    const list = node("ol", null, "next-steps");
    (data.next_steps || []).forEach((step) => list.append(node("li", step)));
    next.append(list);
    grid.append(moments, opening, objections, next);
    target.append(grid);
    const limitations = node("article", null, "card limitations-card");
    limitations.append(node("p", "READ THIS ALONGSIDE THE ADVICE", "eyebrow"), node("h2", "What this rehearsal can tell you"));
    const limits = node("ul", null, "plain-list");
    (data.limitations || []).forEach((limit) => limits.append(node("li", limit)));
    const voiceTurns = state.rehearsal.filter((item) => item.role === "manager" && item.source === "voice").length;
    limits.append(node("li", `${voiceTurns} manager turn${voiceTurns === 1 ? "" : "s"} captured through browser recognition; ${state.latency.filter((sample) => sample.source === "voice").length} spoken response latency samples. This does not establish end-to-end voice verification.`));
    limitations.append(limits);
    target.append(limitations);
  }

  function downloadSession() {
    const payload = { generated_at: new Date().toISOString(), scenario: "Synthetic repeated-lateness practice", engine_selection: state.engineSelection, engine_label: $("engine-badge").textContent, engine_note: "Engine selection is manual. Individual response turns retain their producing engine/model; sessions may contain multiple engines.", prepare: state.prepare, rehearsal: state.rehearsal, debrief: state.debrief, latency: { units: "milliseconds", measurement: "Manager Stop & send (or recognition speechend) through final transcription to speech synthesis onstart; approximate browser timestamps.", samples: state.latency }, voice_verification: "Not established by transcript or automated checks. Test with your own voice." };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = node("a");
    anchor.href = url;
    anchor.download = "feedback-coach-session.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  $("start-prepare").addEventListener("click", () => switchMode("prepare"));
  $("start-rehearse").addEventListener("click", () => switchMode("rehearse"));
  $("prepare-to-rehearse").addEventListener("click", () => switchMode("rehearse"));
  $("finish-rehearsal").addEventListener("click", () => switchMode("debrief"));
  $("try-again").addEventListener("click", () => switchMode("rehearse"));
  $("prepare-form").addEventListener("submit", (event) => { event.preventDefault(); const text = $("prepare-input").value; $("prepare-input").value = ""; submitMessage(text, "typed"); });
  $("typed-form").addEventListener("submit", (event) => { event.preventDefault(); const text = $("typed-input").value; $("typed-input").value = ""; submitMessage(text, "typed"); });
  $("speak-button").addEventListener("click", startRecognition);
  $("voice-input").addEventListener("change", () => { $("audio-consent-note").hidden = $("voice-input").value !== "recording"; updateControls(); });
  $("audio-consent").addEventListener("change", updateControls);
  $("stop-send").addEventListener("click", stopAndSend);
  $("stop-audio").addEventListener("click", () => cancelPlayback());
  $("test-voice").addEventListener("click", () => {
    notify("Voice test only. This does not call a model or add a rehearsal turn. Check your device output if you hear nothing.");
    speak("This is Rohit’s voice. I’m ready to talk.", "employee");
  });
  $("replay-reply").addEventListener("click", () => {
    if (!state.lastEmployeeReply) return;
    if (state.speech?.native && state.speech.role === "employee" && state.speech.text === state.lastEmployeeReply.text && $("native-audio").src) {
      const playback = $("native-audio").play();
      if (playback?.catch) playback.catch(() => notify("Click the visible audio Play control and check your device output volume.", true));
      return;
    }
    notify("Replaying the original generated reply. Replay does not change the recorded heard prefix or count as a new conversation turn.");
    speak(state.lastEmployeeReply.text, "employee");
  });
  $("speech-rate").addEventListener("input", () => { $("rate-value").textContent = `${Number($("speech-rate").value).toFixed(1)}×`; });
  $("print-takeaway").addEventListener("click", () => window.print());
  $("download-session").addEventListener("click", downloadSession);
  $("engine-select").addEventListener("change", () => {
    if (state.request || state.recognition) {
      $("engine-select").value = state.engineSelection;
      notify("Finish your spoken turn and wait for the current response before changing the session engine.");
      return;
    }
    cancelPlayback();
    abortRequest();
    state.engineSelection = $("engine-select").value === "scripted" ? "scripted" : "auto";
    updateEngine(state.engineSelection === "scripted" ? { engine: "scripted", model: null } : state.context);
    notify(state.engineSelection === "scripted" ? "You selected scripted replies, with no coaching model. Gemini transcription remains a separate consented voice input option. Existing transcript turns keep their original engine labels." : "You selected the configured live engine. Future replies use the server’s configured engine; existing transcript turns are retained.");
  });
  window.addEventListener("beforeunload", () => { if (synth) synth.cancel(); cancelRecognition(); });
  if (synth) { populateVoices(); synth.addEventListener("voiceschanged", populateVoices); }
  $("browser-support").textContent = Recognition && synth ? "Speech APIs detected. Use desktop Chrome on HTTPS or localhost. Recognition may use an online browser service. Test your microphone with your own voice." : "Some speech APIs are unavailable here. Use desktop Chrome on this HTTPS site or localhost and allow microphone access. Check whether Microphone recording → Gemini is available; typed troubleshooting does not verify voice.";
  if (!Recognition || !synth) notify("Some speech APIs are unavailable in this browser. Use desktop Chrome on this HTTPS site or localhost, or check the separate Gemini recording input. Typed testing does not verify voice.");
  renderAllTranscripts();
  updateControls();
  fetch("/api/context").then(async (response) => {
    if (!response.ok) throw new Error(`Context request failed (${response.status}).`);
    return response.json();
  }).then((data) => { state.context = data; renderContext(data); if (data.engine === "scripted") $("engine-select").options[0].textContent = "Configured default — scripted"; updateControls(); }).catch((error) => { $("employee-name").textContent = "Context unavailable"; $("engine-badge").textContent = "ENGINE UNAVAILABLE"; notify(`${error.message} Reload the app when its hosted service or local Python server is available.`, true); });
})();
