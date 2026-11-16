import unittest
from unittest.mock import patch

try:
    import speech
except ImportError:
    speech = None


class SpeechTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(speech, "Local speech fallback is not implemented")

    def test_rejects_empty_text_and_unknown_role(self):
        for text, role, rate in [("", "employee", 1), ("Hello", "system", 1), ("Hello", "employee", 99)]:
            with self.subTest(text=text, role=role, rate=rate):
                with self.assertRaises(ValueError):
                    speech.render(text, role, rate)

    def test_unavailable_host_has_actionable_failure(self):
        with patch.object(speech, "available", return_value=False):
            with self.assertRaises(speech.SpeechError):
                speech.render("Hello", "employee", 1)

    def test_empty_generated_file_is_not_claimed_as_audio(self):
        with patch.object(speech, "available", return_value=True), patch("subprocess.run"):
            with self.assertRaises(speech.SpeechError):
                speech.render("Hello", "employee", 1)
