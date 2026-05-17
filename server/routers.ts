import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import {
  addCostEntry,
  addMessage,
  createAuditEvent,
  createConversation,
  createTask,
  deleteAuditEvent,
  deleteConversation,
  getAuditEvents,
  getConversations,
  getCostSummary,
  getMessages,
  getNodeStatuses,
  getSessionCosts,
  getTasks,
  updateAuditEvent,
  updateConversationTitle,
  updateTaskStatus,
  upsertNodeStatus,
} from "./db";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  "deepseek-flash": "Deepseek Flash",
  "qwen-ollama": "Qwen (via Ollama)",
  "claude": "Claude",
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Approximate pricing per 1M tokens
  const pricing: Record<string, { input: number; output: number }> = {
    "deepseek-flash": { input: 0.27, output: 1.10 },
    "claude": { input: 3.0, output: 15.0 },
    "qwen-ollama": { input: 0, output: 0 }, // local, free
  };
  const p = pricing[model] ?? { input: 1.0, output: 3.0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// ── App Router ────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Conversations ──────────────────────────────────────────────────────────

  chat: router({
    listConversations: protectedProcedure.query(({ ctx }) =>
      getConversations(ctx.user.id)
    ),

    createConversation: protectedProcedure
      .input(z.object({ model: z.string(), title: z.string().optional() }))
      .mutation(({ ctx, input }) =>
        createConversation(ctx.user.id, input.model, input.title)
      ),

    deleteConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        deleteConversation(input.id, ctx.user.id)
      ),

    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(({ input }) => getMessages(input.conversationId)),

    sendMessage: protectedProcedure
      .input(
        z.object({
          conversationId: z.number(),
          content: z.string().min(1),
          model: z.string().default("deepseek-flash"),
          sessionId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await addMessage(input.conversationId, "user", input.content);

        // Get conversation history for context
        const history = await getMessages(input.conversationId);
        const contextMessages = history.slice(-20).map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

        // Call LLM (always uses the built-in Forge API)
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a helpful AI assistant integrated into the SHA-Dynasty orchestrator dashboard. You assist with managing distributed LLM agents, task routing, and system operations. Model selected: ${MODEL_LABELS[input.model] ?? input.model}.`,
            },
            ...contextMessages,
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "";
        const assistantContent = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const usage = (response as any).usage ?? {};
        const inputTokens = usage.prompt_tokens ?? 0;
        const outputTokens = usage.completion_tokens ?? 0;
        const costUsd = estimateCost(input.model, inputTokens, outputTokens);

        // Save assistant message
        const saved = await addMessage(
          input.conversationId,
          "assistant",
          assistantContent,
          inputTokens + outputTokens,
          costUsd
        );

        // Track cost
        if (input.model !== "qwen-ollama") {
          const provider = input.model === "claude" ? "claude" : "deepseek";
          await addCostEntry(
            ctx.user.id,
            input.sessionId,
            provider,
            input.model,
            inputTokens,
            outputTokens,
            costUsd
          );
        }

        // Auto-title the conversation after first exchange
        if (history.length <= 1) {
          const titleSnippet = input.content.slice(0, 60).replace(/\n/g, " ");
          await updateConversationTitle(input.conversationId, titleSnippet || "Conversation");
        }

        return { message: saved, costUsd };
      }),
  }),

  // ── Tasks ──────────────────────────────────────────────────────────────────

  tasks: router({
    list: protectedProcedure.query(({ ctx }) => getTasks(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().default(""),
          model: z.string(),
          targetNode: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        createTask(ctx.user.id, input.name, input.description, input.model, input.targetNode)
      ),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "running", "completed", "failed"]),
          result: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        updateTaskStatus(input.id, input.status, input.result)
      ),
  }),

  // ── Nodes ──────────────────────────────────────────────────────────────────

  nodes: router({
    list: publicProcedure.query(() => getNodeStatuses()),

    upsert: protectedProcedure
      .input(
        z.object({
          nodeName: z.string(),
          os: z.string(),
          isOnline: z.boolean(),
          tailscaleIp: z.string().optional(),
        })
      )
      .mutation(({ input }) =>
        upsertNodeStatus(input.nodeName, input.os, input.isOnline, input.tailscaleIp)
      ),

    seed: protectedProcedure.mutation(async () => {
      // Seed the 5 known nodes with their correct OS and simulated status
      const nodes = [
        { nodeName: "sha-dynasty", os: "Android", isOnline: true, tailscaleIp: "100.64.0.1" },
        { nodeName: "shitbox", os: "Linux", isOnline: true, tailscaleIp: "100.64.0.2" },
        { nodeName: "shitbox-jr", os: "Linux", isOnline: false, tailscaleIp: "100.64.0.3" },
        { nodeName: "thetablet", os: "Windows", isOnline: true, tailscaleIp: "100.64.0.4" },
        { nodeName: "velvet", os: "Android", isOnline: false, tailscaleIp: "100.64.0.5" },
      ];
      for (const n of nodes) {
        await upsertNodeStatus(n.nodeName, n.os, n.isOnline, n.tailscaleIp);
      }
      return { seeded: nodes.length };
    }),
  }),

  // ── Costs ──────────────────────────────────────────────────────────────────

  costs: router({
    summary: protectedProcedure.query(({ ctx }) => getCostSummary(ctx.user.id)),

    session: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ ctx, input }) => getSessionCosts(ctx.user.id, input.sessionId)),
  }),

  // ── Audits ─────────────────────────────────────────────────────────────────

  audits: router({
    list: protectedProcedure.query(({ ctx }) => getAuditEvents(ctx.user.id)),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().default(""),
          scheduledAt: z.number(), // unix ms
          isRecurring: z.boolean().default(false),
          recurringDays: z.number().optional(),
          checklist: z.array(z.string()).default([]),
        })
      )
      .mutation(({ ctx, input }) =>
        createAuditEvent(
          ctx.user.id,
          input.title,
          input.description,
          new Date(input.scheduledAt),
          input.isRecurring,
          input.recurringDays,
          input.checklist
        )
      ),

    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) =>
        updateAuditEvent(input.id, { completedAt: new Date() })
      ),

    updateChecklist: protectedProcedure
      .input(z.object({ id: z.number(), completedItems: z.array(z.string()) }))
      .mutation(({ input }) =>
        updateAuditEvent(input.id, { completedItems: input.completedItems })
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteAuditEvent(input.id, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
