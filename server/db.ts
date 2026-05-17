import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditEvents,
  conversations,
  costEntries,
  InsertUser,
  messages,
  nodeStatus,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const f of textFields) {
    const v = user[f] ?? null;
    values[f] = v;
    updateSet[f] = v;
  }
  if (user.lastSignedIn) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function createConversation(userId: number, model: string, title?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(conversations).values({ userId, model, title: title ?? "New Conversation" });
  const r = await db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt)).limit(1);
  return r[0]!;
}

export async function updateConversationTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

export async function addMessage(conversationId: number, role: "user" | "assistant" | "system", content: string, tokensUsed = 0, costUsd = 0) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(messages).values({ conversationId, role, content, tokensUsed, costUsd });
  const r = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(1);
  return r[0]!;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
}

export async function createTask(userId: number, name: string, description: string, model: string, targetNode?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(tasks).values({ userId, name, description, model, targetNode, status: "pending" });
  const r = await db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt)).limit(1);
  return r[0]!;
}

export async function updateTaskStatus(id: number, status: "pending" | "running" | "completed" | "failed", result?: string) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const update: Record<string, unknown> = { status };
  if (status === "running") update.startedAt = now;
  if (status === "completed" || status === "failed") { update.completedAt = now; if (result) update.result = result; }
  await db.update(tasks).set(update).where(eq(tasks.id, id));
}

// ── Cost Entries ──────────────────────────────────────────────────────────────

export async function getCostSummary(userId: number) {
  const db = await getDb();
  if (!db) return { cumulative: [], session: [] };
  const cumulative = await db.select({
    provider: costEntries.provider,
    totalCost: sql<number>`SUM(${costEntries.costUsd})`,
    totalInputTokens: sql<number>`SUM(${costEntries.inputTokens})`,
    totalOutputTokens: sql<number>`SUM(${costEntries.outputTokens})`,
  }).from(costEntries).where(eq(costEntries.userId, userId)).groupBy(costEntries.provider);
  return { cumulative };
}

export async function addCostEntry(userId: number, sessionId: string, provider: "deepseek" | "claude" | "qwen", model: string, inputTokens: number, outputTokens: number, costUsd: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(costEntries).values({ userId, sessionId, provider, model, inputTokens, outputTokens, costUsd });
}

export async function getSessionCosts(userId: number, sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(costEntries).where(and(eq(costEntries.userId, userId), eq(costEntries.sessionId, sessionId)));
}

// ── Node Status ───────────────────────────────────────────────────────────────

export async function getNodeStatuses() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(nodeStatus).orderBy(nodeStatus.nodeName);
}

export async function upsertNodeStatus(nodeName: string, os: string, isOnline: boolean, tailscaleIp?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(nodeStatus).values({ nodeName, os, isOnline, lastSeen: isOnline ? new Date() : undefined, tailscaleIp })
    .onDuplicateKeyUpdate({ set: { isOnline, lastSeen: isOnline ? new Date() : undefined, tailscaleIp, os } });
}

// ── Audit Events ──────────────────────────────────────────────────────────────

export async function getAuditEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditEvents).where(eq(auditEvents.userId, userId)).orderBy(auditEvents.scheduledAt);
}

export async function createAuditEvent(userId: number, title: string, description: string, scheduledAt: Date, isRecurring: boolean, recurringDays?: number, checklist?: string[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(auditEvents).values({ userId, title, description, scheduledAt, isRecurring, recurringDays, checklist: checklist ?? [] });
  const r = await db.select().from(auditEvents).where(eq(auditEvents.userId, userId)).orderBy(desc(auditEvents.createdAt)).limit(1);
  return r[0]!;
}

export async function updateAuditEvent(id: number, updates: { completedAt?: Date; completedItems?: string[] }) {
  const db = await getDb();
  if (!db) return;
  await db.update(auditEvents).set(updates).where(eq(auditEvents.id, id));
}

export async function deleteAuditEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(auditEvents).where(and(eq(auditEvents.id, id), eq(auditEvents.userId, userId)));
}
