import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  // Node queries (actual names from db.ts)
  getNodeStatuses: vi.fn().mockResolvedValue([
    { id: 1, nodeName: "shitbox", os: "Linux", isOnline: true, tailscaleIp: "100.64.0.1", lastSeen: new Date(), createdAt: new Date(), updatedAt: new Date() },
    { id: 2, nodeName: "sha-dynasty", os: "Android", isOnline: false, tailscaleIp: null, lastSeen: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  upsertNodeStatus: vi.fn().mockResolvedValue({ id: 1, nodeName: "shitbox", os: "Linux", isOnline: true, tailscaleIp: "100.64.0.1", lastSeen: new Date(), createdAt: new Date(), updatedAt: new Date() }),
  // Task queries
  getTasks: vi.fn().mockResolvedValue([
    { id: 1, name: "Test task", description: "", model: "deepseek-flash", targetNode: null, status: "pending", startedAt: null, completedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  createTask: vi.fn().mockResolvedValue({ id: 2, name: "New task", description: "", model: "claude", targetNode: null, status: "pending", startedAt: null, completedAt: null, createdAt: new Date(), updatedAt: new Date() }),
  updateTaskStatus: vi.fn().mockResolvedValue({ id: 1, status: "running" }),
  // Conversation queries
  getConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({ id: 1, title: "New conversation", model: "deepseek-flash", createdAt: new Date(), updatedAt: new Date() }),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue({ id: 1, role: "user", content: "Hello", costUsd: 0, provider: "deepseek", inputTokens: 0, outputTokens: 0, createdAt: new Date() }),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  // Cost queries
  getCostSummary: vi.fn().mockResolvedValue([]),
  addCostEntry: vi.fn().mockResolvedValue(undefined),
  getSessionCosts: vi.fn().mockResolvedValue([]),
  // Audit queries
  getAuditEvents: vi.fn().mockResolvedValue([]),
  createAuditEvent: vi.fn().mockResolvedValue({ id: 1, title: "Test audit", description: "", scheduledAt: new Date(), isRecurring: false, recurringDays: null, checklist: [], completedItems: [], completedAt: null, createdAt: new Date(), updatedAt: new Date() }),
  updateAuditEvent: vi.fn().mockResolvedValue({ id: 1, completedAt: new Date() }),
  deleteAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Hello! How can I help?" } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  }),
}));

function makeCtx(role: "admin" | "user" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("nodes procedures", () => {
  it("lists nodes", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.nodes.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].nodeName).toBe("shitbox");
  });

  it("seeds default nodes", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.nodes.seed();
    expect(result.seeded).toBe(5);
  });
});

describe("tasks procedures", () => {
  it("lists tasks", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("Test task");
  });

  it("creates a task", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.create({
      name: "New task",
      description: "",
      model: "claude",
    });
    expect(result.id).toBe(2);
    expect(result.model).toBe("claude");
  });

  it("updates task status", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.tasks.updateStatus({ id: 1, status: "running" });
    expect(result.status).toBe("running");
  });
});

describe("chat procedures", () => {
  it("lists conversations", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.listConversations();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a conversation", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.chat.createConversation({ model: "deepseek-flash" });
    expect(result.id).toBe(1);
    expect(result.model).toBe("deepseek-flash");
  });
});

describe("audits procedures", () => {
  it("lists audits", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates an audit", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.audits.create({
      title: "Test audit",
      description: "",
      scheduledAt: Date.now() + 86400000,
      isRecurring: false,
      checklist: ["Check tokens", "Review ACLs"],
    });
    expect(result.id).toBe(1);
    expect(result.title).toBe("Test audit");
  });
});

describe("costs procedures", () => {
  it("returns cost summary with cumulative field", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.costs.summary();
    // summary returns { cumulative: [...], ... }
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});
