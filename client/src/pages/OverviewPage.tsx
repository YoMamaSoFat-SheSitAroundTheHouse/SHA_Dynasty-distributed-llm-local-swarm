import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Activity, CircleDollarSign, ListTodo, Server, CalendarCheck, MessageSquare, ArrowRight, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const OS_COLORS: Record<string, string> = {
  Android: "bg-green-500/10 text-green-400 border-green-500/20",
  Linux: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Windows: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

export default function OverviewPage() {
  const [, setLocation] = useLocation();
  const { data: nodes, isLoading: nodesLoading } = trpc.nodes.list.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.tasks.list.useQuery();
  const { data: costs } = trpc.costs.summary.useQuery();
  const { data: audits } = trpc.audits.list.useQuery();
  const { data: conversations } = trpc.chat.listConversations.useQuery();

  const onlineNodes = nodes?.filter((n) => n.isOnline).length ?? 0;
  const totalNodes = nodes?.length ?? 5;
  const pendingTasks = tasks?.filter((t) => t.status === "pending").length ?? 0;
  const runningTasks = tasks?.filter((t) => t.status === "running").length ?? 0;
  const totalCost = costs?.cumulative?.reduce((sum: number, c: any) => sum + (c.totalCost ?? 0), 0) ?? 0;
  const upcomingAudits = audits?.filter((a) => !a.completedAt && new Date(a.scheduledAt) > new Date()).length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">SHA-Dynasty Orchestrator Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-dot online" />
          <span className="text-xs text-muted-foreground">System operational</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Server className="h-4 w-4" />}
          label="Nodes Online"
          value={nodesLoading ? null : `${onlineNodes} / ${totalNodes}`}
          sub={`${totalNodes - onlineNodes} offline`}
          accent={onlineNodes === totalNodes ? "green" : onlineNodes > 0 ? "yellow" : "red"}
          onClick={() => setLocation("/nodes")}
        />
        <SummaryCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Active Tasks"
          value={tasksLoading ? null : `${runningTasks} running`}
          sub={`${pendingTasks} pending`}
          accent="blue"
          onClick={() => setLocation("/tasks")}
        />
        <SummaryCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Total API Spend"
          value={`$${totalCost.toFixed(4)}`}
          sub="cumulative"
          accent="teal"
          onClick={() => setLocation("/costs")}
        />
        <SummaryCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Upcoming Audits"
          value={`${upcomingAudits}`}
          sub="scheduled"
          accent="purple"
          onClick={() => setLocation("/audits")}
        />
      </div>

      {/* Node status strip */}
      <Card className="glow-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Node Fleet
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation("/nodes")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {nodesLoading ? (
            <div className="flex gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 flex-1 rounded-lg" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {(nodes ?? []).map((node) => (
                <div
                  key={node.nodeName}
                  className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-3 py-2.5 border border-border/50 flex-1 min-w-[140px]"
                >
                  <span className={`status-dot ${node.isOnline ? "online" : "offline"}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate font-mono">{node.nodeName}</p>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mt-0.5 ${OS_COLORS[node.os] ?? ""}`}>
                      {node.os}
                    </Badge>
                  </div>
                  {node.isOnline ? (
                    <Wifi className="h-3 w-3 text-green-400 ml-auto shrink-0" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent conversations + recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent chats */}
        <Card className="glow-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent Conversations
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation("/chat")}>
              Open chat <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {!conversations || conversations.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">No conversations yet.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setLocation("/chat")}>
                  Start a conversation
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversations.slice(0, 5).map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setLocation(`/chat/${conv.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{conv.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent tasks */}
        <Card className="glow-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              Recent Tasks
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setLocation("/tasks")}>
              View queue <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
              </div>
            ) : !tasks || tasks.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">No tasks submitted yet.</p>
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setLocation("/tasks")}>
                  Route a task
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30">
                    <StatusBadge status={task.status} />
                    <span className="text-xs truncate flex-1">{task.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">{task.model}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, accent, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub: string;
  accent: "green" | "yellow" | "red" | "blue" | "teal" | "purple";
  onClick: () => void;
}) {
  const accentMap = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    blue: "text-blue-400",
    teal: "text-primary",
    purple: "text-purple-400",
  };
  return (
    <Card
      className="glow-card cursor-pointer hover:bg-secondary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 mb-2 ${accentMap[accent]}`}>
          {icon}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "pending", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    running: { label: "running", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    completed: { label: "done", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    failed: { label: "failed", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  };
  const s = map[status] ?? { label: status, cls: "" };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${s.cls}`}>
      {s.label}
    </Badge>
  );
}
