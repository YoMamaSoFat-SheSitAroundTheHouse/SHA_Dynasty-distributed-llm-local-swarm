# SHA-Dynasty SMS Swarm Integration

**Status:** Scaffolded — ready for deployment on shitbox-jr and velvet/sha-dynasty.

This project adds SMS as a resilience communication layer and command interface to the SHA-Dynasty distributed LLM swarm. All other swarm channels (Tailscale, Dropbox, SSH) require internet. SMS requires only cellular signal. This is the fallback that keeps the swarm reachable when everything else is down.

---

## Architecture

```
[External SMS]
      │
      ▼
[velvet or sha-dynasty]          ← Android phone running SMSGate APK
[SMSGate REST API :8080]         ← Local HTTP server on device
      │  Tailscale WireGuard
      ▼
[shitbox-jr :5000]               ← webhook-receiver.py
      │
      ├──► [Ollama :11434]       ← qwen-swarm model processes the message
      │         │
      │         ▼
      └──► [SMSGate REST API]    ← Reply sent back via SMS
```

**Key principle:** All communication uses Tailscale IPs (100.x.x.x). Nothing is exposed to the public internet.

---

## Fleet Reference

| Device | OS | RAM | Tailscale IP | Role |
|--------|-----|-----|-------------|------|
| shitbox | Ubuntu | ~16GB | 100.x.x.x | Orchestrator |
| shitbox-jr | Ubuntu | 16GB | 100.125.48.6 | Compute worker, webhook receiver |
| velvet | Android | 6GB | 100.x.x.x | **Primary SMS gateway** (dual SIM) |
| sha-dynasty | Android | 4GB | 100.x.x.x | Backup SMS gateway, credential vault |
| thetablet | Windows | 8GB | 100.x.x.x | Dev client |

---

## Project Structure

```
sms-swarm/
├── README.md                    ← This file
├── repos/
│   ├── android-sms-gateway/     ← SMSGate source (capcom6) — PRIMARY gateway
│   ├── hu60-sms-flutter-gateway/← Flutter APK alternative
│   ├── hu60sms/                 ← Termux Go binary alternative
│   ├── sms_llm/                 ← SMS ↔ MQTT ↔ Ollama bridge reference
│   ├── ollama-mcp-bridge/       ← Ollama ↔ MCP tool bridge (Cursor integration)
│   └── public-apis/             ← 1,400+ free API reference
├── apks/
│   └── smsgate-latest.apk       ← SMSGate v1.66.0 (ready to sideload)
├── config/
│   ├── smsgate-webhook.json     ← SMSGate webhook configuration template
│   └── mcp-config.json          ← Cursor MCP server config template
├── scripts/
│   ├── test-sms.sh              ← Test SMS send from shitbox-jr
│   └── webhook-receiver.py      ← Webhook receiver + Ollama bridge
└── docs/
    └── REPO_NOTES.md            ← Per-repo dependency and setup notes
```

---

## Phase 1: SMS Gateway on velvet

### Installation (on velvet)

1. Transfer the APK to velvet via ADB or Tailscale file transfer:
   ```bash
   # From shitbox-jr via ADB over USB
   adb install /path/to/sms-swarm/apks/smsgate-latest.apk

   # Or copy via Tailscale + SSH (if Termux SSH is running on velvet)
   scp apks/smsgate-latest.apk user@100.VELVET_IP:~/
   ```

2. Open the app on velvet. The home screen shows:
   - **Username** and **Password** (auto-generated, write these down)
   - **Local Server** toggle — enable it
   - Tap **Start**

3. Grant SMS permissions when prompted.

4. Disable battery optimization for SMSGate:
   - Settings → Apps → SMSGate → Battery → Unrestricted

5. Enable auto-start on boot:
   - In-app Settings → Start on boot → Enable

### Test from shitbox-jr

```bash
# Set your credentials (from the app home screen)
export SMS_USER="your_username"
export SMS_PASS="your_password"
export VELVET_IP="100.VELVET_TAILSCALE_IP"
export YOUR_NUMBER="+1YOURNUMBER"

# Send a test SMS
curl -X POST -u "$SMS_USER:$SMS_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"textMessage\": {\"text\": \"swarm online — test from shitbox-jr\"}, \"phoneNumbers\": [\"$YOUR_NUMBER\"]}" \
  http://$VELVET_IP:8080/message

# Check delivery status (use the ID from the response above)
curl -u "$SMS_USER:$SMS_PASS" http://$VELVET_IP:8080/message/MESSAGE_ID
```

---

## Phase 2: Webhook Receiver + Ollama Bridge (shitbox-jr)

The `scripts/webhook-receiver.py` script runs on shitbox-jr and:
1. Listens for incoming SMS webhooks from SMSGate
2. Validates the sender (allowlist)
3. Forwards the message text to Ollama (qwen-swarm model)
4. Sends the Ollama response back via SMS

### Setup on shitbox-jr

```bash
cd /mnt/trading/sms-swarm/scripts
python3 -m venv .venv
source .venv/bin/activate
pip install flask requests

# Configure environment
export SMS_GATEWAY_URL="http://100.VELVET_IP:8080"
export SMS_GATEWAY_USER="your_username"
export SMS_GATEWAY_PASS="your_password"
export OLLAMA_URL="http://localhost:11434"
export ALLOWED_SENDERS="+1YOURNUMBER,+1BACKUPNUMBER"

# Run the receiver
python webhook-receiver.py
```

### Configure webhook in SMSGate app

In the SMSGate app on velvet:
- Settings → Webhooks → Add webhook
- Event: `sms:received`
- URL: `http://100.SHITBOX_JR_IP:5000/webhook/sms`
- Method: POST

---

## Phase 3: MCP Server for Cursor

The `ollama-mcp-bridge` repo provides an Ollama proxy that adds MCP tool support. This lets Cursor send SMS via the swarm directly from the chat interface.

### Setup

```bash
cd /mnt/trading/sms-swarm/repos/ollama-mcp-bridge
pip install ollama-mcp-bridge

# Configure MCP servers (edit mcp-config.json)
cp mcp-config.json /mnt/trading/sms-swarm/config/

# Start the bridge (proxies Ollama at :11435, adds MCP tools)
ollama-mcp-bridge --ollama-url http://localhost:11434 --port 11435 \
  --mcp-config /mnt/trading/sms-swarm/config/mcp-config.json
```

### Cursor config (`.cursor/mcp.json` on thetablet)

```json
{
  "mcpServers": {
    "sms-swarm": {
      "url": "http://100.SHITBOX_JR_IP:11435/mcp"
    }
  }
}
```

---

## Security Notes

- All API endpoints are only reachable via Tailscale IPs — never exposed to the public internet
- Store credentials in environment variables, never in code
- Validate all incoming webhook senders against an allowlist
- The SMSGate API uses HTTP Basic Auth over the Tailscale WireGuard tunnel (encrypted end-to-end)
- Rotate SMSGate credentials periodically (regenerate in-app)

---

## Repo Notes

See `docs/REPO_NOTES.md` for per-repository dependency details, configuration requirements, and maintenance status.
