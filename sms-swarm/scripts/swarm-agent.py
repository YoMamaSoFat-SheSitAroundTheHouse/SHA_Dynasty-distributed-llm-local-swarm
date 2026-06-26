#!/usr/bin/env python3
"""
swarm-agent.py — SHA-Dynasty Universal Swarm Agent
====================================================
One script. Any device. Any LLM backend.

Each node in the swarm runs this same script with a different .env config.
The phone number becomes the interface. Text the node, it thinks, it replies.

Supported backends (all free tier):
  - groq      : Llama 3.3 70B @ ~500 tok/s  — fastest, best for commands
  - deepseek  : DeepSeek V3/R1               — best reasoning, cheap
  - gemini    : Gemini 2.0 Flash             — 1M context, multimodal
  - mistral   : Mistral Large                — strong, EU-hosted
  - ollama    : Local Qwen/any model         — fully offline, no API key

Usage:
    cp .env.example .env
    # Edit .env with your device identity and chosen backend
    python swarm-agent.py

Environment variables (set in .env):
    DEVICE_NAME       = shitbox-jr
    DEVICE_ROLE       = compute worker — code execution, backtesting, data analysis
    LLM_BACKEND       = groq           # groq | deepseek | gemini | mistral | ollama
    API_KEY           = your_key_here  # not needed for ollama
    OLLAMA_URL        = http://localhost:11434
    OLLAMA_MODEL      = qwen-swarm
    SMS_GATEWAY_URL   = http://100.VELVET_IP:8080
    SMS_GATEWAY_USER  = username
    SMS_GATEWAY_PASS  = password
    ALLOWED_SENDERS   = +15551234567,+15559876543
    PORT              = 5000
"""

import os
import logging
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("swarm-agent")

app = Flask(__name__)

# ── Device identity ────────────────────────────────────────────────────────────
DEVICE_NAME = os.environ.get("DEVICE_NAME", "unknown-node")
DEVICE_ROLE = os.environ.get("DEVICE_ROLE", "general purpose agent")

# ── LLM backend config ─────────────────────────────────────────────────────────
LLM_BACKEND  = os.environ.get("LLM_BACKEND", "groq").lower()
API_KEY      = os.environ.get("API_KEY", "")
OLLAMA_URL   = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen-swarm")

# ── SMS gateway config ─────────────────────────────────────────────────────────
SMS_GATEWAY_URL  = os.environ.get("SMS_GATEWAY_URL", "")
SMS_GATEWAY_USER = os.environ.get("SMS_GATEWAY_USER", "")
SMS_GATEWAY_PASS = os.environ.get("SMS_GATEWAY_PASS", "")
ALLOWED_SENDERS  = set(
    s.strip() for s in os.environ.get("ALLOWED_SENDERS", "").split(",") if s.strip()
)
PORT = int(os.environ.get("PORT", 5000))

# ── System prompt (baked with device identity) ─────────────────────────────────
SYSTEM_PROMPT = f"""You are {DEVICE_NAME}, a node in the SHA-Dynasty distributed LLM swarm.

Your role: {DEVICE_ROLE}

Fleet:
- shitbox (Lenovo, Linux): primary orchestrator, Freqtrade, Claude Haiku inference
- shitbox-jr (HP, Linux): compute worker, Qwen inference, VectorBT backtesting
- thetablet (Surface Pro 6, Windows 11): dev workstation, Cursor + VS Code
- sha-dynasty (Samsung S9, Android/Termux): credential vault, mobile agent
- velvet (LG Velvet, Android/Termux): SMS gateway, mobile agent
- potato (DESKTOP-RBCUO93, Windows 11, i7-9750H, 32GB): high-performance node, candidate for GPU inference

Rules:
- Keep replies concise — this is SMS, not a chat window. Max 3 sentences unless more is explicitly needed.
- Never include secrets, API keys, or passwords in replies.
- If a task requires another node, say which one and why.
- If you cannot complete a task, say so clearly and suggest the right node.

Dashboard: https://shadash-xbcyfwtv.manus.space
Repo: https://github.com/YoMamaSoFat-SheSitAroundTheHouse/SHA_Dynasty-distributed-llm-local-swarm
"""

# ── Backend implementations ────────────────────────────────────────────────────

def _call_openai_compat(base_url: str, model: str, messages: list, api_key: str) -> str:
    """Generic OpenAI-compatible API call (Groq, DeepSeek, Mistral all use this)."""
    resp = requests.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "messages": messages, "max_tokens": 300},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def _call_groq(messages: list) -> str:
    return _call_openai_compat(
        "https://api.groq.com/openai/v1",
        "llama-3.3-70b-versatile",
        messages,
        API_KEY,
    )


def _call_deepseek(messages: list) -> str:
    return _call_openai_compat(
        "https://api.deepseek.com/v1",
        "deepseek-chat",
        messages,
        API_KEY,
    )


def _call_gemini(messages: list) -> str:
    """Gemini 2.0 Flash via OpenAI-compatible endpoint."""
    return _call_openai_compat(
        "https://generativelanguage.googleapis.com/v1beta/openai",
        "gemini-2.0-flash",
        messages,
        API_KEY,
    )


def _call_mistral(messages: list) -> str:
    return _call_openai_compat(
        "https://api.mistral.ai/v1",
        "mistral-large-latest",
        messages,
        API_KEY,
    )


def _call_ollama(messages: list) -> str:
    """Local Ollama — no API key needed."""
    # Convert to Ollama's generate format
    prompt = "\n".join(
        f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
        for m in messages if m["role"] != "system"
    )
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "options": {"num_predict": 300}},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json().get("response", "").strip()


BACKENDS = {
    "groq":     _call_groq,
    "deepseek": _call_deepseek,
    "gemini":   _call_gemini,
    "mistral":  _call_mistral,
    "ollama":   _call_ollama,
}


def query_llm(user_message: str) -> str:
    """Route the message to the configured LLM backend."""
    backend_fn = BACKENDS.get(LLM_BACKEND)
    if not backend_fn:
        return f"[Config error: unknown backend '{LLM_BACKEND}'. Use: groq, deepseek, gemini, mistral, ollama]"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ]

    try:
        return backend_fn(messages)
    except requests.HTTPError as e:
        log.error(f"LLM HTTP error ({LLM_BACKEND}): {e.response.status_code} {e.response.text[:200]}")
        return f"[{DEVICE_NAME}] LLM error {e.response.status_code} — check API key or quota."
    except Exception as e:
        log.error(f"LLM error ({LLM_BACKEND}): {e}")
        return f"[{DEVICE_NAME}] LLM unavailable: {e}"


# ── SMS helpers ────────────────────────────────────────────────────────────────

def send_sms(phone_number: str, text: str) -> bool:
    if not SMS_GATEWAY_URL:
        log.warning("SMS_GATEWAY_URL not set — cannot send reply")
        return False
    try:
        resp = requests.post(
            f"{SMS_GATEWAY_URL}/message",
            auth=(SMS_GATEWAY_USER, SMS_GATEWAY_PASS),
            json={"textMessage": {"text": text}, "phoneNumbers": [phone_number]},
            timeout=10,
        )
        resp.raise_for_status()
        log.info(f"SMS sent to {phone_number}")
        return True
    except Exception as e:
        log.error(f"SMS send failed: {e}")
        return False


# ── Flask routes ───────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "device": DEVICE_NAME,
        "role": DEVICE_ROLE,
        "backend": LLM_BACKEND,
        "model": OLLAMA_MODEL if LLM_BACKEND == "ollama" else LLM_BACKEND,
    })


@app.route("/webhook/sms", methods=["POST"])
def sms_webhook():
    data    = request.get_json(silent=True) or {}
    event   = data.get("event", "")
    payload = data.get("payload", {})
    sender  = payload.get("phoneNumber", "")
    message = payload.get("message", "").strip()

    if event != "sms:received":
        return jsonify({"status": "ignored"}), 200

    if not sender or not message:
        return jsonify({"status": "bad_request"}), 400

    if ALLOWED_SENDERS and sender not in ALLOWED_SENDERS:
        log.warning(f"Rejected sender: {sender}")
        return jsonify({"status": "unauthorized"}), 403

    log.info(f"[{DEVICE_NAME}] SMS from {sender}: {message!r}")

    reply = query_llm(message)
    log.info(f"[{DEVICE_NAME}] Reply: {reply!r}")

    send_sms(sender, reply)
    return jsonify({"status": "ok", "reply": reply}), 200


@app.route("/ask", methods=["POST"])
def ask():
    """Direct HTTP endpoint — useful for testing without SMS."""
    data    = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    reply = query_llm(message)
    return jsonify({"device": DEVICE_NAME, "reply": reply}), 200


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info(f"╔══════════════════════════════════════╗")
    log.info(f"║  SHA-Dynasty Swarm Agent             ║")
    log.info(f"║  Device  : {DEVICE_NAME:<26}║")
    log.info(f"║  Backend : {LLM_BACKEND:<26}║")
    log.info(f"║  Port    : {PORT:<26}║")
    log.info(f"╚══════════════════════════════════════╝")
    app.run(host="0.0.0.0", port=PORT)
