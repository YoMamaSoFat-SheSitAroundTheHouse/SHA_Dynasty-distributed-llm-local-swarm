import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Server, Wifi, WifiOff, RefreshCw, Network, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const OS_CONFIG: Record<string, { label: string; cls: string }> = {
  Android: { label: "Android", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  Linux: { label: "Linux", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  Windows: { label: "Windows", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

// Known node metadata
const NODE_META: Record<string, { os: string; role: string; description: string }> = {
  "sha-dynasty": { os: "Android", role: "Credential Vault", description: "Samsung S9 — mobile agent & credential vault via Termux" },
  "shitbox": { os: "Linux", role: "Primary Orchestrator", description: "Lenovo — orchestrator, Freqtrade, Claude Haiku inference" },
  "shitbox-jr": { os: "Linux", role: "Compute Worker", description: "HP — Qwen 3, VectorBT, Redis compute worker" },
  "thetablet": { os: "Windows", role: "Dev Terminal", description: "Surface Pro 6 — VS Code, Cursor, development interface" },
  "velvet": { os: "Android", role: "Mobile Agent", description: "LG Velvet — secondary mobile agent via Termux" },
};

export default function NodesPage() {
  const utils = trpc.useUtils();
  const { data: nodes, isLoading } = trpc.nodes.list.useQuery();

  const seedNodes = trpc.nodes.seed.useMutation({
    onSuccess: (r) => {
      utils.nodes.list.invalidate();
      toast.success(`Seeded ${r.seeded} nodes`);
    },
    onError: (err) => toast.error(err.message),
  });

  const onlineCount = nodes?.filter((n) => n.isOnline).length ?? 0;
  const totalCount = nodes?.length ?? 0;

  // If no nodes in DB yet, show seed button
  const isEmpty = !isLoading && totalCount === 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Nodes & Network
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tailscale fleet status and connectivity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`status-dot ${onlineCount > 0 ? "online" : "offline"}`} />
            <span className="text-muted-foreground">
              {onlineCount}/{totalCount} online
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => { utils.nodes.list.invalidate(); toast.success("Refreshed"); }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {isEmpty && (
        <Card className="glow-card border-primary/20">
          <CardContent className="p-6 text-center space-y-3">
            <Server className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No nodes registered yet.</p>
            <Button size="sm" onClick={() => seedNodes.mutate()} disabled={seedNodes.isPending}>
              {seedNodes.isPending ? "Seeding…" : "Initialize fleet nodes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Node grid */}
      {!isEmpty && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-card border border-border animate-pulse" />
              ))
            : nodes?.map((node) => {
                const meta = NODE_META[node.nodeName];
                const osCfg = OS_CONFIG[node.os] ?? { label: node.os, cls: "" };
                return (
                  <Card key={node.nodeName} className={`glow-card transition-all ${node.isOnline ? "" : "opacity-60"}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`status-dot ${node.isOnline ? "online" : "offline"} shrink-0`} />
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-mono font-semibold truncate">
                              {node.nodeName}
                            </CardTitle>
                            {meta && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{meta.role}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${osCfg.cls}`}>
                          {osCfg.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {meta && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>
                      )}
                      <Separator className="bg-border/50" />
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Wifi className="h-3 w-3" />
                            Status
                          </span>
                          <span className={node.isOnline ? "text-green-400" : "text-muted-foreground"}>
                            {node.isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                        {node.tailscaleIp && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Network className="h-3 w-3" />
                              Tailscale IP
                            </span>
                            <span className="font-mono text-[11px]">{node.tailscaleIp}</span>
                          </div>
                        )}
                        {node.lastSeen && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              Last seen
                            </span>
                            <span className="text-[11px]">
                              {formatDistanceToNow(new Date(node.lastSeen), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      )}

      {/* Network health summary */}
      {!isEmpty && !isLoading && (
        <Card className="glow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              Network Health Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HealthStat label="Nodes online" value={`${onlineCount} / ${totalCount}`} ok={onlineCount > 0} />
              <HealthStat label="Android agents" value={`${nodes?.filter((n) => n.os === "Android" && n.isOnline).length ?? 0} / ${nodes?.filter((n) => n.os === "Android").length ?? 0}`} ok />
              <HealthStat label="Linux workers" value={`${nodes?.filter((n) => n.os === "Linux" && n.isOnline).length ?? 0} / ${nodes?.filter((n) => n.os === "Linux").length ?? 0}`} ok />
              <HealthStat label="Tailscale mesh" value={onlineCount > 1 ? "Active" : "Partial"} ok={onlineCount > 1} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HealthStat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3 space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${ok ? "text-foreground" : "text-red-400"}`}>{value}</p>
    </div>
  );
}
