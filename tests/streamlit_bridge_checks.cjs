"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "..", "static", "streamlit-bridge.js"), "utf8");
let checks = 0;
function check(condition, message) { checks += 1; assert.ok(condition, message); }
function environment({ embedded = true, pathname = "/component/test.coach/index.html", streamlitUrl = "https://coach.test/", parameter = true } = {}) {
  const messages = [], nativeCalls = [], events = new Map(), frames = [], timers = new Set(), observers = [];
  const parent = { postMessage(message, targetOrigin) { messages.push({ message, targetOrigin }); } };
  const nativeFetch = async (...args) => { nativeCalls.push(args); return new Response(JSON.stringify({ native: true }), { status: 200 }); };
  const location = new URL(`https://coach.test${pathname}${parameter ? `?streamlitUrl=${encodeURIComponent(streamlitUrl)}` : ""}`);
  const document = { body: { scrollHeight: 950 }, readyState: "complete", addEventListener() {} };
  const window = {
    parent, location, document, fetch: nativeFetch, crypto: crypto.webcrypto,
    addEventListener(type, listener) { if (!events.has(type)) events.set(type, []); events.get(type).push(listener); },
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    ResizeObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} },
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} }
  };
  if (!embedded) window.parent = window;
  const sandbox = { window, document, URL, Response, DOMException, AbortController, TextEncoder, JSON,
    setTimeout(callback, delay) { const timer = { callback, delay }; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); }
  };
  vm.runInNewContext(source, sandbox, { filename: "streamlit-bridge.js" });
  const emit = (type, event) => (events.get(type) || []).forEach((listener) => listener(event));
  return { window, document, messages, nativeCalls, timers,
    requests: () => messages.filter(({ message }) => message.type === "streamlit:setComponentValue").map(({ message }) => message.value),
    render(response, overrides = {}) { emit("message", { source: parent, origin: "https://coach.test", data: { type: "streamlit:render", args: { response } }, ...overrides }); },
    flushFrames() { const pending = frames.splice(0); pending.forEach((callback) => callback()); },
    resize(height) { document.body.scrollHeight = height; observers.forEach((observer) => observer.callback()); },
    unload() { emit("beforeunload", {}); }, nativeFetch
  };
}
const response = (request, body, status = 200) => ({ id: request.id, status, body });
async function main() {
  for (const options of [{ embedded: false }, { parameter: false }, { pathname: "/" }, { streamlitUrl: "javascript:alert(1)" }]) {
    const local = environment(options);
    check(local.window.fetch === local.nativeFetch, "local/unverified embedding keeps native fetch unchanged");
    check(local.messages.length === 0, "local page sends no Streamlit messages");
  }
  const app = environment();
  check(app.messages.length === 1 && app.messages[0].message.type === "streamlit:componentReady", "component announces readiness once");
  check(app.messages[0].message.apiVersion === 1 && app.messages[0].message.isStreamlitMessage === true, "official v1 ready envelope");
  check(app.messages[0].targetOrigin === "https://coach.test", "messages target verified parent origin");
  const first = app.window.fetch("/api/context");
  const second = app.window.fetch("/api/prepare", { method: "POST", body: JSON.stringify({ message: "Help me prepare", history: [] }) });
  check(app.requests().length === 0, "API requests wait for verified render handshake");
  app.render(null, { origin: "https://untrusted.test" });
  app.render(null, { source: {} });
  check(app.requests().length === 0, "wrong parent source/origin cannot activate bridge");
  app.render(null);
  let sent = app.requests();
  check(sent.length === 1 && sent[0].path === "/api/context", "only first request sent after handshake");
  check(sent[0].method === "GET" && sent[0].body === null && typeof sent[0].id === "string", "exact context request shape");
  const firstId = sent[0].id;
  app.render({ id: "unknown-response", status: 200, body: {} });
  check(app.requests().length === 1, "unknown response cannot release queue slot");
  app.render(response(sent[0], { employee: { name: "Rohit" } }));
  check((await (await first).json()).employee.name === "Rohit", "bridge returns a normal JSON Response");
  sent = app.requests();
  check(sent.length === 2 && sent[1].path === "/api/prepare", "next request sent only after first response");
  check(sent[1].id !== firstId && sent[1].body.message === "Help me prepare", "unique ID and parsed JSON payload preserved");
  app.render(response(sent[0], { employee: { name: "STALE" } }));
  check(app.requests().length === 2, "duplicate old response ignored during next request");
  app.render(response(sent[1], { error: "Provider unavailable" }, 502));
  const failedResponse = await second;
  check(!failedResponse.ok && failedResponse.status === 502 && (await failedResponse.json()).error === "Provider unavailable", "HTTP errors preserve status and JSON body");
  const fetchBeforeRerender = app.window.fetch;
  app.render(response(sent[1], { reply: "duplicate" }));
  check(app.window.fetch === fetchBeforeRerender && app.requests().length === 2, "rerenders preserve bridge and do not repeat API calls");

  const activeController = new AbortController();
  const active = app.window.fetch("/api/rehearse", { method: "POST", body: JSON.stringify({ message: "One", history: [] }), signal: activeController.signal });
  const activeFailure = active.catch((error) => error);
  const queuedController = new AbortController();
  const queued = app.window.fetch("/api/debrief", { method: "POST", body: "{}", signal: queuedController.signal });
  const queuedFailure = queued.catch((error) => error);
  const last = app.window.fetch("/api/prepare", { method: "POST", body: "{}" });
  queuedController.abort();
  check((await queuedFailure).name === "AbortError", "queued abort rejects immediately");
  activeController.abort();
  check((await activeFailure).name === "AbortError", "active abort rejects immediately");
  check(app.requests().length === 3, "active abort retains slot until backend response");
  app.render(response(app.requests()[2], { reply: "Cancelled result" }));
  check(app.requests().length === 4 && app.requests()[3].path === "/api/prepare", "aborted queued request skipped; response drains active slot");
  app.render(response(app.requests()[3], { reply: "Still usable" }));
  check((await (await last).json()).reply === "Still usable", "queue works after cancellation");
  const preAborted = new AbortController(); preAborted.abort();
  check((await app.window.fetch("/api/context", { signal: preAborted.signal }).catch((error) => error)).name === "AbortError", "pre-aborted request never sends");
  check(app.requests().length === 4, "pre-aborted request does not allocate active slot");
  check((await app.window.fetch("/api/prepare", { method: "POST", body: "not JSON" }).catch((error) => error)).name === "TypeError", "malformed JSON rejected before sending");
  await app.window.fetch("https://other.test/api/context");
  await app.window.fetch("/unrelated");
  check(app.nativeCalls.length === 2, "cross-origin and unrelated fetches remain native");
  app.flushFrames();
  let heights = app.messages.filter(({ message }) => message.type === "streamlit:setFrameHeight");
  check(heights.length === 1 && heights[0].message.height === 950, "initial component height announced");
  app.resize(50000); app.resize(50000); app.flushFrames();
  heights = app.messages.filter(({ message }) => message.type === "streamlit:setFrameHeight");
  check(heights.length === 2 && heights[1].message.height <= 12000, "height updates coalesced and bounded");
  app.resize(50000); app.flushFrames();
  check(app.messages.filter(({ message }) => message.type === "streamlit:setFrameHeight").length === 2, "unchanged height not retransmitted");
  const timed = app.window.fetch("/api/context");
  const timedFailure = timed.catch((error) => error);
  [...app.timers].find((timer) => timer.delay === 45000).callback();
  check((await timedFailure).name === "TimeoutError", "missing response times out with actionable failure");
  const noHandshake = environment();
  const waiting = noHandshake.window.fetch("/api/context").catch((error) => error);
  [...noHandshake.timers].find((timer) => timer.delay === 10000).callback();
  check((await waiting).message.includes("handshake"), "missing parent handshake fails clearly");
  check(noHandshake.requests().length === 0, "unverified parent never receives API payloads");
  const closing = app.window.fetch("/api/context").catch((error) => error);
  app.unload();
  check((await closing).name === "AbortError", "iframe unload rejects pending work");
  console.log(`PASS: ${checks} bridge checks (local HTTP, verified handshake, JSON responses, serialization, abort/stale handling, sizing, timeouts, unload).`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
