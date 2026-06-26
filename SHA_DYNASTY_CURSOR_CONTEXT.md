# SHA-Dynasty Distributed LLM Local Swarm — Cursor Context Prompt

> **Drop this entire file into Cursor's `.cursorrules` or paste it as the first message in any Cursor chat session on any device. It is the single source of truth for the entire fleet. No re-explaining, no re-orienting.**

---

## Who You Are Working With

You are assisting **Paul** on the **SHA-Dynasty** project — a distributed, locally-operated LLM agent swarm built across a personal device fleet connected via Tailscale VPN. The system is designed to offload repetitive, agentic, and computational work onto local LLM instances so that heavier cloud models (Claude, Deepseek) are reserved for high-value tasks only.

The primary development tools are **Cursor** (preferred, mouse-driven) and **VS Code with GitHub Copilot** (secondary, for delegation and fleet tasks). Manus AI is the heavy-lift orchestrator for architecture, research, and large builds.

**Core principles for all work on this project:**

- Security-first: no secrets in git, no plaintext credentials anywhere, no exposed ports to the public internet
- Lightweight-first: agents must be able to run on CPU-only, low-RAM devices including Android via Termux
- Persistent context: every device should be able to resume work without re-explanation
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` — always
- TDD: write tests before implementation, >80% coverage on new code
- TypeScript strict mode, Python 3.8+ with type hints and mypy

---

## Fleet Topology

All 5 devices are connected via **Tailscale** under the tailnet `yomamasofat-shesitaroundthehouse.github`.

| Device | Hostname | OS | Tailscale IP | Role |
|--------|----------|----|-------------|------|
| Lenovo laptop | `shitbox` | Linux (Ubuntu) | `100.x.x.x` (run `tailscale status` to confirm) | Primary orchestrator |
| HP laptop | `shitbox-jr` | Linux (Ubuntu) | `100.125.48.6` | Compute worker |
| Samsung S9 | `sha-dynasty` | Android (Termux) | Tailscale-assigned | Credential vault / mobile agent |
| Surface Pro 6 | `thetablet` | Windows 11 | Tailscale-assigned | Dev workstation (Cursor + VS Code) |
| LG Velvet | `velvet` | Android (Termux) | Tailscale-assigned | Mobile agent |

> **Note on IPs**: Tailscale IPs are stable within the tailnet but the `100.x.x.x` range is private. Always use hostnames or Tailscale IPs — never expose services on public interfaces.

---

## Device Specifications

### shitbox — Lenovo (Primary Orchestrator)

| Spec | Value |
|------|-------|
| **CPU** | Intel x86 (Lenovo laptop) |
| **Storage** | 238.5 GB NVMe SSD (LUKS encrypted) + 3× ~932 GB external HDDs (exFAT) |
| **Tailscale** | v1.96.4 ✅ |
| **SSH** | Port 22, key: `~/.ssh/id_ed25519` (Ed25519) |
| **SSH public key** | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDx9ZJclP5vNXykhXobYOwz7JwaPz8K4sMlMa3tGQ672 paul@Shitbox` |

**Active systemd services:**

| Service | Function | Schedule |
|---------|----------|----------|
| `shitbox-remote-sync.service` | SSH tunnel to shitbox-jr | Persistent |
| `nexus-daily.service` | OHLCV data ingestion (5 exchanges) | Daily 00:05 UTC |
| `data-validator.service` | Post-ingest data validation | Triggered post-ingest |
| `freqtrade-bot.service` | Live trading bot | 24/7 |
| `signal-generator.service` | Haiku inference, buy/sell signals | Every 5 min |
| `health-monitor.service` | System health checks | Every 5 min |
| `pnl-reporter.service` | Daily P&L email | Daily 09:00 UTC |

**Key ports on shitbox:**

| Port | Service | Binding |
|------|---------|---------|
| 22 | SSH | Tailscale interface only |
| 8080 | Freqtrade REST API | localhost only |
| 11434 | Ollama (if installed) | localhost only |

**Storage layout:**

```
/                          → NVMe SSD, 238.5 GB, LUKS encrypted
/mnt/media1                → External HDD, Jellyfin library (~347 GB used)
/mnt/media2                → External HDD, personal/phone backups
/mnt/trading               → External HDD, trading data (~3.7 GB used)
  └── archived_data/nexus_archive.db   (SQLite, OHLCV from 5 exchanges)
  └── models/haiku/                    (Haiku 3.5 weights)
  └── models/qwen3/                    (Qwen 3 weights)
  └── backtests/results/               (VectorBT + Freqtrade outputs)
  └── live_trading/trades.db           (SQLite, all executed trades)
```

---

### shitbox-jr — HP (Compute Worker)

| Spec | Value |
|------|-------|
| **CPU** | Intel x86 (HP laptop) |
| **Tailscale IP** | `100.125.48.6` (confirmed) |
| **Tailscale** | v1.88.4 ⚠️ — needs upgrade to 1.96.4 |
| **SSH** | Port 22, accessible via `ssh root@100.125.48.6` from shitbox (no password) |
| **Bootstrap script** | `/home/paul/shitbox_jr_bootstrap.sh` on shitbox-jr |

**Planned systemd services (pending bootstrap):**

| Service | Function | Schedule |
|---------|----------|----------|
| `qwen-inference.service` | Qwen 3 strategy analysis | On-demand |
| `vectorbt-analysis.service` | Portfolio backtesting | Hourly |
| `redis.service` | Cache sync with shitbox | Persistent |

**Key ports on shitbox-jr:**

| Port | Service | Binding |
|------|---------|---------|
| 22 | SSH | Tailscale interface only |
| 6379 | Redis | localhost only |
| 11434 | Ollama / Qwen | localhost only |

**Bootstrap one-liner (run directly on shitbox-jr):**
```bash
mkdir -p ~/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDx9ZJclP5vNXykhXobYOwz7JwaPz8K4sMlMa3tGQ672 paul@Shitbox" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && sudo apt update -qq && sudo apt install --upgrade -y tailscale && sudo systemctl restart tailscale
```

---

### sha-dynasty — Samsung S9 (Credential Vault / Mobile Agent)

| Spec | Value |
|------|-------|
| **OS** | Android, Termux |
| **Role** | Credential vault, lightweight mobile agent |
| **Tailscale** | Connected ✅ |
| **Access** | Termux terminal, Tailscale-assigned IP |

This device holds credentials and acts as a lightweight agent runner. All credential access must go through this device's vault — never store secrets on shitbox or shitbox-jr directly.

---

### thetablet — Surface Pro 6 (Dev Workstation)

| Spec | Value |
|------|-------|
| **OS** | Windows 11 |
| **RAM** | 8 GB |
| **CPU** | Intel Core i5-8250U (x86) |
| **Dev tools** | Cursor (primary), VS Code + GitHub Copilot (secondary) |
| **Tailscale** | Connected ✅ |
| **Auth** | Windows Hello PIN + YubiKey 5 (FIDO2 enrolled, in progress) |

This is the primary development workstation. Cursor is the preferred IDE. VS Code is used for GitHub Copilot delegation tasks (`gh copilot fleet`, `gh copilot delegate`).

---

### velvet — LG Velvet (Mobile Agent)

| Spec | Value |
|------|-------|
| **OS** | Android, Termux |
| **Role** | Lightweight mobile agent, task runner |
| **Tailscale** | Connected ✅ |

Secondary mobile agent. Runs lightweight Python scripts and Termux-based task runners. No GPU, CPU-only inference only.

---

## Network Architecture

```
[thetablet] ──────────────────────────────────┐
[sha-dynasty] ────────────────────────────────┤
[velvet] ─────────────────────────────────────┤
                                               ▼
                                    [ Tailscale VPN Mesh ]
                                    (yomamasofat-shesitaroundthehouse.github)
                                               │
                              ┌────────────────┴────────────────┐
                              ▼                                  ▼
                    [shitbox] (orchestrator)          [shitbox-jr] (compute)
                    100.x.x.x                         100.125.48.6
                    SSH :22                           SSH :22
                    Freqtrade :8080 (local)           Redis :6379 (local)
                    Ollama :11434 (local)             Ollama :11434 (local)
```

**All inter-node communication must use Tailscale IPs. No service should bind to `0.0.0.0` or a public interface.**

---

## Active Project: SHA-Dynasty Dashboard

A full-stack web orchestrator dashboard is live and deployed. It provides a GUI for all swarm operations.

| Detail | Value |
|--------|-------|
| **Live URL** | `https://shadash-xbcyfwtv.manus.space` |
| **Stack** | React 19 + Tailwind 4 + Express + tRPC + MySQL |
| **Repo** | `SHA_Dynasty-distributed-llm-local-swarm` (GitHub, being created) |
| **Local path** | `/home/ubuntu/sha-dynasty-dashboard` (Manus sandbox) |
| **Auth** | Manus OAuth |

**Dashboard features:**
- Persistent chat with Deepseek Flash, Qwen (via Ollama), and Claude
- Manual task routing form — pick model and target node explicitly
- Task queue (pending / running / completed)
- Node status panel — all 5 Tailscale nodes with online/offline indicators
- Network health panel with last-seen timestamps
- API cost tracker (per-session + cumulative, Deepseek and Claude)
- Security audit calendar with checklists

---

## LLM Backend Configuration

| Model Label | Backend | Host | Port | Notes |
|-------------|---------|------|------|-------|
| **Deepseek Flash** | Deepseek API | `api.deepseek.com` | 443 (HTTPS) | Cloud, cheapest per token |
| **Qwen (via Ollama)** | Ollama on shitbox-jr | `100.125.48.6` | 11434 | Local, CPU inference, `qwen3.5:4b` — needs `ollama pull qwen3.5:4b` |
| **Claude** | Anthropic API | `api.anthropic.com` | 443 (HTTPS) | Cloud, highest quality |

**Critical blocker**: `ollama pull qwen3.5:4b` has not been run on shitbox-jr yet. Until this is done, local Qwen inference is unavailable.

---

## Security Hardening Checklist (Current State)

| Item | Status | Action |
|------|--------|--------|
| GitHub PAT exposed in repo | ✅ Expired/revoked | History purge still needed |
| Recovery codes in repo | ⚠️ Exposed | Regenerate at github.com/settings/security |
| SSH keys on shitbox | ✅ Ed25519 generated | — |
| SSH keys on shitbox-jr | ⚠️ Pending bootstrap | Run bootstrap one-liner |
| Tailscale ACL review | ⚠️ Not done | Restrict node-to-node access by role |
| Secrets in `.env` files | ⚠️ Audit needed | Ensure no `.env` files committed |
| Freqtrade API | ⚠️ localhost only | Verify no external binding |
| Redis | ⚠️ Not deployed yet | Must bind to localhost only when deployed |
| YubiKey FIDO2 on thetablet | ⚠️ In progress | FIDO2 PIN set, enrollment pending |

---

## Coding Standards (AGENTS.md)

### TypeScript
- Strict mode (`"strict": true`)
- 2-space indentation, single quotes, trailing commas in multi-line
- Max line length: 100 characters
- Functional components only, named exports only

### Python
- Version 3.8+, type hints enforced via mypy
- Google-style docstrings on all public functions
- pytest for testing, TDD approach

### Git
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Branch naming: `feature/`, `bugfix/`, `hotfix/`, `docs/`
- Never commit secrets, API keys, or credentials

### Security
- All secrets in `.env` files, `.env` in `.gitignore`
- Parameterized queries for all database access
- Input validation and sanitization on all user inputs
- No service binds to `0.0.0.0` — Tailscale interface or localhost only

---

## Cursor Workflow on This Project

When working in Cursor on any device in the fleet, follow this sequence:

**1. Orient** — paste this file as context if starting a new session.

**2. Plan first** — before writing any code, ask Cursor to outline every file that needs to change and the order of changes.

**3. TDD** — write the test file before the implementation file.

**4. Commit often** — use Conventional Commits after each logical unit of work.

**5. Security check before push** — run `git diff --staged` and confirm no secrets, no `0.0.0.0` bindings, no hardcoded IPs (use env vars instead).

**VS Code + Copilot delegation pattern (for parallel tasks):**
```bash
gh copilot delegate "Create API endpoints for [FEATURE] with validation and tests"
gh copilot fleet "Task 1" "Task 2" "Task 3"
```

---

## Immediate Priorities (as of May 2026)

1. **Bootstrap shitbox-jr** — run the one-liner above, then `ollama pull qwen3.5:4b`
2. **Purge git history** — remove the `Github First Project Tokens/` folder from all commits using `git filter-repo`
3. **Regenerate GitHub recovery codes** — at https://github.com/settings/security
4. **Tailscale ACL hardening** — restrict which nodes can reach which ports
5. **Wire Deepseek + Anthropic API keys** into the dashboard via the Secrets panel
6. **Node heartbeat script** — lightweight script on each Linux node that POSTs to the dashboard's `/api/trpc/nodes.heartbeat` endpoint every 60 seconds

---

*This document is the persistent context for the SHA-Dynasty fleet. Keep it updated as the system evolves. Last updated: May 2026.*
