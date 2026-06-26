# SHA-Dynasty — Updated Project Understanding
**Date:** June 26, 2026 | **Status:** Living Document

This document supersedes all previous limitation assessments. It reflects what we now know is possible after today's discoveries, and replaces the earlier framing of "what we can't do yet" with an honest map of what is now within reach and what the actual remaining constraints are.

---

## What Changed Today

Three discoveries fundamentally shifted the ceiling of this project.

**Discovery 1: Free API tier power is real.** Groq serves Llama 3.3 70B at roughly 500 tokens per second on a free tier. DeepSeek V3 costs approximately $0.001 per thousand tokens. Gemini 2.0 Flash has a free tier with a 1 million token context window. The assumption that "powerful inference = expensive" is no longer true. The swarm can run cloud-grade intelligence on every node for essentially zero cost at the usage volumes this project requires.

**Discovery 2: `swarm-state` already exists and works.** The Git-based state synchronization bus between PC and Termux was already built and committed. The pattern — PC writes a JSON task payload, Termux polls on a cron schedule, Termux writes results back, PC reads them — is clean, dependency-free, and already proven. This means the inter-node communication layer is not a future problem. It is a solved problem waiting to be extended.

**Discovery 3: SMSGate turns Android phones into API endpoints.** Any Android device with a SIM card and SMSGate installed becomes a REST API that can send and receive SMS messages. Combined with Tailscale, this means every node in the fleet is reachable from anywhere in the world via a text message, with no cloud relay, no third-party service, and no monthly cost beyond the existing cellular plan. The phone number becomes the interface.

---

## The Revised Capability Map

### What We Can Now Do (That We Thought We Couldn't)

**Run powerful inference on every node for free.** The previous constraint was that low-RAM devices (sha-dynasty at 4GB, velvet at 6GB) could not run meaningful local models. This is still true for local inference. But it is irrelevant, because Groq and Gemini Flash are faster than any local CPU inference and cost nothing at these usage levels. Every device in the fleet can now query a 70B model in under two seconds.

**Communicate between nodes without Tailscale.** The `swarm-state` Git bus works over any internet connection. SMSGate works over cellular. The swarm now has three independent communication channels: Tailscale (fastest, private), Git (async, persistent), and SMS (cellular fallback, always-on). If any two of these fail simultaneously, the third still works.

**Text any computer from anywhere.** Once SMSGate is running on velvet or sha-dynasty, you can send a text to that phone number from any device in the world and get an LLM response back. The phone is the terminal. This is not a future feature — it is one `pip install` and one APK sideload away from working.

**Deploy the same agent code to every device.** `swarm-agent.py` is a single 150-line Python file. The `.env` file is the only difference between a shitbox-jr deployment and a velvet deployment. This is the contiguous architecture that was the original goal of the project — same codebase, different identity, different backend.

**The potato is the most powerful inference node in the fleet.** The i7-9750H with 32GB RAM can run 13–14B parameter models locally. If the GPU is confirmed (likely a GTX 1650 or 1660 Ti given the CPU pairing), it can run GPU-accelerated inference and becomes faster than any other node for local models. This device is currently idle.

---

## The Actual Remaining Constraints

These are the real limitations — not the ones we thought we had before today.

**The potato GPU is unconfirmed.** One PowerShell command resolves this: `Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM`. Until this is run, the potato's inference tier is unknown.

**Shitbox specs are unknown.** The primary orchestrator node has never had its RAM confirmed. This matters because it determines whether shitbox can run local models or must route to shitbox-jr or the potato for inference.

**SMSGate is not yet deployed.** The APK is downloaded. The architecture is designed. The `.env` configs are written. But the app is not yet installed on velvet or sha-dynasty, and the webhook is not yet pointed at shitbox-jr. This is a 15-minute task.

**`swarm-agent.py` has not been tested end-to-end.** The script is written and committed. It has not been run on any device yet. The first test — `curl http://localhost:5000/health` on shitbox-jr — has not happened.

**The `qwen-swarm` Modelfile may not have been created.** The command was provided but the output was never confirmed. `ollama list` on shitbox-jr will show whether it exists.

**Tailscale IPs for three devices are unconfirmed.** Velvet, sha-dynasty, and thetablet have Tailscale installed but their exact IPs have not been recorded. The Tailscale admin panel at https://login.tailscale.com/admin/machines resolves this in 30 seconds.

**The dashboard chat is not yet wired to real backends.** The dashboard UI is live and functional. The model selector shows Deepseek Flash, Qwen (via Ollama), and Claude. But the actual API keys have not been added to the Secrets panel, so chat currently routes through the built-in Manus model. Adding the Groq and DeepSeek keys takes two minutes.

---

## The Architecture as It Now Stands

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMUNICATION LAYERS                      │
│                                                             │
│  Layer 1: Tailscale (private mesh, always preferred)        │
│  Layer 2: swarm-state Git bus (async, persistent)           │
│  Layer 3: SMS via SMSGate (cellular fallback, always-on)    │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   shitbox    │    │  shitbox-jr  │    │    potato    │
│  (Lenovo)    │◄──►│    (HP)      │◄──►│  (DESKTOP)   │
│  Orchestr.   │    │  7B Qwen     │    │  13-14B LLM  │
│  Freqtrade   │    │  VectorBT    │    │  32GB RAM    │
│  Haiku       │    │  Redis       │    │  i7-9750H    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ Tailscale mesh
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────┴───────┐    ┌──────┴───────┐    ┌──────┴───────┐
│  sha-dynasty │    │    velvet    │    │  thetablet   │
│  (S9 Android)│    │ (LG Android) │    │ (Surface Pro)│
│  Cred vault  │    │  SMS gateway │    │  Dev station │
│  Termux      │    │  SMSGate     │    │  Cursor/VSC  │
│  1.5B LLM    │    │  1.5B LLM    │    │  Client only │
└──────────────┘    └──────────────┘    └──────────────┘

All nodes run swarm-agent.py with device-specific .env config.
All LLM calls route to: Groq (free) / DeepSeek / Gemini / local Qwen.
```

---

## The Revised Build Order

The original build order assumed local inference was the primary challenge. It is not. The primary challenge is deployment — getting the working code onto the devices. The revised order reflects this.

**Week 1 — Prove the loop:**
Run `swarm-agent.py` on shitbox-jr with a Groq API key. Send it a task via `curl`. Get a response. This proves the entire architecture in one test.

**Week 1 — Add SMS:**
Sideload SMSGate on velvet. Configure the webhook to point at shitbox-jr:5000. Text the phone number from your personal phone. Get an LLM response back via SMS. This proves the SMS channel.

**Week 2 — Extend to all nodes:**
Deploy `swarm-agent.py` on sha-dynasty (Termux), velvet (Termux), and the potato (Windows). Each device gets its own `.env` file. Each device is now independently queryable.

**Week 2 — Wire the dashboard:**
Add Groq and DeepSeek API keys to the dashboard Secrets panel. The chat interface becomes live. The task queue starts routing real work.

**Week 3 — Harden:**
Set up `swarm-agent.py` as a systemd service on shitbox-jr (auto-start on boot). Set up Termux:Boot on velvet and sha-dynasty. Remove unused Tailscale machines. Rotate all credentials.

**Ongoing — The quant stack:**
With the swarm communication layer proven, the algo trading stack (Freqtrade on shitbox, VectorBT on shitbox-jr, FinRL and QuantLib from the BoG mirrors) can be wired in as task types that the swarm routes and executes.

---

## The 91-Repo Book of Gold — What It Means for the Swarm

The 91 private mirrors represent a curated library spanning every layer of the stack. The categories most relevant to immediate build work are:

**Execution and backtest engines** — VectorBT, QuantLib, Riskfolio-Lib, FinRL, algorithmic-trading-with-python, ai-hedge-fund-crypto. These are the compute workloads that shitbox-jr and the potato are designed to run.

**AI agent frameworks** — CrewAI, agent-zero, LangChain, smolagents, LiteLLM, mem0. These inform how `swarm-agent.py` should evolve from a simple webhook handler into a proper multi-step reasoning agent.

**Infrastructure** — Chroma (vector DB), FAISS (similarity search), guidance (structured LLM output), LMQL (LLM query language). These are the persistence and retrieval layer for the swarm's memory.

**DDD and architecture** — ddd-starter-modelling-process, CleanArchitecture, modular-monolith-with-ddd, ddd-by-examples. These inform the code structure of every new component built in the stack.

The `ARCHITECTURE_MAP.md` (referenced in the session but not yet attached) is the document that maps these 91 repos to specific build tasks. Once that file is committed to the BoG, any workspace can pick up the build order without re-reading all 91 repos.

---

## What "Done" Looks Like

The project is done when the following is true simultaneously:

1. You can text any device in the fleet from your personal phone and get an intelligent response.
2. The dashboard shows live node status, real task queue entries, and real API costs.
3. A backtest job submitted via the dashboard routes to shitbox-jr, runs VectorBT, and returns results.
4. The swarm-state Git bus carries task payloads between nodes without manual intervention.
5. Every credential is in a vault, every service auto-starts on boot, and no secrets exist in any repo.

None of these require new technology. All of them require deployment of code that is already written.

---

*Committed to: `book-of-gold` (master) and `SHA_Dynasty-distributed-llm-local-swarm` (main)*
*Next update: after first end-to-end SMS test passes*
