# SHA-Dynasty Dashboard TODO

- [x] Design system: dark theme, color palette, typography in index.css
- [x] Database schema: conversations, messages, tasks, cost_entries, audit_events, node_statuses tables
- [x] Server routers: chat, tasks, nodes, costs, audits
- [x] DashboardLayout with sidebar navigation (Overview, Chat, Tasks, Nodes & Network, Cost Tracker, Security Audits)
- [x] Chat page: persistent sessions, conversation history, streaming, thinking indicator
- [x] Task routing form: compose task, pick model/node, submit
- [x] Task queue view: pending / running / completed columns
- [x] Node status panel: 5 Tailscale nodes with online/offline + OS badge
- [x] Network health panel: Tailscale connectivity + last-seen timestamps
- [x] API cost tracker: per-session and cumulative spend for Deepseek and Claude
- [x] Security audit calendar: scheduled reminders + checklist view
- [x] Overview page: summary cards + node strip + recent conversations + recent tasks
- [x] Vitest coverage for all routers (11 tests passing)
