import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ListTodo, Play, CheckCircle2, Clock, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { FieldValues } from "react-hook-form";

const MODELS = [
  { value: "deepseek-flash", label: "Deepseek Flash" },
  { value: "qwen-ollama", label: "Qwen (via Ollama)" },
  { value: "claude", label: "Claude" },
];

const NODES = [
  { value: "sha-dynasty", label: "sha-dynasty" },
  { value: "shitbox", label: "shitbox" },
  { value: "shitbox-jr", label: "shitbox-jr" },
  { value: "thetablet", label: "thetablet" },
  { value: "velvet", label: "velvet" },
];

const formSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  description: z.string().default(""),
  model: z.string().min(1, "Select a model"),
  targetNode: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    badgeCls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  running: {
    label: "Running",
    icon: Play,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    badgeCls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    badgeCls: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    badgeCls: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export default function TasksPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();

  const { data: tasks, isLoading } = trpc.tasks.list.useQuery();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Task submitted successfully");
      setShowForm(false);
      form.reset();
    },
    onError: (err) => toast.error("Failed to create task: " + err.message),
  });

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: { name: "", description: "", model: "deepseek-flash", targetNode: undefined },
  });

  const onSubmit = (values: FormValues) => {
    createTask.mutate(values);
  };

  const pending = tasks?.filter((t) => t.status === "pending") ?? [];
  const running = tasks?.filter((t) => t.status === "running") ?? [];
  const completed = tasks?.filter((t) => t.status === "completed" || t.status === "failed") ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Task Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Route tasks manually to specific models and nodes
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New task
        </Button>
      </div>

      {/* Task routing form */}
      {showForm && (
        <Card className="glow-card border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-medium">Route a Task</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Task Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Summarize research notes" className="bg-secondary border-border text-sm" />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Model</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-secondary border-border text-sm">
                                <SelectValue placeholder="Select model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MODELS.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="text-sm">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="targetNode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Target Node</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className="bg-secondary border-border text-sm">
                                <SelectValue placeholder="Any node" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {NODES.map((n) => (
                                <SelectItem key={n.value} value={n.value} className="text-sm font-mono">
                                  {n.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe what this task should do…"
                          className="bg-secondary border-border text-sm resize-none"
                          rows={3}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={createTask.isPending} className="gap-2">
                    <ChevronRight className="h-3.5 w-3.5" />
                    {createTask.isPending ? "Submitting…" : "Submit task"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TaskColumn
          title="Pending"
          tasks={pending}
          config={STATUS_CONFIG.pending}
          isLoading={isLoading}
          onAdvance={(id) => updateStatus.mutate({ id, status: "running" })}
          advanceLabel="Start"
        />
        <TaskColumn
          title="Running"
          tasks={running}
          config={STATUS_CONFIG.running}
          isLoading={isLoading}
          onAdvance={(id) => updateStatus.mutate({ id, status: "completed" })}
          advanceLabel="Complete"
        />
        <TaskColumn
          title="Completed"
          tasks={completed}
          config={STATUS_CONFIG.completed}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  tasks,
  config,
  isLoading,
  onAdvance,
  advanceLabel,
}: {
  title: string;
  tasks: any[];
  config: (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];
  isLoading: boolean;
  onAdvance?: (id: number) => void;
  advanceLabel?: string;
}) {
  const Icon = config.icon;
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{title}</span>
        <Badge variant="outline" className={`ml-auto text-[10px] px-1.5 py-0 ${config.badgeCls}`}>
          {tasks.length}
        </Badge>
      </div>

      <div className="space-y-2 min-h-[120px]">
        {isLoading ? (
          [...Array(2)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
          ))
        ) : tasks.length === 0 ? (
          <div className="h-20 rounded-xl border border-dashed border-border flex items-center justify-center">
            <p className="text-xs text-muted-foreground">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onAdvance={onAdvance} advanceLabel={advanceLabel} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onAdvance, advanceLabel }: { task: any; onAdvance?: (id: number) => void; advanceLabel?: string }) {
  const modelLabel = {
    "deepseek-flash": "Deepseek Flash",
    "qwen-ollama": "Qwen (via Ollama)",
    "claude": "Claude",
  }[task.model as string] ?? task.model;

  const elapsed = task.startedAt
    ? formatDistanceToNow(new Date(task.startedAt), { addSuffix: false })
    : null;

  return (
    <Card className="glow-card">
      <CardContent className="p-3 space-y-2.5">
        <div>
          <p className="text-sm font-medium leading-snug">{task.name}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        <Separator className="bg-border/50" />
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
            {modelLabel}
          </Badge>
          {task.targetNode && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-secondary">
              {task.targetNode}
            </Badge>
          )}
          {elapsed && (
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {elapsed}
            </span>
          )}
        </div>
        {onAdvance && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs bg-transparent"
            onClick={() => onAdvance(task.id)}
          >
            {advanceLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
