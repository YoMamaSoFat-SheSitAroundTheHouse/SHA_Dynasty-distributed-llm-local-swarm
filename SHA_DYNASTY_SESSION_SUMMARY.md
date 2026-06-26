# SHA-Dynasty — Session Summary
**Date:** June 26, 2026 | **Author:** Manus AI

This document captures every decision, deliverable, discovery, and open item from the current working session. It is intended to be dropped into the Book of Gold knowledge library and committed to both GitHub repos as `SESSION_SUMMARY.md`.

---

## What Was Built

### 1. SHA-Dynasty Orchestrator Dashboard
A full-stack web application providing a polished, terminal-free interface for the entire swarm.

**Live URL:** https://shadash-xbcyfwtv.manus.space  
**Stack:** React 19 + Tailwind 4 + Express + tRPC + MySQL  
**Theme:** Dark navy with electric teal accents

The dashboard includes eight functional panels: an Overview with live summary cards; a Chat interface with persistent conversation history, model selector, and streaming indicators; a manual Task routing form with kanban-style queue; a Nodes panel displaying all five Tailscale nodes with OS badges and online/offline status; an API Cost Tracker with per-session and cumulative spend; a Network Health panel with last-seen timestamps; and a Security Audit calendar with checklist templates.

Model options wired into the selector: **Deepseek Flash**, **Qwen (via Ollama)**, and **Claude**.

### 2. GitHub Repository
**URL:** https://github.com/YoMamaSoFat-SheSitAroundTheHouse/SHA_Dynasty-distributed-llm-local-swarm

The old `SHA_Dynasty-distributed-llm-agent-base` repo was deleted. The new repo contains the full dashboard codebase, the `CURSOR_CONTEXT.md` fleet reference, and the `sms-swarm/` project folder. The `.project-config.json` file (which contained Manus platform credentials) was scrubbed from git history before push using `git-filter-repo`.

### 3. SMS Swarm Communication Layer (`sms-swarm/`)
A complete scaffolded project for adding SMS as a resilience communication channel to the swarm.

**Architecture:** SMSGate APK on velvet (or sha-dynasty as backup) → webhook fires to shitbox-jr → `webhook-receiver.py` queries Ollama → SMS reply sent back to sender.

**Key files:**
- `scripts/swarm-agent.py` — the universal agent script (see below)
- `scripts/webhook-receiver.py` — the original webhook-only bridge
- `scripts/test-sms.sh` — one-command end-to-end test
- `docker-compose.yml` + `Dockerfile` — containerized deployment
- `apks/smsgate-latest.apk` — SMSGate v1.66.0, ready to sideload
- `config/device-configs/*.env` — per-device configuration files for all six nodes

### 4. `swarm-agent.py` — The Universal Agent Script
The architectural centerpiece of the session. One Python script runs on every device in the fleet. Each device gets its own `.env` file specifying its identity, role, and LLM backend. The phone number becomes the interface.

**Supported backends:**

| Backend | Model | Cost | Best For |
|---------|-------|------|----------|
| `groq` | Llama 3.3 70B | Free tier | Fastest responses, commands |
| `deepseek` | DeepSeek V3 | ~$0.001/1K tok | Best reasoning, orchestration |
| `gemini` | Gemini 2.0 Flash | Free tier | Long context, multimodal |
| `mistral` | Mistral Large | Free tier | EU-hosted, strong general |
| `ollama` | qwen-swarm (local) | Free (local) | Fully offline, no API key |

All backends use the same OpenAI-compatible interface internally. Adding a new backend is a single function.

**Per-device identity:** Each instance injects `DEVICE_NAME` and `DEVICE_ROLE` into the system prompt at startup, so the model knows exactly who it is and where it sits in the fleet without any manual context-setting.

**Endpoints exposed:**
- `GET /health` — returns device name, role, and active backend
- `POST /webhook/sms` — receives SMSGate webhooks, queries LLM, sends SMS reply
- `POST /ask` — direct HTTP query for testing without SMS

---

## Fleet Hardware Summary

| Device | CPU | RAM | OS | LLM Capability | Status |
|--------|-----|-----|----|----------------|--------|
| **shitbox** | Intel (unknown) | Unknown | Ubuntu Linux | 7B+ likely | Tailscale confirmed |
| **shitbox-jr** | Intel (unknown) | ~16GB est. | Ubuntu Linux | 7B models (proven) | Ollama running, 3 models pulled |
| **thetablet** | Intel Core i5-8350U | 8GB | Windows 11 | Client only | Tailscale confirmed |
| **sha-dynasty** | Snapdragon 845 | 4GB | Android | 1.5B only | Tailscale confirmed |
| **velvet** | Snapdragon 765G | 6GB | Android | 1.5B only | Tailscale confirmed |
| **potato** | i7-9750H 6-core | 32GB | Windows 11 | 13–14B models | GPU unconfirmed |

**The potato is the most powerful node in the fleet** and is currently idle. The i7-9750H was commonly paired with a GTX 1650 or 1660 Ti. If that GPU is present, the potato becomes the primary inference node for large models. Confirm with: `Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM`

---

## Ollama Models on shitbox-jr

| Model | Size | Use Case |
|-------|------|----------|
| `qwen2.5:7b` | 4.7 GB | General tasks |
| `qwen2.5:1.5b` | 986 MB | Fast lightweight tasks |
| `qwen2.5-coder:7b` | 4.7 GB | Code generation |
| `qwen-swarm` | (pending) | Swarm-aware agent (Modelfile ready) |

The `qwen-swarm` Modelfile was written and the creation command was provided. Confirm it was created with `ollama list`.

---

## Key Architectural Decisions

**Unified harness: Ollama.** Runs on Linux, Windows, and Android. Exposes an OpenAI-compatible API on every device. Already proven in the stack on shitbox-jr.

**SMS as resilience channel.** Tailscale, Dropbox, and SSH all require internet. SMS requires only cellular signal. This makes SMS the last-resort communication layer when everything else fails. It also doubles as a command interface — text any node, get an LLM response.

**Free cloud APIs over local for most nodes.** Groq (Llama 3.3 70B, free tier, ~500 tok/s) is faster than local CPU inference on most devices in the fleet. The cost of running local models on low-RAM devices (sha-dynasty, velvet) is not worth it. Use free cloud APIs on those nodes and reserve local inference for shitbox-jr and potato.

**One script, six configs.** `swarm-agent.py` is the same file on every device. The `.env` file is the only thing that changes. This is the contiguous architecture — same codebase, different identity.

**Cursor + DeepSeek as the primary dev stack.** Cursor handles the heavy lifting on thetablet. DeepSeek is the reasoning backend. Local Qwen fills in for offline/cheap tasks. This combination is cheaper and more effective than any single tool alone.

---

## Tailscale Network

All five nodes are confirmed on the Tailscale network. The exact IPs for velvet, sha-dynasty, and thetablet need to be confirmed from the Tailscale admin panel at https://login.tailscale.com/admin/machines.

**Security note:** Any Tailscale machines in the admin panel that are not in the active fleet should be removed. Unused machines are a security surface — if a device is lost or compromised, it retains network access until explicitly removed.

---

## YubiKey Status

The YubiKey 5 Series was factory-reset (`ykman fido reset`) and is now clean. The FIDO2 PIN was set via `ykman fido access change-pin`. Windows enrollment via Settings → Accounts → Sign-in options → Security Key → Set up is pending. The blocker was verifying the Windows local account password — the Microsoft account password should work at the lock screen password prompt.

---

## Open Items (Priority Order)

**Immediate (unblock the swarm):**

- [ ] Confirm `ollama list` shows `qwen-swarm` on shitbox-jr
- [ ] Confirm Tailscale IPs for velvet, sha-dynasty, and thetablet
- [ ] Run `Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM` on potato
- [ ] Sideload `smsgate-latest.apk` onto velvet, note credentials
- [ ] Fill in `.env` files for each device from `config/device-configs/`
- [ ] Run `python swarm-agent.py` on shitbox-jr and test with `curl http://localhost:5000/health`

**Short term (wire everything together):**

- [ ] Add Groq API key to the dashboard Secrets panel
- [ ] Add DeepSeek API key to the dashboard Secrets panel
- [ ] Configure SMSGate webhook on velvet pointing to shitbox-jr:5000
- [ ] Run `bash scripts/test-sms.sh` end-to-end test
- [ ] Bootstrap shitbox-jr SSH access from shitbox (confirm Tailscale routing)
- [ ] Complete YubiKey enrollment on thetablet

**Medium term (harden and extend):**

- [ ] Remove unused Tailscale machines from admin panel
- [ ] Set up `swarm-agent.py` as a systemd service on shitbox-jr (auto-start on boot)
- [ ] Set up `swarm-agent.py` in Termux on velvet with Termux:Boot for auto-start
- [ ] Wire the potato into the swarm (Ollama install, swarm-agent.py, Tailscale confirm)
- [ ] Evaluate WhatsApp Business API as an alternative to raw SMS (end-to-end encrypted, but requires Meta account)
- [ ] Evaluate Signal as a more private alternative (self-hosted Signal server is complex but possible)

**Long term (the dream):**

- [ ] Each device has its own phone number saved in contacts as its device name
- [ ] The swarm routes tasks between nodes automatically based on capability
- [ ] The dashboard shows real-time node health from heartbeat pings
- [ ] Security audit calendar triggers automated checks via the swarm

---

## Free API Keys Needed

| Service | Free Tier | Get Key At |
|---------|-----------|------------|
| **Groq** | 14,400 req/day, Llama 3.3 70B | https://console.groq.com |
| **DeepSeek** | $5 free credit | https://platform.deepseek.com |
| **Google Gemini** | 1M tokens/day, Gemini 2.0 Flash | https://aistudio.google.com/apikey |
| **Mistral** | Free tier available | https://console.mistral.ai |

All four are free at the usage levels this swarm requires. DeepSeek is the best reasoning model. Groq is the fastest. Gemini has the largest context window.

---

## Files Produced This Session

| File | Location | Purpose |
|------|----------|---------|
| `UNIFIED_MASTER_PLAN.md` | upload/ | Full project synthesis from all context sources |
| `repo_triage_roadmap.md` | upload/ | Old repo audit and cleanup plan |
| `YubiKey_Sonnet_Prompt_V3.json` | upload/ | YubiKey setup prompt for Sonnet |
| `SHA_DYNASTY_CURSOR_CONTEXT.md` | upload/ + repo root | Full fleet context for any Cursor workspace |
| `TAILSCALE_CURSOR_CONTEXT.md` | upload/ | Tailscale + remote power project context |
| `POTATO_CURSOR_BRIEF.md` | upload/ | Potato hardware assessment for Cursor |
| `SHA_DYNASTY_MASTER_TODO.md` | upload/ | Fleet reorientation and todo list |
| `SHA_DYNASTY_HARDWARE_ASSESSMENT.md` | upload/ | Hardware specs and LLM harness recommendation |
| `SMS_GATEWAY_REPORT.md` | upload/ | SMS gateway comparison (SMSGate vs alternatives) |
| `SMS_SWARM_CURSOR_PROMPT.json` | upload/ | SMS swarm deployment prompt for Cursor |
| `sms-swarm/` | /home/ubuntu/ | Full scaffolded SMS swarm project |
| `sms-swarm/scripts/swarm-agent.py` | sms-swarm/ | Universal swarm agent script |
| `sms-swarm/config/device-configs/*.env` | sms-swarm/ | Per-device configuration files |
| `sms-swarm/apks/smsgate-latest.apk` | sms-swarm/ | SMSGate v1.66.0 APK |
| Dashboard codebase | sha-dynasty-dashboard/ | Full web app, live at manus.space |

---

## References

- SMSGate (android-sms-gateway): https://github.com/capcom6/android-sms-gateway
- Ollama MCP Bridge: https://github.com/jonigl/ollama-mcp-bridge
- Groq free tier: https://console.groq.com/docs/rate-limits
- DeepSeek API: https://platform.deepseek.com/docs
- Gemini API free tier: https://ai.google.dev/pricing
- Tailscale admin: https://login.tailscale.com/admin/machines
- Dashboard: https://shadash-xbcyfwtv.manus.space
- Repo: https://github.com/YoMamaSoFat-SheSitAroundTheHouse/SHA_Dynasty-distributed-llm-local-swarm
