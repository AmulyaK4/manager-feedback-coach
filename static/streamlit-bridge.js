"use strict";

// Keep the local HTTP app untouched. Streamlit serves a declared component at
// /component/<registered name>/index.html and supplies its parent URL.
(() => {
  let parentURL;
  try {
    const componentURL = new URL(window.location.href);
    const parentAddress = componentURL.searchParams.get("streamlitUrl");
    if (window.parent === window || !parentAddress || !/\/component\/[^/]+\/index\.html$/.test(componentURL.pathname)) return;
    parentURL = new URL(parentAddress);
    if (!["http:", "https:"].includes(parentURL.protocol)) return;
  } catch (_) {
    return;
  }

  const parentOrigin = parentURL.origin;
  const nativeFetch = window.fetch.bind(window);
  const routes = new Map([
    ["/api/context", "GET"], ["/api/prepare", "POST"],
    ["/api/rehearse", "POST"], ["/api/debrief", "POST"],
    ["/api/transcribe", "POST"], ["/api/speech", "POST"]
  ]);
  const clientID = window.crypto.randomUUID();
  const queue = [];
  let sequence = 0;
  let verified = false;
  let failure = null;
  let closed = false;
  let active = null;
  let heightScheduled = false;
  let lastHeight = null;
  let resizeObserver = null;
  let mutationObserver = null;

  function abortError() {
    return new DOMException("The request was aborted. Any late response will be ignored.", "AbortError");
  }
  function send(type, data) {
    window.parent.postMessage({ isStreamlitMessage: true, type, ...data }, parentOrigin);
  }
  function settle(item, response, error) {
    if (item.settled) return;
    item.settled = true;
    if (item.signal && item.abortListener) item.signal.removeEventListener("abort", item.abortListener);
    if (error) item.reject(error); else item.resolve(response);
  }
  function pump() {
    if (!verified || failure || closed || active) return;
    while (queue.length) {
      const next = queue.shift();
      if (next.settled) continue;
      active = next;
      next.timer = setTimeout(() => {
        if (active !== next) return;
        active = null;
        settle(next, null, new DOMException("The hosted service did not respond in 45 seconds. Your turn remains in the transcript; retry when the service is available.", "TimeoutError"));
        pump();
      }, 45000);
      send("streamlit:setComponentValue", { dataType: "json", value: next.request });
      return;
    }
  }
  function scheduleHeight() {
    if (!verified || closed || heightScheduled) return;
    heightScheduled = true;
    window.requestAnimationFrame(() => {
      heightScheduled = false;
      if (closed || !document.body) return;
      const height = Math.min(12000, Math.max(200, Math.ceil(document.body.scrollHeight)));
      if (!Number.isFinite(height) || height === lastHeight) return;
      lastHeight = height;
      send("streamlit:setFrameHeight", { height });
    });
  }
  function startSizing() {
    if (!document.body || resizeObserver || mutationObserver) return;
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(scheduleHeight);
      resizeObserver.observe(document.body);
    }
    if (window.MutationObserver) {
      mutationObserver = new window.MutationObserver(scheduleHeight);
      mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    scheduleHeight();
  }

  window.fetch = (input, options = {}) => {
    let url;
    try { url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url, window.location.href); }
    catch (_) { return nativeFetch(input, options); }
    if (url.origin !== window.location.origin || !routes.has(url.pathname)) return nativeFetch(input, options);
    if (closed) return Promise.reject(abortError());
    if (failure) return Promise.reject(failure);
    const signal = options.signal || (typeof input === "object" && input.signal);
    if (signal?.aborted) return Promise.reject(abortError());
    const method = String(options.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    if (routes.get(url.pathname) !== method) return Promise.reject(new TypeError("This application route does not support that request method."));
    let body = null;
    try {
      if (method === "POST") {
        if (typeof options.body !== "string") throw new TypeError("Hosted requests must contain a JSON body.");
        body = JSON.parse(options.body);
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("Hosted requests require a JSON object.");
      }
    } catch (_) {
      return Promise.reject(new TypeError("Hosted requests require a valid JSON object body."));
    }
    if (queue.length >= 8) return Promise.reject(new Error("Too many requests are waiting. Finish the current turn and retry."));
    return new Promise((resolve, reject) => {
      const item = { request: { id: `${clientID}:${++sequence}`, method, path: url.pathname, body }, signal, resolve, reject, settled: false, timer: null, abortListener: null };
      item.abortListener = () => {
        settle(item, null, abortError());
        // An already-sent value occupies Streamlit's single widget slot until
        // its response arrives. Releasing it now could overwrite a new request.
        if (active !== item) {
          const position = queue.indexOf(item);
          if (position !== -1) queue.splice(position, 1);
          pump();
        }
      };
      if (signal) signal.addEventListener("abort", item.abortListener, { once: true });
      queue.push(item);
      pump();
    });
  };

  const handshakeTimer = setTimeout(() => {
    if (verified || closed) return;
    failure = new Error("The Streamlit component handshake did not complete. Reload the hosted app and try again.");
    for (const item of queue.splice(0)) settle(item, null, failure);
  }, 10000);

  window.addEventListener("message", (event) => {
    if (closed || failure || event.source !== window.parent || event.origin !== parentOrigin) return;
    if (!event.data || event.data.type !== "streamlit:render" || !event.data.args || typeof event.data.args !== "object") return;
    if (!verified) {
      verified = true;
      clearTimeout(handshakeTimer);
      startSizing();
    }
    const response = event.data.args.response;
    if (active && response && response.id === active.request.id) {
      const completed = active;
      active = null;
      clearTimeout(completed.timer);
      if (!completed.settled) {
        try {
          if (!Number.isInteger(response.status) || response.status < 200 || response.status > 599) throw new TypeError("The hosted service returned an invalid response status.");
          const body = [204, 205, 304].includes(response.status) ? null : JSON.stringify(response.body ?? null);
          settle(completed, new Response(body, { status: response.status, headers: { "Content-Type": "application/json; charset=utf-8" } }));
        } catch (error) { settle(completed, null, error); }
      }
    }
    pump();
    scheduleHeight();
  });
  window.addEventListener("resize", scheduleHeight);
  document.addEventListener("DOMContentLoaded", () => { if (verified) startSizing(); });
  window.addEventListener("beforeunload", () => {
    closed = true;
    clearTimeout(handshakeTimer);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (active) { clearTimeout(active.timer); settle(active, null, abortError()); active = null; }
    for (const item of queue.splice(0)) settle(item, null, abortError());
  });
  send("streamlit:componentReady", { apiVersion: 1 });
})();
