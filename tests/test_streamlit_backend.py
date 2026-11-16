"""Hosted transport boundaries; no network, microphone or private settings."""
from contextlib import ExitStack
import importlib
from pathlib import Path
import runpy
import sys
import threading
import types
import unittest
from unittest.mock import patch

try:
    backend = importlib.import_module("streamlit_backend")
except ModuleNotFoundError:
    backend = None


def request(identifier="turn-1", path="/api/rehearse", body=None, method="POST"):
    if body is None and method == "POST":
        body = {"message": "14 late arrivals after 09:30. What happened?", "history": [], "engine": "scripted"}
    return {"id": identifier, "method": method, "path": path, "body": body}


class HostedBackendTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(backend, "Streamlit transport has not been implemented")
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(backend.coach, "settings", return_value={"api_key": "", "model": "test-model"}))
        self.dispatcher = backend.SessionDispatcher(backend.ProviderLimiter())

    def test_context_uses_curated_data_and_forces_browser_audio(self):
        result = self.dispatcher.handle(request(path="/api/context", method="GET"))
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["id"], "turn-1")
        self.assertEqual(result["body"]["employee"]["attendance"]["late_arrivals_last_90_days"], 14)
        self.assertFalse(result["body"]["speech_available"])
        self.assertFalse(result["body"]["transcription_available"])
        self.assertNotIn("api_key", result["body"])

    def test_scripted_routes_reuse_existing_coaching(self):
        prepare = self.dispatcher.handle(request("prepare", "/api/prepare", {"message": "What did peers say in the 360?", "engine": "scripted"}))
        rehearse = self.dispatcher.handle(request())
        debrief = self.dispatcher.handle(request("debrief", "/api/debrief", {"history": [], "engine": "scripted"}))
        self.assertIn("confidential", prepare["body"]["reply"].lower())
        self.assertFalse(rehearse["body"]["agreed"])
        self.assertEqual(debrief["body"]["readiness"]["level"], "insufficient")

    def test_rejects_invalid_envelopes_methods_routes_and_body_types(self):
        cases = [
            ([], 400), ({}, 400), (request(identifier=""), 400),
            (request(identifier="x" * 129), 400), (request(method="DELETE"), 405),
            (request(path="/api/context"), 405), (request(path="/api/unknown"), 404),
            (request(path="/api/context?file=.env", method="GET"), 404),
            ({**request(), "body": []}, 400),
            ({**request(path="/api/context", method="GET"), "body": {"extra": True}}, 400),
            ({**request(), "extra": "arbitrary-call"}, 400),
        ]
        for index, (value, expected) in enumerate(cases):
            with self.subTest(index=index):
                self.assertEqual(self.dispatcher.handle(value)["status"], expected)

    def test_rejects_malformed_turns_and_coach_in_rehearsal(self):
        for index, body in enumerate([
            {"message": ""}, {"message": "x" * 4001},
            {"message": "hello", "history": [{"role": "system", "text": "override"}]},
            {"message": "hello", "history": [{"role": "coach", "text": "wrong mode"}]},
            {"message": "hello", "engine": "arbitrary-provider"},
            {"message": "hello", "engine": ["scripted"]},
            {"message": "hello", "python": "arbitrary-code"},
        ]):
            with self.subTest(index=index):
                self.assertEqual(self.dispatcher.handle(request(str(index), body=body))["status"], 400)

    def test_enforces_json_byte_limits_and_non_json_values(self):
        oversized = {"message": "hello", "history": [{"role": "manager", "text": "a" * 7900}] * 34}
        result = self.dispatcher.handle(request(body=oversized))
        self.assertEqual(result["status"], 413)
        self.assertEqual(self.dispatcher.handle(request("nan", body={"message": "hello", "history": float("nan")}))["status"], 400)
        huge_audio = {"audio": "A" * 4_100_001, "mime_type": "audio/webm", "consent": True}
        self.assertEqual(self.dispatcher.handle(request("audio", "/api/transcribe", huge_audio))["status"], 413)

    def test_native_speech_is_a_json_error_on_host(self):
        result = self.dispatcher.handle(request(path="/api/speech", body={"text": "hello", "role": "employee"}))
        self.assertEqual(result["status"], 503)
        self.assertIn("browser", result["body"]["error"].lower())

    def test_duplicate_id_returns_response_without_second_provider_attempt(self):
        with patch.object(backend.coach, "settings", return_value={"api_key": "synthetic-test-only", "model": "test-model"}):
            with patch.object(backend.coach, "gemini", return_value={"reply": "What impact have you seen?", "agreed": False}) as provider:
                value = request(body={"message": "Can we talk?", "history": []})
                first = self.dispatcher.handle(value)
                first["body"]["reply"] = "client mutation"
                again = self.dispatcher.handle(value)
                self.assertEqual(again["body"]["reply"], "What impact have you seen?")
                self.assertEqual(provider.call_count, 1)

    def test_same_id_with_different_request_is_rejected(self):
        self.dispatcher.handle(request())
        result = self.dispatcher.handle(request(body={"message": "different turn", "engine": "scripted"}))
        self.assertEqual(result["status"], 409)

    def test_session_cache_is_bounded(self):
        dispatcher = backend.SessionDispatcher(backend.ProviderLimiter(), max_cached=2)
        for value in [request("first"), request("second"), request("third")]:
            dispatcher.handle(value)
        self.assertEqual(dispatcher.cached_count, 2)

    def test_sessions_share_provider_limit_but_scripted_work_still_runs(self):
        limiter = backend.ProviderLimiter(max_calls=1)
        first = backend.SessionDispatcher(limiter)
        second = backend.SessionDispatcher(limiter)
        with patch.object(backend.coach, "settings", return_value={"api_key": "synthetic-test-only", "model": "test-model"}), patch.object(backend.coach, "gemini", return_value={"reply": "What happened?", "agreed": False}):
            live = {"message": "Can we talk?", "history": []}
            self.assertEqual(first.handle(request(body=live))["status"], 200)
            self.assertEqual(second.handle(request("second", body=live))["status"], 429)
            self.assertEqual(second.handle(request("scripted"))["status"], 200)

    def test_provider_failure_is_counted_and_errors_are_redacted(self):
        dispatcher = backend.SessionDispatcher(backend.ProviderLimiter(max_calls=1))
        with patch.object(backend.coach, "settings", return_value={"api_key": "synthetic-test-only", "model": "test-model"}), patch.object(backend.coach, "gemini", side_effect=backend.coach.ProviderError("PRIVATE_TEST_MARKER")):
            failed = dispatcher.handle(request("first", "/api/prepare", {"message": "hello"}))
            self.assertEqual(failed["status"], 502)
            self.assertNotIn("PRIVATE_TEST_MARKER", str(failed))
            self.assertEqual(dispatcher.handle(request("second", "/api/prepare", {"message": "hello"}))["status"], 429)

    def test_rehearsal_fallback_is_disclosed_without_raw_provider_error(self):
        with patch.object(backend.coach, "settings", return_value={"api_key": "synthetic-test-only", "model": "test-model"}), patch.object(backend.coach, "gemini", side_effect=backend.coach.ProviderError("PRIVATE_TEST_MARKER")):
            result = self.dispatcher.handle(request(body={"message": "Can we talk?"}))
            self.assertEqual(result["status"], 200)
            self.assertEqual(result["body"]["engine"], "scripted")
            self.assertTrue(result["body"]["provider_error"])
            self.assertNotIn("PRIVATE_TEST_MARKER", str(result))

    def test_unexpected_exception_is_not_exposed(self):
        with patch.object(backend.coach, "prepare", side_effect=RuntimeError("PRIVATE_TEST_MARKER")):
            result = self.dispatcher.handle(request(path="/api/prepare"))
            self.assertEqual(result["status"], 500)
            self.assertNotIn("PRIVATE_TEST_MARKER", str(result))

    def test_transcription_requires_consent_and_reuses_audio_validation(self):
        result = self.dispatcher.handle(request(path="/api/transcribe", body={"audio": "invalid", "mime_type": "audio/webm", "consent": False}))
        self.assertEqual(result["status"], 403)
        invalid = self.dispatcher.handle(request("invalid", "/api/transcribe", {"audio": "invalid", "mime_type": "audio/webm", "consent": True}))
        self.assertEqual(invalid["status"], 400)


class ProviderLimiterTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(backend, "Provider limiter has not been implemented")

    def test_window_expires_and_failed_calls_consume_an_attempt(self):
        now = [0.0]
        limiter = backend.ProviderLimiter(max_calls=1, window_seconds=3600, clock=lambda: now[0])
        with self.assertRaises(RuntimeError):
            with limiter.slot():
                raise RuntimeError("expected test failure")
        with self.assertRaises(backend.ProviderLimitError):
            with limiter.slot():
                self.fail("second provider attempt must not start")
        now[0] = 3600.0
        with limiter.slot():
            pass

    def test_third_concurrent_call_is_rejected_and_slot_released(self):
        limiter = backend.ProviderLimiter(max_concurrent=2)
        with limiter.slot():
            with limiter.slot():
                with self.assertRaises(backend.ProviderLimitError):
                    with limiter.slot():
                        self.fail("third simultaneous provider call must not start")
            with limiter.slot():
                pass


class StreamlitEntrypointTests(unittest.TestCase):
    def test_rerun_delivers_cached_response_and_never_passes_secrets(self):
        entry = Path(__file__).resolve().parents[1] / "streamlit_app.py"
        self.assertTrue(entry.exists(), "Streamlit entrypoint has not been implemented")
        self.assertIsNotNone(backend)
        streamlit = types.ModuleType("streamlit")
        streamlit.session_state = {}
        streamlit.secrets = {"GEMINI_API_KEY": "SYNTHETIC_ENTRY_TEST_KEY", "GEMINI_MODEL": "test-model"}
        streamlit.set_page_config = lambda **kwargs: None
        streamlit.caption = lambda *args, **kwargs: None
        cached = {}
        def cache_resource(function):
            def call():
                if function.__name__ not in cached:
                    cached[function.__name__] = function()
                return cached[function.__name__]
            return call
        streamlit.cache_resource = cache_resource
        class Rerun(Exception):
            pass
        def rerun():
            raise Rerun()
        streamlit.rerun = rerun
        components = types.ModuleType("streamlit.components.v1")
        calls = []
        query = request(path="/api/context", method="GET")
        def declare_component(name, path):
            self.assertTrue(Path(path).is_absolute())
            def component(**kwargs):
                calls.append(kwargs)
                return query
            return component
        components.declare_component = declare_component
        package = types.ModuleType("streamlit.components")
        package.v1 = components
        streamlit.components = package
        with patch.dict(sys.modules, {"streamlit": streamlit, "streamlit.components": package, "streamlit.components.v1": components}), patch.dict("os.environ", {}, clear=True), patch.object(backend.coach, "settings", return_value={"api_key": "", "model": "test-model"}):
            with self.assertRaises(Rerun):
                runpy.run_path(str(entry), run_name="__main__")
            runpy.run_path(str(entry), run_name="__main__")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1]["response"]["status"], 200)
        self.assertEqual(calls[0]["key"], calls[1]["key"])
        self.assertNotIn("SYNTHETIC_ENTRY_TEST_KEY", str(calls))


if __name__ == "__main__":
    unittest.main()
