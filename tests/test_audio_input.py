import base64
import io
import unittest
import wave
from unittest.mock import patch

try:
    import audio_input
except ImportError:
    audio_input = None


def sample():
    out = io.BytesIO()
    with wave.open(out, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\x10\x00' * 1600)
    return base64.b64encode(out.getvalue()).decode()


class AudioInputTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(audio_input, "Recorded audio transcription has not been implemented")

    def test_no_audio_is_sent_without_explicit_consent(self):
        with self.assertRaises(PermissionError):
            audio_input.transcribe(sample(), "audio/wav", consent=False)

    def test_invalid_audio_is_rejected_before_provider_call(self):
        for data, mime in [("not-base64", "audio/wav"), (sample(), "text/plain"), (base64.b64encode(b"not an audio file").decode(), "audio/webm")]:
            with self.subTest(mime=mime), self.assertRaises(ValueError):
                audio_input.transcribe(data, mime, consent=True)

    def test_transcription_sends_audio_only_without_employee_context(self):
        with patch("coach.settings", return_value={"api_key":"test","model":"test-model"}), patch("coach.gemini", return_value={"text":"Rohit, can we discuss the late starts?"}) as provider:
            result = audio_input.transcribe(sample(), "audio/wav", consent=True)
        self.assertEqual(result["text"], "Rohit, can we discuss the late starts?")
        self.assertNotIn("curated_employee", provider.call_args.args[1])
        self.assertEqual(provider.call_args.kwargs["inline_audio"]["mimeType"], "audio/wav")

    def test_empty_transcript_is_not_invented_as_a_manager_turn(self):
        with patch("coach.settings", return_value={"api_key":"test","model":"test-model"}), patch("coach.gemini", return_value={"text":""}):
            with self.assertRaises(audio_input.coach.ProviderError):
                audio_input.transcribe(sample(), "audio/wav", consent=True)
