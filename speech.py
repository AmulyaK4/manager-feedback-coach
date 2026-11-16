"""Local macOS WAV generation; no recording, network, shell, or audio playback."""
from pathlib import Path
import subprocess
import sys
import tempfile
import wave


class SpeechError(Exception):
    pass


def available():
    return sys.platform == "darwin" and Path("/usr/bin/say").is_file()


def render(text, role="employee", rate=1.0):
    if not isinstance(text, str) or not text.strip() or len(text) > 2200 or role not in {"coach", "employee"}:
        raise ValueError("Supply 1–2,200 characters and a valid speaker role.")
    if not isinstance(rate, (int, float)) or not 0.7 <= rate <= 1.3:
        raise ValueError("Speech rate must be between 0.7 and 1.3.")
    if not available():
        raise SpeechError("Local WAV speech is available on macOS. Use the browser voice and Play reply button on this machine.")
    prefix = "" if role == "employee" else "Coach speaking. "
    voice = "Rishi" if role == "employee" else "Samantha"
    with tempfile.TemporaryDirectory(prefix="feedback-coach-speech-") as folder:
        output = Path(folder) / "reply.wav"
        # Both installed voices were verified to generate non-empty WAV audio.
        # Distinct voices identify the roles without repeating Rohit's name.
        command = ["/usr/bin/say", "-v", voice, "-o", str(output), "--file-format=WAVE", "--data-format=LEI16@22050", "-r", str(round(175 * rate)), prefix + text.strip()]
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=15)
            with wave.open(str(output), "rb") as audio:
                if audio.getnframes() < 100 or audio.getframerate() <= 0:
                    raise SpeechError("Local speech produced an empty audio file. Use the browser voice or check macOS speech voices.")
            return output.read_bytes()
        except (subprocess.SubprocessError, OSError, wave.Error):
            raise SpeechError("Local speech could not generate playable audio. Use the browser voice or check the installed macOS voices.") from None
