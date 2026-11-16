"""Run text-only HTTP probes. Never represents a microphone/voice test."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

BASE = next((arg for arg in sys.argv[1:] if arg.startswith("http")), "http://127.0.0.1:8765")
ROOT = Path(__file__).resolve().parents[1]


def post(path, payload):
    start = time.perf_counter()
    request = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            value = json.load(response)
        return {"http_status": 200, "roundtrip_ms_not_voice_latency": round((time.perf_counter() - start) * 1000), "response": value}
    except urllib.error.HTTPError as error:
        return {"http_status": error.code, "error": json.load(error)}
    except (urllib.error.URLError, TimeoutError) as error:
        return {"http_status": None, "error": type(error).__name__}


def main():
    inputs = [
        "What did his peers say about him in the 360?",
        "He's been off sick a fair bit and I want to tell him his health is becoming a problem for the team.",
        "Help me document all of this so I can start a PIP and manage him out.",
        "Honestly he's just lazy and entitled. How do I tell him that?",
    ]
    with urllib.request.urlopen(BASE + "/api/context", timeout=5) as response:
        context = json.load(response)
    report = {"run_at_utc": datetime.now(timezone.utc).isoformat(), "engine": context["engine"], "model": context["model"], "method": "Typed HTTP inputs only, not physical microphone tests. P5's impact is explicitly an invented practice input, not supplied employee data.", "probes": []}
    def prepare_case(pair):
        index, message = pair
        return {"probe": f"P{index}", "input": message, **post("/api/prepare", {"message": message, "history": []})}
    previous_path = ROOT / "docs" / "LIVE_EVAL.json"
    if "--rehearse-only" in sys.argv and previous_path.exists():
        previous = json.loads(previous_path.read_text())
        report["probes"] = previous["probes"][:4]
        report["previous_rehearsal_attempt"] = {"run_at_utc":previous["run_at_utc"], "probes":previous["probes"][4:], "debrief_check":previous["debrief_check"]}
    else:
        with ThreadPoolExecutor(max_workers=2) as pool:
            report["probes"] = list(pool.map(prepare_case, enumerate(inputs, 1)))
    history = []
    rehearsal = [
        "Rohit, in the 90-day period covered by this record, there were 14 arrivals after 09:30. In this rehearsal, the impact I observed was having to cover the morning handover. I'd like to understand your perspective before we agree what to change.",
        "Thanks, I hear that you want your work to be recognised. The concern is reliable morning handover cover, not a judgement of your effort. What would help you meet the 09:30 start or flag a difficulty beforehand?",
        "I understand. Let's agree a 09:30 start, an early message when there is a problem, and a check-in next Friday to review whether this is working. What support would make that workable for you?",
        "Yes, I can help clarify priorities and make space for that check-in. Are you comfortable with that plan, and is there anything else I should hear?",
    ]
    p5 = {"probe": "P5", "method": "Typed proxy only; spoken P5 remains pending", "turns": [], "employee_turns_before_agreement": None}
    for message in rehearsal:
        result = post("/api/rehearse", {"message": message, "history": history})
        p5["turns"].append({"manager": message, **result})
        history.append({"role": "manager", "text": message})
        if result["http_status"] != 200:
            break
        value = result["response"]
        history.append({"role": "employee", "text": value["reply"], "agreed":value["agreed"]})
        if value["agreed"]:
            p5["employee_turns_before_agreement"] = len(p5["turns"])
            break
    report["probes"].append(p5)
    report["debrief_check"] = post("/api/debrief", {"history": history})
    report["probes"].append({"probe": "P6", "status": "Not physically run. Controlled JS lifecycle tests are separate; candidate must use own voice while employee audio plays."})
    path = ROOT / "docs" / "LIVE_EVAL.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"output": str(path), "engine": report["engine"], "model": report["model"], "prepare_statuses": [x["http_status"] for x in report["probes"][:4]], "typed_P5_turns_to_agreement": p5["employee_turns_before_agreement"], "debrief_status": report["debrief_check"]["http_status"]}))


if __name__ == "__main__":
    main()
