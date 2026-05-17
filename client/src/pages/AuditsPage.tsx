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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  CalendarCheck,
  Plus,
  CheckCircle2,
  Clock,
  Repeat,
  Trash2,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  scheduledAt: z.string().min(1, "Date is required"),
  isRecurring: z.boolean().default(false),
  recurringDays: z.number().optional(),
  checklistRaw: z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;

// Default audit templates
const AUDIT_TEMPLATES = [
  {
    title: "GitHub Token Rotation",
    description: "Review and rotate all GitHub personal access tokens. Check for exposed credentials in repos.",
    checklist: ["Review active tokens at github.com/settings/tokens", "Revoke any tokens older than 90 days", "Check repos for accidentally committed secrets", "Update .gitignore and pre-commit hooks"],
    recurringDays: 90,
  },
  {
    title: "SSH Key Audit",
    description: "Review SSH keys across all nodes. Remove unused keys, rotate active ones.",
    checklist: ["List all authorized_keys on each node", "Remove keys for decommissioned devices", "Rotate keys older than 180 days", "Verify key permissions (chmod 600)"],
    recurringDays: 180,
  },
  {
    title: "Tailscale ACL Review",
    description: "Review Tailscale access control lists and connected devices.",
    checklist: ["Review tailscale.com/admin/acls", "Remove stale devices from the tailnet", "Verify ACL rules are least-privilege", "Check for unexpected devices"],
    recurringDays: 30,
  },
  {
    title: "API Key Rotation",
    description: "Rotate API keys for all cloud LLM providers.",
    checklist: ["Rotate Deepseek API key", "Rotate Anthropic (Claude) API key", "Update .env files on all nodes", "Verify services restart cleanly"],
    recurringDays: 60,
  },
];

function getDueBadge(scheduledAt: Date, completedAt: Date | null) {
  if (completedAt) return { label: "Completed", cls: "bg-green-500/10 text-green-400 border-green-500/20" };
  if (isPast(scheduledAt)) return { label: "Overdue", cls: "bg-red-500/10 text-red-400 border-red-500/20" };
  if (isToday(scheduledAt)) return { label: "Due today", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
  if (isTomorrow(scheduledAt)) return { label: "Due tomorrow", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
  return { label: format(scheduledAt, "MMM d"), cls: "bg-secondary text-muted-foreground border-border" };
}

export default function AuditsPage() {
  const [open, setOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: audits, isLoading } = trpc.audits.list.useQuery();

  const createAudit = trpc.audits.create.useMutation({
    onSuccess: () => { utils.audits.list.invalidate(); toast.success("Audit scheduled"); setOpen(false); form.reset(); },
    onError: (err) => toast.error(err.message),
  });

  const completeAudit = trpc.audits.complete.useMutation({
    onSuccess: () => { utils.audits.list.invalidate(); toast.success("Audit marked complete"); },
  });

  const updateChecklist = trpc.audits.updateChecklist.useMutation({
    onSuccess: () => utils.audits.list.invalidate(),
  });

  const deleteAudit = trpc.audits.delete.useMutation({
    onSuccess: () => { utils.audits.list.invalidate(); setSelectedAudit(null); toast.success("Audit deleted"); },
  });

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: { title: "", description: "", scheduledAt: "", isRecurring: false, checklistRaw: "" },
  });

  const onSubmit = (values: FormValues) => {
    const checklist = values.checklistRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    createAudit.mutate({
      title: values.title,
      description: values.description,
      scheduledAt: new Date(values.scheduledAt).getTime(),
      isRecurring: values.isRecurring,
      recurringDays: values.recurringDays,
      checklist,
    });
  };

  const applyTemplate = (t: typeof AUDIT_TEMPLATES[0]) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (t.recurringDays ?? 30));
    form.setValue("title", t.title);
    form.setValue("description", t.description);
    form.setValue("checklistRaw", t.checklist.join("\n"));
    form.setValue("isRecurring", true);
    form.setValue("recurringDays", t.recurringDays);
    form.setValue("scheduledAt", nextDate.toISOString().slice(0, 16));
  };

  const upcoming = audits?.filter((a) => !a.completedAt) ?? [];
  const completed = audits?.filter((a) => a.completedAt) ?? [];
  const overdue = upcoming.filter((a) => isPast(new Date(a.scheduledAt)));

  const selectedAuditData = audits?.find((a) => a.id === selectedAudit);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Security Audits
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scheduled security checks and recurring maintenance tasks
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overdue.length > 0 && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdue.length} overdue
            </div>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Schedule audit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base">Schedule Security Audit</DialogTitle>
              </DialogHeader>
              {/* Templates */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Quick templates</p>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIT_TEMPLATES.map((t) => (
                    <button
                      key={t.title}
                      onClick={() => applyTemplate(t)}
                      className="text-left px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-colors"
                    >
                      <p className="text-xs font-medium">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Every {t.recurringDays}d</p>
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Title</FormLabel>
                      <FormControl><Input {...field} className="bg-secondary border-border text-sm" /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Scheduled date</FormLabel>
                      <FormControl><Input type="datetime-local" {...field} className="bg-secondary border-border text-sm" /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Description</FormLabel>
                      <FormControl><Textarea {...field} rows={2} className="bg-secondary border-border text-sm resize-none" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="checklistRaw" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Checklist items (one per line)</FormLabel>
                      <FormControl><Textarea {...field} rows={4} placeholder="Check SSH keys&#10;Rotate API tokens&#10;Review ACLs" className="bg-secondary border-border text-sm resize-none font-mono text-xs" /></FormControl>
                    </FormItem>
                  )} />
                  <div className="flex items-center gap-3">
                    <FormField control={form.control} name="isRecurring" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-xs cursor-pointer">Recurring</FormLabel>
                      </FormItem>
                    )} />
                    {form.watch("isRecurring") && (
                      <FormField control={form.control} name="recurringDays" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="30"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              className="w-20 h-7 text-xs bg-secondary border-border"
                            />
                          </FormControl>
                          <FormLabel className="text-xs">days</FormLabel>
                        </FormItem>
                      )} />
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={createAudit.isPending}>
                      {createAudit.isPending ? "Scheduling…" : "Schedule"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Upcoming</h2>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{upcoming.length}</Badge>
          </div>
          {isLoading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />)
          ) : upcoming.length === 0 ? (
            <Card className="glow-card">
              <CardContent className="p-6 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No upcoming audits scheduled.</p>
              </CardContent>
            </Card>
          ) : (
            upcoming.map((audit) => {
              const due = getDueBadge(new Date(audit.scheduledAt), audit.completedAt ? new Date(audit.completedAt) : null);
              const checklist = (audit.checklist as string[] | null) ?? [];
              const completedItems = (audit.completedItems as string[] | null) ?? [];
              const progress = checklist.length > 0 ? (completedItems.length / checklist.length) * 100 : 0;
              return (
                <Card
                  key={audit.id}
                  className={`glow-card cursor-pointer transition-all ${selectedAudit === audit.id ? "border-primary/40" : ""}`}
                  onClick={() => setSelectedAudit(selectedAudit === audit.id ? null : audit.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{audit.title}</p>
                        {audit.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{audit.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${due.cls}`}>{due.label}</Badge>
                        {audit.isRecurring && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary">
                            <Repeat className="h-2.5 w-2.5 mr-1" />
                            {audit.recurringDays}d
                          </Badge>
                        )}
                      </div>
                    </div>
                    {checklist.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground">{completedItems.length}/{checklist.length} items</span>
                          <span className="text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {completed.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-4">
                <h2 className="text-sm font-medium text-muted-foreground">Completed</h2>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{completed.length}</Badge>
              </div>
              {completed.slice(0, 3).map((audit) => (
                <Card key={audit.id} className="opacity-50 glow-card">
                  <CardContent className="p-3 flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{audit.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Completed {audit.completedAt ? formatDistanceToNow(new Date(audit.completedAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <button onClick={() => deleteAudit.mutate({ id: audit.id })} className="p-1 rounded hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedAuditData ? (
            <Card className="glow-card sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{selectedAuditData.title}</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(selectedAuditData.scheduledAt), "PPP p")}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAuditData.description && (
                  <p className="text-xs text-muted-foreground">{selectedAuditData.description}</p>
                )}
                <Separator />
                {/* Checklist */}
                {((selectedAuditData.checklist as string[] | null) ?? []).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Checklist</p>
                    {((selectedAuditData.checklist as string[]) ?? []).map((item) => {
                      const completedItems = (selectedAuditData.completedItems as string[] | null) ?? [];
                      const isChecked = completedItems.includes(item);
                      return (
                        <div key={item} className="flex items-start gap-2.5">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current = [...completedItems];
                              const next = checked
                                ? [...current, item]
                                : current.filter((i) => i !== item);
                              updateChecklist.mutate({ id: selectedAuditData.id, completedItems: next });
                            }}
                            className="mt-0.5"
                          />
                          <span className={`text-xs leading-relaxed ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                            {item}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No checklist items.</p>
                )}
                <Separator />
                <div className="flex gap-2">
                  {!selectedAuditData.completedAt && (
                    <Button
                      size="sm"
                      className="flex-1 gap-2 text-xs"
                      onClick={() => completeAudit.mutate({ id: selectedAuditData.id })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark complete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-xs bg-transparent"
                    onClick={() => deleteAudit.mutate({ id: selectedAuditData.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glow-card">
              <CardContent className="p-6 text-center space-y-2">
                <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">Select an audit to view its checklist</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
