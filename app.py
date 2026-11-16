"""Dependency-free local development server. Run: python3 app.py --port 8765."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import urllib.parse

import coach
import speech
import audio_input

ROOT = Path(__file__).resolve().parent
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/static/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/static/style.css": ("style.css", "text/css; charset=utf-8"),
}


def validate(payload, needs_message=True):
    if not isinstance(payload, dict):
        raise ValueError("Expected a JSON object.")
    message = payload.get("message", "")
    if needs_message and (not isinstance(message, str) or not message.strip() or len(message) > 4000):
        raise ValueError("Enter a message between 1 and 4,000 characters.")
    history = payload.get("history", [])
    if not isinstance(history, list) or len(history) > 100:
        raise ValueError("Conversation must contain at most 100 turns. Start a new practice session.")
    clean = []
    for item in history:
        if not isinstance(item, dict) or item.get("role") not in {"manager", "employee", "coach"} or not isinstance(item.get("text"), str) or not item["text"].strip() or len(item["text"]) > 8000:
            raise ValueError("Transcript contains an invalid turn.")
        clean.append({"role": item["role"], "text": item["text"], "interrupted": bool(item.get("interrupted", False)), "agreed": item["role"] == "employee" and item.get("agreed") is True})
    return message.strip() if isinstance(message, str) else "", clean


class Handler(BaseHTTPRequestHandler):
    server_version = "FeedbackCoach/1.0"

    def reply(self, code, value, content_type="application/json; charset=utf-8"):
        data = json.dumps(value, ensure_ascii=False).encode() if content_type.startswith("application/json") else value
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "microphone=(self)")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Browser interrupted a pending turn; stale result is discarded.

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/context":
            self.reply(200, {**coach.context(), "speech_available": speech.available(), "transcription_available": bool(coach.settings()["api_key"])})
        elif path in STATIC:
            name, mime = STATIC[path]
            try:
                self.reply(200, (ROOT / "static" / name).read_bytes(), mime)
            except FileNotFoundError:
                self.reply(503, {"error": "Interface files are not available."})
        else:
            self.reply(404, {"error": "Not found."})

    def do_POST(self):
        if self.path not in {"/api/prepare", "/api/rehearse", "/api/debrief", "/api/speech", "/api/transcribe"}:
            self.reply(404, {"error": "Not found."})
            return
        # JSON + same-origin checks prevent another website from driving this local API.
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if origin and origin not in {f"http://{host}", f"https://{host}"}:
            self.reply(403, {"error": "Cross-origin requests are not allowed."})
            return
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            self.reply(415, {"error": "Use application/json."})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            limit = 4_100_000 if self.path == "/api/transcribe" else 250000
            if size < 1 or size > limit:
                raise ValueError("Request body must be between 1 byte and 250 KB.")
            body = json.loads(self.rfile.read(size))
            if self.path == "/api/transcribe":
                if not isinstance(body, dict):
                    raise ValueError("Expected a JSON object.")
                self.reply(200, audio_input.transcribe(body.get("audio"), body.get("mime_type"), consent=body.get("consent", False)))
                return
            if self.path == "/api/speech":
                if not isinstance(body, dict):
                    raise ValueError("Expected a JSON object.")
                audio = speech.render(body.get("text"), body.get("role", "employee"), body.get("rate", 1.0))
                self.reply(200, audio, "audio/wav")
                return
            message, history = validate(body, needs_message=self.path != "/api/debrief")
            if self.path == "/api/prepare":
                value = coach.prepare(message, history, force_scripted=body.get("engine") == "scripted")
            elif self.path == "/api/rehearse":
                if any(x["role"] == "coach" for x in history):
                    raise ValueError("Rehearsal history must contain only manager and employee turns.")
                value = coach.rehearse_with_fallback(message, history, force_scripted=body.get("engine") == "scripted")
            else:
                if any(x["role"] == "coach" for x in history):
                    raise ValueError("Debrief must use the rehearsal transcript only.")
                value = coach.debrief(history, force_scripted=body.get("engine") == "scripted")
            self.reply(200, value)
        except PermissionError as error:
            self.reply(403, {"error": str(error)})
        except (ValueError, UnicodeDecodeError):
            self.reply(400, {"error": "Invalid request. Use a non-empty message up to 4,000 characters and a valid conversation transcript."})
        except coach.ProviderError as error:
            self.reply(502, {"error": str(error)})
        except speech.SpeechError as error:
            self.reply(503, {"error": str(error)})
        except Exception:
            # Never print request bodies, API keys, or provider responses to logs.
            self.reply(500, {"error": "The local service could not complete this request. Check the local data files and retry."})

    def log_message(self, format, *args):
        pass  # No transcript, credentials or employee data in access logs.


def main():
    parser = argparse.ArgumentParser(description="Local manager feedback coach")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Manager feedback coach: http://127.0.0.1:{args.port}", flush=True)
    print("Local prototype. Open in desktop Chrome; microphone permission and internet may be required.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
