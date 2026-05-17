import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const MODELS = [
  { value: "deepseek-flash", label: "Deepseek Flash" },
  { value: "qwen-ollama", label: "Qwen (via Ollama)" },
  { value: "claude", label: "Claude" },
];

const SESSION_ID_KEY = "chat-session-id";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) { id = nanoid(); sessionStorage.setItem(SESSION_ID_KEY, id); }
  return id;
}

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(
    params.id ? parseInt(params.id) : null
  );
  const [model, setModel] = useState("deepseek-flash");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId] = useState(getSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const { data: conversations, isLoading: convsLoading } = trpc.chat.listConversations.useQuery();
  const { data: messages, isLoading: msgsLoading } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId }
  );

  const createConv = trpc.chat.createConversation.useMutation({
    onSuccess: (conv) => {
      utils.chat.listConversations.invalidate();
      setSelectedConvId(conv.id);
      setLocation(`/chat/${conv.id}`);
    },
  });

  const deleteConv = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
      setSelectedConvId(null);
      setLocation("/chat");
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ conversationId: selectedConvId! });
      utils.chat.listConversations.invalidate();
      utils.costs.summary.invalidate();
      setIsThinking(false);
    },
    onError: (err) => {
      setIsThinking(false);
      toast.error("Failed to send message: " + err.message);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isThinking) return;
    let convId = selectedConvId;
    if (!convId) {
      const conv = await createConv.mutateAsync({ model });
      convId = conv.id;
    }
    const content = input.trim();
    setInput("");
    setIsThinking(true);
    sendMessage.mutate({ conversationId: convId, content, model, sessionId });
  }, [input, isThinking, selectedConvId, model, sessionId, createConv, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setSelectedConvId(null);
    setLocation("/chat");
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Conversation sidebar */}
      <div className="w-60 shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="p-3 border-b border-sidebar-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs bg-transparent border-sidebar-border hover:bg-sidebar-accent"
            onClick={handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            New conversation
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {convsLoading ? (
              <div className="space-y-1 p-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 rounded-md bg-sidebar-accent/50 animate-pulse" />
                ))}
              </div>
            ) : conversations?.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
                No conversations yet. Start one above.
              </p>
            ) : (
              conversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { setSelectedConvId(conv.id); setLocation(`/chat/${conv.id}`); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors group ${
                    selectedConvId === conv.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 text-sidebar-foreground"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-[11px] truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConv.mutate({ id: conv.id }); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedConvId ? (
              <>
                <MessageSquare className="h-4 w-4" />
                <span className="text-foreground font-medium text-sm">
                  {conversations?.find((c) => c.id === selectedConvId)?.title ?? "Conversation"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">New conversation</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Model</span>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 w-44 text-xs bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-6 space-y-6 max-w-3xl mx-auto">
            {!selectedConvId && !msgsLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Start a conversation</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a model above and type your message below.
                  </p>
                </div>
              </div>
            )}

            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold border ${
                    msg.role === "user"
                      ? "bg-primary/15 border-primary/25 text-primary"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  {msg.role === "user" ? "U" : "AI"}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/10 border border-primary/15 text-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Streamdown className="prose prose-invert prose-sm max-w-none">{msg.content}</Streamdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.costUsd && msg.costUsd > 0 ? (
                    <p className="text-[10px] text-muted-foreground mt-2 text-right">
                      ${msg.costUsd.toFixed(6)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-secondary border border-border">
                  <span className="text-[10px] font-semibold text-muted-foreground">AI</span>
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="min-h-[52px] max-h-40 resize-none bg-secondary border-border text-sm pr-4 py-3.5 rounded-xl"
                  rows={1}
                  disabled={isThinking}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                size="icon"
                className="h-[52px] w-[52px] rounded-xl shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {MODELS.find((m) => m.value === model)?.label}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
