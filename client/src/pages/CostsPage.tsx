import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CircleDollarSign, TrendingUp, Zap, Server } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PROVIDER_CONFIG: Record<string, { label: string; color: string; cls: string }> = {
  deepseek: { label: "Deepseek Flash", color: "#22d3ee", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  claude: { label: "Claude", color: "#a78bfa", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  qwen: { label: "Qwen (via Ollama)", color: "#4ade80", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
};

const SESSION_ID_KEY = "chat-session-id";

export default function CostsPage() {
  const sessionId = sessionStorage.getItem(SESSION_ID_KEY) ?? "";

  const { data: costData, isLoading } = trpc.costs.summary.useQuery();
  const { data: sessionCosts } = trpc.costs.session.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const cumulative = costData?.cumulative ?? [];
  const totalCumulative = cumulative.reduce((s: number, c: any) => s + (c.totalCost ?? 0), 0);

  const sessionTotal = sessionCosts?.reduce((s, c) => s + (c.costUsd ?? 0), 0) ?? 0;
  const sessionByProvider: Record<string, number> = {};
  sessionCosts?.forEach((c) => {
    sessionByProvider[c.provider] = (sessionByProvider[c.provider] ?? 0) + (c.costUsd ?? 0);
  });

  const chartData = cumulative.map((c: any) => ({
    name: PROVIDER_CONFIG[c.provider]?.label ?? c.provider,
    cost: parseFloat((c.totalCost ?? 0).toFixed(6)),
    color: PROVIDER_CONFIG[c.provider]?.color ?? "#888",
  }));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5 text-primary" />
          Cost Tracker
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          API spend across cloud LLM backends — Deepseek and Claude
        </p>
      </div>

      {/* Top summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Cumulative Spend</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight font-mono">
              ${totalCumulative.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">all time, all providers</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">This Session</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight font-mono">
              ${sessionTotal.toFixed(6)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">current browser session</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Server className="h-4 w-4" />
              <span className="text-xs font-medium text-muted-foreground">Local Inference</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight font-mono text-green-400">$0.00</p>
            <p className="text-xs text-muted-foreground mt-1">Qwen via Ollama — free</p>
          </CardContent>
        </Card>
      </div>

      {/* Cumulative breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cumulative by Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : cumulative.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">No API calls recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Start a chat conversation to track costs.</p>
              </div>
            ) : (
              cumulative.map((c: any) => {
                const cfg = PROVIDER_CONFIG[c.provider] ?? { label: c.provider, cls: "" };
                const pct = totalCumulative > 0 ? ((c.totalCost ?? 0) / totalCumulative) * 100 : 0;
                return (
                  <div key={c.provider} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.cls}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <span className="text-sm font-mono font-medium">
                        ${(c.totalCost ?? 0).toFixed(6)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: PROVIDER_CONFIG[c.provider]?.color ?? "#888" }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{(c.totalInputTokens ?? 0).toLocaleString()} in / {(c.totalOutputTokens ?? 0).toLocaleString()} out tokens</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <Separator className="bg-border/30" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="glow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Spend Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1f2e", border: "1px solid #2a2f3e", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`$${v.toFixed(6)}`, "Cost"]}
                  />
                  <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session breakdown */}
      <Card className="glow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Current Session Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sessionCosts || sessionCosts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No API calls in this session yet.
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(sessionByProvider).map(([provider, cost]) => {
                const cfg = PROVIDER_CONFIG[provider] ?? { label: provider, cls: "" };
                return (
                  <div key={provider} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.cls}`}>
                      {cfg.label}
                    </Badge>
                    <span className="text-sm font-mono">${cost.toFixed(6)}</span>
                  </div>
                );
              })}
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs text-muted-foreground">Session total</span>
                <span className="text-sm font-mono font-semibold">${sessionTotal.toFixed(6)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
