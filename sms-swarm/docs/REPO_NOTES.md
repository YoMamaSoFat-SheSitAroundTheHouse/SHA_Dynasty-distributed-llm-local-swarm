# Repo Notes — SHA-Dynasty SMS Swarm

Per-repository dependency details, configuration requirements, and maintenance status.

---

## android-sms-gateway (capcom6)

**URL:** https://github.com/capcom6/android-sms-gateway  
**Stars:** ~4,800 | **License:** Apache 2.0 | **Status:** Actively maintained  
**Language:** Kotlin (Android app)

**What it does:** Runs a local REST API server on Android. Exposes endpoints to send/receive SMS, check delivery status, and configure webhooks for incoming messages.

**Why it's the primary choice:**
- No cloud relay — API runs entirely on the device
- OpenAPI spec included — easy to integrate
- Webhook support for incoming SMS (triggers shitbox-jr webhook receiver)
- Free, no account required
- APK already downloaded to `apks/smsgate-latest.apk`

**Key endpoints:**
- `POST /message` — send SMS
- `GET /message/{id}` — check delivery status
- `GET /health` — health check
- `POST /webhooks` — configure incoming SMS webhooks

**Credentials:** Auto-generated username/password shown on app home screen.

---

## hu60-sms-flutter-gateway (guanzi008)

**URL:** https://github.com/guanzi008/hu60-sms-flutter-gateway  
**Stars:** ~50 | **License:** MIT | **Status:** Low activity  
**Language:** Flutter/Dart

**What it does:** Flutter-based SMS gateway app. Similar concept to SMSGate but built with Flutter.

**Use case:** Backup option if SMSGate has issues on a specific Android version. Not recommended as primary.

**Dependencies:** Flutter SDK required to build from source.

---

## hu60sms (hu60t)

**URL:** https://github.com/hu60t/hu60sms  
**Stars:** ~200 | **License:** MIT | **Status:** Moderate activity  
**Language:** Go

**What it does:** A Go binary that runs in Termux on Android and forwards SMS via HTTP. Lighter weight than the full app approach.

**Use case:** Termux-native alternative. Good for sha-dynasty (Samsung S9) where Termux is already the primary interface.

**Setup in Termux:**
```bash
# Build from source in Termux
pkg install golang
cd ~/hu60sms
go build -o hu60sms main.go
./hu60sms  # runs on :8080 by default
```

**Config:** `config.json` in the repo root. Set `apikey` to a secret of your choice.

---

## sms_llm (evidlo)

**URL:** https://github.com/evidlo/sms_llm  
**Stars:** ~150 | **License:** GPL-3.0 | **Status:** Experimental  
**Language:** Python

**What it does:** SMS ↔ MQTT ↔ Ollama bridge. Receives SMS via Android SMS app, routes through MQTT broker, queries a local LLM, sends reply back.

**Use case:** Reference architecture for the SMS-Ollama bridge pattern. The `webhook-receiver.py` in this project is a simpler, Tailscale-native version of this concept.

**Key insight from this repo:** The MQTT approach adds unnecessary complexity for our use case since we have Tailscale. Direct HTTP webhooks are cleaner.

---

## ollama-mcp-bridge (jonigl)

**URL:** https://github.com/jonigl/ollama-mcp-bridge  
**Stars:** ~800 | **License:** MIT | **Status:** Actively maintained  
**Language:** Python (FastAPI)

**What it does:** Sits in front of the Ollama API and transparently adds MCP tool support to every request. Cursor connects to this instead of Ollama directly, and gets access to all configured MCP tools.

**Why it matters for the swarm:**
- Lets Cursor on thetablet use Ollama on shitbox-jr as a backend WITH tool use
- MCP tools can include SMS sending, file operations, task queue operations
- Supports streaming responses and thinking mode

**Setup:**
```bash
pip install ollama-mcp-bridge
ollama-mcp-bridge --ollama-url http://localhost:11434 --port 11435 \
  --mcp-config /path/to/mcp-config.json
```

**Docker:**
```bash
docker compose up -d  # uses the included docker-compose.yml
```

---

## public-apis (public-apis)

**URL:** https://github.com/public-apis/public-apis  
**Stars:** ~330,000 | **License:** MIT | **Status:** Community maintained  
**Language:** Markdown

**What it does:** Curated list of 1,400+ free public APIs organized by category.

**Use case:** Reference when adding new integrations to the swarm. Useful for finding free APIs for weather, finance, notifications, etc. without paying for cloud services.

**Notable categories for swarm use:**
- Anti-Malware (for security audit automation)
- Finance (crypto prices, market data)
- Weather (for trading signals)
- SMS (cloud SMS alternatives if self-hosted fails)
