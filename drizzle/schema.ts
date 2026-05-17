import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  float,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Conversations & Messages ──────────────────────────────────────────────────

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("New Conversation"),
  model: varchar("model", { length: 64 }).notNull().default("deepseek-flash"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  tokensUsed: int("tokensUsed").default(0),
  costUsd: float("costUsd").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  model: varchar("model", { length: 64 }).notNull(),
  targetNode: varchar("targetNode", { length: 64 }),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  result: text("result"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;

// ── Cost Entries ──────────────────────────────────────────────────────────────

export const costEntries = mysqlTable("cost_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  provider: mysqlEnum("provider", ["deepseek", "claude", "qwen"]).notNull(),
  model: varchar("model", { length: 64 }).notNull(),
  inputTokens: int("inputTokens").default(0),
  outputTokens: int("outputTokens").default(0),
  costUsd: float("costUsd").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CostEntry = typeof costEntries.$inferSelect;

// ── Audit Events ──────────────────────────────────────────────────────────────

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  completedAt: timestamp("completedAt"),
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurringDays: int("recurringDays"),
  checklist: json("checklist").$type<string[]>(),
  completedItems: json("completedItems").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;

// ── Node Status (cached) ──────────────────────────────────────────────────────

export const nodeStatus = mysqlTable("node_status", {
  id: int("id").autoincrement().primaryKey(),
  nodeName: varchar("nodeName", { length: 64 }).notNull().unique(),
  os: varchar("os", { length: 32 }).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  lastSeen: timestamp("lastSeen"),
  tailscaleIp: varchar("tailscaleIp", { length: 45 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NodeStatus = typeof nodeStatus.$inferSelect;
