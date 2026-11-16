"""Validated JSON transport for the hosted component; no Streamlit dependency.

The limiter counts admitted provider-backed requests, including failed requests.
It is process-local and resets on restart, so it is not a provider billing cap.
"""
from collections import OrderedDict, deque
from contextlib import contextmanager, nullcontext
from copy import deepcopy
import hashlib
import json
import re
import threading
import time

import app
import audio_input
import coach


class ProviderLimitError(Exception):
    """The process-wide provider request budget or concurrency was exhausted."""


class ProviderLimiter:
    def __init__(self, max_calls=60, max_concurrent=2, window_seconds=3600, clock=time.monotonic):
        if max_calls < 1 or max_concurrent < 1 or window_seconds <= 0:
            raise ValueError("Provider limits must be positive.")
        self.max_calls = max_calls
        self.max_concurrent = max_concurrent
        self.window_seconds = window_seconds
        self.clock = clock
        self._attempts = deque()
        self._active = 0
        self._lock = threading.Lock()

    @contextmanager
    def slot(self):
        with self._lock:
            now = self.clock()
            while self._attempts and self._attempts[0] <= now - self.window_seconds:
                self._attempts.popleft()
            if self._active >= self.max_concurrent:
                raise ProviderLimitError("The demo is handling other model requests. Retry shortly or use Scripted Demo.")
            if len(self._attempts) >= self.max_calls:
                raise ProviderLimitError("The demo's shared hourly model-request limit has been reached. Try later or use Scripted Demo.")
            self._attempts.append(now)
            self._active += 1
        try:
            yield
        finally:
            with self._lock:
                self._active -= 1


class RequestError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


_ROUTES = {
    "/api/context": "GET",
    "/api/prepare": "POST",
    "/api/rehearse": "POST",
    "/api/debrief": "POST",
    "/api/transcribe": "POST",
    "/api/speech": "POST",
}
_FIELDS = {
    "/api/prepare": {"message", "history", "engine"},
    "/api/rehearse": {"message", "history", "engine"},
    "/api/debrief": {"history", "engine"},
    "/api/transcribe": {"audio", "mime_type", "consent"},
    "/api/speech": {"text", "role", "rate"},
}


def _safe_id(value):
    return value if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value) else None


def _validate_request(request):
    if not isinstance(request, dict) or set(request) != {"id", "method", "path", "body"}:
        raise RequestError(400, "Expected a component request with id, method, path and body.")
    identifier = _safe_id(request["id"])
    if identifier is None or not isinstance(request["method"], str) or not isinstance(request["path"], str):
        raise RequestError(400, "The component request identifier, method or path is invalid.")
    method, path, body = request["method"], request["path"], request["body"]
    if path not in _ROUTES:
        raise RequestError(404, "Unknown application route.")
    if method != _ROUTES[path]:
        raise RequestError(405, "This method is not allowed for the application route.")
    if (method == "GET" and body is not None) or (method == "POST" and not isinstance(body, dict)):
        raise RequestError(400, "GET requests require a null body; POST requests require a JSON object.")
    try:
        encoded = json.dumps(body, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8")
    except (ValueError, TypeError, RecursionError, UnicodeError):
        raise RequestError(400, "The request body must contain valid JSON values.") from None
    limit = 4_100_000 if path == "/api/transcribe" else 250_000
    if len(encoded) > limit:
        raise RequestError(413, "The request body exceeds this route's size limit.")
    if method == "POST" and not set(body).issubset(_FIELDS[path]):
        raise RequestError(400, "The request body contains unsupported fields.")
    if path in {"/api/prepare", "/api/rehearse", "/api/debrief"}:
        engine = body.get("engine")
        if engine is not None and (not isinstance(engine, str) or engine not in {"auto", "scripted"}):
            raise RequestError(400, "Select Auto or Scripted Demo for the conversation engine.")
    fingerprint = hashlib.sha256(method.encode() + b"\0" + path.encode() + b"\0" + encoded).hexdigest()
    return identifier, path, body, fingerprint


class SessionDispatcher:
    """One browser session's bounded response cache, with a shared limiter.

    Reusing a request ID returns its prior result, rather than invoking a provider
    again during a Streamlit rerun. IDs expire when their bounded cache entries
    are evicted; this is replay protection for reruns, not a durable audit log.
    """
    def __init__(self, limiter, max_cached=128):
        if max_cached < 1:
            raise ValueError("The response cache must retain at least one request.")
        self.limiter = limiter
        self.max_cached = max_cached
        self._responses = OrderedDict()
        self._lock = threading.Lock()

    @property
    def cached_count(self):
        with self._lock:
            return len(self._responses)

    def handle(self, request):
        identifier = _safe_id(request.get("id")) if isinstance(request, dict) else None
        try:
            identifier, path, body, fingerprint = _validate_request(request)
        except RequestError as error:
            return {"id": identifier, "status": error.status, "body": {"error": str(error)}}
        # Serialize this session's work; separate sessions may use separate slots.
        with self._lock:
            if identifier in self._responses:
                previous_fingerprint, response = self._responses[identifier]
                if previous_fingerprint != fingerprint:
                    return {"id": identifier, "status": 409, "body": {"error": "A request ID cannot be reused for different input."}}
                return deepcopy(response)
            status, value = self._dispatch(path, body)
            response = {"id": identifier, "status": status, "body": value}
            self._responses[identifier] = (fingerprint, deepcopy(response))
            while len(self._responses) > self.max_cached:
                self._responses.popitem(last=False)
            return response

    def _dispatch(self, path, body):
        try:
            if path == "/api/context":
                return 200, {**coach.context(), "speech_available": False,
                             "transcription_available": bool(coach.settings()["api_key"])}
            if path == "/api/speech":
                return 503, {"error": "Hosted speech uses your browser voice. Use Test Rohit's voice or Play last reply."}
            if path == "/api/transcribe":
                if body.get("consent") is not True:
                    raise PermissionError("Allow sending your own practice recording to Google before transcription.")
                with self.limiter.slot():
                    value = audio_input.transcribe(body.get("audio"), body.get("mime_type"), consent=True)
            else:
                message, history = app.validate(body, needs_message=path != "/api/debrief")
                if path in {"/api/rehearse", "/api/debrief"} and any(item["role"] == "coach" for item in history):
                    raise ValueError("Rehearsal and debrief require manager and employee turns only.")
                scripted = body.get("engine") == "scripted"
                uses_provider = bool(coach.settings()["api_key"]) and not scripted
                with self.limiter.slot() if uses_provider else nullcontext():
                    if path == "/api/prepare":
                        value = coach.prepare(message, history, force_scripted=scripted)
                    elif path == "/api/rehearse":
                        value = coach.rehearse_with_fallback(message, history, force_scripted=scripted)
                        if value.get("provider_error"):
                            value = {**value, "provider_error": "The configured model provider could not complete this turn."}
                    else:
                        value = coach.debrief(history, force_scripted=scripted)
            # Only JSON values may cross the component boundary.
            json.dumps(value, allow_nan=False)
            return 200, value
        except PermissionError:
            return 403, {"error": "Explicit consent is required to send your own practice recording to Google."}
        except ProviderLimitError as error:
            return 429, {"error": str(error)}
        except coach.ProviderError:
            return 502, {"error": "The model provider could not complete this request. Retry later or choose Scripted Demo for coaching replies."}
        except (ValueError, TypeError, RecursionError, UnicodeError):
            return 400, {"error": "Invalid input. Check your message, rehearsal transcript or consented audio format and size."}
        except Exception:
            return 500, {"error": "The hosted service could not complete this request. Retry with a new turn."}
