#!/usr/bin/env python3
"""
webhook-receiver.py — SHA-Dynasty SMS ↔ Ollama bridge
Runs on shitbox-jr. Receives incoming SMS webhooks from SMSGate (on velvet/sha-dynasty),
forwards the message to the qwen-swarm Ollama model, and sends the reply back via SMS.

Usage:
    export SMS_GATEWAY_URL="http://100.VELVET_IP:8080"
    export SMS_GATEWAY_USER="username_from_app"
    export SMS_GATEWAY_PASS="password_from_app"
    export OLLAMA_URL="http://localhost:11434"
    export ALLOWED_SENDERS="+15551234567,+15559876543"
    python webhook-receiver.py
"""

import os
import logging
import requests
from flask import Flask, request, jsonify

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("sms-bridge")

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SMS_GATEWAY_URL  = os.environ.get("SMS_GATEWAY_URL", "http://localhost:8080")
SMS_GATEWAY_USER = os.environ.get("SMS_GATEWAY_USER", "")
SMS_GATEWAY_PASS = os.environ.get("SMS_GATEWAY_PASS", "")
OLLAMA_URL       = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL     = os.environ.get("OLLAMA_MODEL", "qwen-swarm")
ALLOWED_SENDERS  = set(
    s.strip() for s in os.environ.get("ALLOWED_SENDERS", "").split(",") if s.strip()
)
PORT = int(os.environ.get("PORT", 5000))


def send_sms(phone_number: str, text: str) -> bool:
    """Send an SMS reply via the SMSGate gateway."""
    try:
        resp = requests.post(
            f"{SMS_GATEWAY_URL}/message",
            auth=(SMS_GATEWAY_USER, SMS_GATEWAY_PASS),
            json={"textMessage": {"text": text}, "phoneNumbers": [phone_number]},
            timeout=10,
        )
        resp.raise_for_status()
        log.info(f"SMS sent to {phone_number}: {resp.json()}")
        return True
    except Exception as e:
        log.error(f"Failed to send SMS to {phone_number}: {e}")
        return False


def query_ollama(prompt: str) -> str:
    """Send a prompt to the local Ollama model and return the response text."""
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"num_predict": 300},  # Keep SMS replies concise
            },
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except Exception as e:
        log.error(f"Ollama query failed: {e}")
        return f"[Error: model unavailable — {e}]"


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": OLLAMA_MODEL, "gateway": SMS_GATEWAY_URL})


@app.route("/webhook/sms", methods=["POST"])
def sms_webhook():
    """Receive incoming SMS webhook from SMSGate and route to Ollama."""
    data = request.get_json(silent=True) or {}
    log.info(f"Webhook received: {data}")

    # SMSGate webhook payload shape:
    # { "event": "sms:received", "payload": { "message": "...", "phoneNumber": "+1..." } }
    event   = data.get("event", "")
    payload = data.get("payload", {})
    sender  = payload.get("phoneNumber", "")
    message = payload.get("message", "").strip()

    if event != "sms:received":
        log.info(f"Ignoring non-SMS event: {event}")
        return jsonify({"status": "ignored"}), 200

    if not sender or not message:
        log.warning("Webhook missing sender or message")
        return jsonify({"status": "bad_request"}), 400

    # Allowlist check
    if ALLOWED_SENDERS and sender not in ALLOWED_SENDERS:
        log.warning(f"Rejected message from unlisted sender: {sender}")
        return jsonify({"status": "unauthorized"}), 403

    log.info(f"Processing SMS from {sender}: {message!r}")

    # Query Ollama
    reply = query_ollama(message)
    log.info(f"Ollama reply: {reply!r}")

    # Send reply back via SMS
    send_sms(sender, reply)

    return jsonify({"status": "ok", "reply": reply}), 200


if __name__ == "__main__":
    log.info(f"SHA-Dynasty SMS Bridge starting on port {PORT}")
    log.info(f"Ollama model  : {OLLAMA_MODEL} @ {OLLAMA_URL}")
    log.info(f"SMS gateway   : {SMS_GATEWAY_URL}")
    log.info(f"Allowed senders: {ALLOWED_SENDERS or 'ALL (no allowlist set)'}")
    app.run(host="0.0.0.0", port=PORT)
