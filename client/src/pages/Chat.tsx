import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Square,
  Trash2,
  X,
  Loader,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";
import { useChatStore } from "@/context/ChatStore";

// Custom animation delays for typing indicator
const styles = `
  @keyframes bounce-delayed {
    0%, 80%, 100% { opacity: 1; transform: translateY(0); }
    40% { opacity: 0.5; transform: translateY(-8px); }
  }
  .animate-bounce { animation: bounce-delayed 1.4s infinite; }
  .delay-100 { animation-delay: 0.2s; }
  .delay-200 { animation-delay: 0.4s; }
`;

type Conversation = {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    role: string;
  } | null;
};

type ChatMessage = {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
};

const PAGE_SIZE = 30;
const isMongoId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const fetchJSON = async (input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; message?: string };
      message = parsed.error || parsed.message || raw;
    } catch {
      // ignore JSON parse failures and keep raw text
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json();
};

export default function Chat() {
  // Persistent state from global store
  const {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId,
    messages,
    setMessages,
  } = useChatStore();

  // Local UI state (not persisted)
  const [input, setInput] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | undefined>>({});
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);

  // Inject custom styles
  useEffect(() => {
    const styleId = "chat-page-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.querySelector('[data-chat-container]');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      // Clamp width between 200px and 600px
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.userSelect = "auto";
        document.body.style.cursor = "auto";
      }
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove, { passive: false });
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("mouseleave", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [isResizing]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load conversations based on search
  const loadConversations = async (query?: string) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const data = await fetchJSON(`/api/chat/list?${params.toString()}`);
      setConversations(data.conversations ?? []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const data = await fetchJSON(`/api/chat/${conversationId}?limit=${PAGE_SIZE}`);
      setMessages(data.messages ?? []);
      setHasMore((data.messages ?? []).length >= PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages([]);
      setHasMore(false);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load active conversation on mount if it exists
  useEffect(() => {
    if (activeConversationId && !isMongoId(activeConversationId)) {
      setActiveConversationId(null);
      setMessages([]);
      return;
    }

    if (activeConversationId && messages.length === 0) {
      loadMessages(activeConversationId).catch(console.error);
    }
  }, [activeConversationId, messages.length, setActiveConversationId, setMessages]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    loadConversations(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const handleSelectConversation = async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setDrawerOpen(false);
    await loadMessages(conversationId);
  };

  const handleNewChat = async () => {
    try {
      const data = await fetchJSON("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({ createOnly: true }),
      });
      setActiveConversationId(data.conversationId);
      setMessages([]);
      setHasMore(false);
      setDrawerOpen(false);
      await loadConversations(debouncedSearch);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      console.error("Failed to create a new chat:", error);
    }
  };

  const handleRename = async (conversationId: string) => {
    const title = editingTitle.trim();
    if (!title) return;

    try {
      await fetchJSON(`/api/chat/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });

      setConversations((prev) =>
        prev.map((item) =>
          item._id === conversationId ? { ...item, title } : item
        )
      );
      setEditingId(null);
      setEditingTitle("");
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetchJSON(`/api/chat/${deleteTarget._id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((item) => item._id !== deleteTarget._id));
      if (activeConversationId === deleteTarget._id) {
        await handleNewChat();
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const appendStreamingContent = (messageId: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageId ? { ...msg, content: msg.content + chunk } : msg
      )
    );
  };

  const copyText = async (value: string, token: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedToken(token);
      window.setTimeout(() => {
        setCopiedToken((current) => (current === token ? null : current));
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const sendMessage = async (content: string, options?: { regenerate?: boolean }) => {
    if (!content.trim() || isStreaming) return;

    const validConversationId =
      activeConversationId && isMongoId(activeConversationId) ? activeConversationId : undefined;

    if (activeConversationId && !validConversationId) {
      setActiveConversationId(null);
    }

    const trimmed = content.trim();
    const assistantId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    // Create both messages at once to use in a single state update
    const userMessage: ChatMessage = {
      _id: userId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      _id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    // ✅ SINGLE atomic state update - never overwrites previous messages
    setMessages((prev) => [
      ...prev,
      ...(options?.regenerate ? [] : [userMessage]), // Add user message unless regenerating
      assistantMessage, // Always add assistant message
    ]);

    setIsStreaming(true);

    try {
      const data = await fetchJSON("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({
          conversationId: validConversationId,
          message: trimmed,
        }),
      });

      const conversationId = data?.conversationId as string | undefined;
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId);
      }

      const reply = typeof data?.reply === "string" ? data.reply : "";
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantId
            ? { ...msg, content: reply || "No response received.", isStreaming: false }
            : msg
        )
      );

      await loadConversations(debouncedSearch);
    } catch (error) {
      let errorMessage = "Generation stopped. Please try again.";
      if (error instanceof Error) {
        // Show actual error message if available
        errorMessage = error.message || errorMessage;
        if (error.message.toLowerCase().includes("failed to fetch")) {
          errorMessage = "Cannot reach chat backend. Start the backend server and try again.";
        }
        // Handle rate limit errors specifically
        if (error.message.includes("429") || error.message.includes("rate")) {
          errorMessage = "API rate limit reached. Please wait a moment and try again.";
        }
      }
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantId
            ? { ...msg, content: errorMessage }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage(input);
    setInput("");
  };

  const handleRegenerate = async () => {
    if (!activeConversationId || !isMongoId(activeConversationId) || isStreaming) {
      if (activeConversationId && !isMongoId(activeConversationId)) {
        setActiveConversationId(null);
      }
      return;
    }
    const lastAssistant = [...messages].reverse().find((msg) => msg.role === "assistant");
    if (!lastAssistant) return;
    await handleRegenerateMessage(lastAssistant._id);
  };

  const handleRegenerateMessage = async (assistantMessageId: string) => {
    if (!activeConversationId || !isMongoId(activeConversationId) || isStreaming) {
      if (activeConversationId && !isMongoId(activeConversationId)) {
        setActiveConversationId(null);
      }
      return;
    }

    const lastAssistant = [...messages].reverse().find((msg) => msg.role === "assistant");
    if (!lastAssistant || lastAssistant._id !== assistantMessageId) {
      return;
    }

    const lastUser = [...messages].reverse().find((msg) => msg.role === "user");
    if (!lastUser) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setRegeneratingMessageId(assistantMessageId);

    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === assistantMessageId ? { ...msg, content: "", isStreaming: true } : msg
      )
    );

    try {
      const data = await fetchJSON("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: lastUser.content,
        }),
      });

      const conversationId = data?.conversationId as string | undefined;
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversationId(conversationId);
      }

      const reply = typeof data?.reply === "string" ? data.reply : "";
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantMessageId
            ? { ...msg, content: reply || "No response received.", isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const fallback = "Regeneration failed. Please try again.";
      const errorMessage = error instanceof Error ? error.message || fallback : fallback;

      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantMessageId ? { ...msg, content: errorMessage, isStreaming: false } : msg
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === assistantMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      await loadConversations(debouncedSearch);
      setIsStreaming(false);
      setRegeneratingMessageId(null);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleLoadMore = async () => {
    if (!activeConversationId || isLoadingMore || !hasMore || messages.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const oldest = messages[0]?.createdAt;
      if (!oldest) return;
      const data = await fetchJSON(
        `/api/chat/${activeConversationId}?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`
      );
      const olderMessages = data.messages ?? [];
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(olderMessages.length >= PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!listRef.current || messages.length === 0 || isLoadingMore) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, isLoadingMore]);

  const handleScroll = () => {
    if (!listRef.current) return;
    if (listRef.current.scrollTop < 80) {
      handleLoadMore();
    }
  };

  const filteredConversations = useMemo(() => conversations, [conversations]);
  const lastAssistantId = useMemo(() => {
    return [...messages].reverse().find((msg) => msg.role === "assistant")?._id ?? null;
  }, [messages]);

  const activeTitle = useMemo(() => {
    return filteredConversations.find((item) => item._id === activeConversationId)?.title;
  }, [filteredConversations, activeConversationId]);

  return (
    <Layout>
      <div className="h-full min-h-0 flex flex-col rounded-2xl bg-background overflow-hidden border border-border/50 shadow-sm md:flex-row" data-chat-container>
        {/* Collapsible Chat Sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border/50 bg-muted/30 relative",
            !isResizing && "transition-all duration-300 ease-out"
          )}
          style={{ width: sidebarCollapsed ? 80 : `${sidebarWidth}px`, flexShrink: 0 }}
        >
          {/* Sidebar Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-border/50 flex items-center justify-between gap-2">
            {!sidebarCollapsed && <h2 className="font-semibold text-foreground">Conversations</h2>}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto p-2 hover:bg-background rounded-lg transition-colors"
              title={sidebarCollapsed ? "Expand" : "Collapse"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Search & New Chat */}
          {!sidebarCollapsed && (
            <div className="flex-shrink-0 px-6 py-4 border-b border-border/50 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-xl border border-border bg-background px-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <Button 
                onClick={handleNewChat} 
                className="w-full rounded-xl" 
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          )}

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            <div className={cn(
              "space-y-2 p-3",
              sidebarCollapsed && "space-y-3 px-2"
            )}>
              {loadingList ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  Loading...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  No conversations
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation._id === activeConversationId;
                  return (
                    <div
                      key={conversation._id}
                      className="group relative"
                      title={sidebarCollapsed ? conversation.title : undefined}
                    >
                      {/* Collapsed view - icon only */}
                      {sidebarCollapsed ? (
                        <button
                          onClick={() => handleSelectConversation(conversation._id)}
                          className={cn(
                            "w-full p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center",
                            isActive
                              ? "bg-purple-500/20 hover:bg-purple-500/30"
                              : "hover:bg-background"
                          )}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      ) : (
                        // Expanded view - full content
                        <button
                          onClick={() => handleSelectConversation(conversation._id)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg transition-all duration-200",
                            isActive
                              ? "bg-purple-500/10 hover:bg-purple-500/20"
                              : "hover:bg-background"
                          )}
                        >
                          <div className="font-medium text-sm line-clamp-1 text-foreground mb-1">
                            {conversation.title || "New Chat"}
                          </div>
                          {conversation.lastMessage && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {conversation.lastMessage.content}
                            </div>
                          )}
                        </button>
                      )}

                      {/* Edit & Delete buttons (expanded only, show on hover) */}
                      {!sidebarCollapsed && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingId(conversation._id);
                              setEditingTitle(conversation.title);
                            }}
                            className="p-1.5 rounded-md hover:bg-background transition-colors"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(conversation)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-600" />
                          </button>
                        </div>
                      )}

                      {/* Rename input */}
                      {editingId === conversation._id && !sidebarCollapsed && (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => handleRename(conversation._id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleRename(conversation._id);
                            }
                          }}
                          className="absolute inset-0 rounded-lg border-2 border-primary px-3 py-2 text-sm focus:outline-none z-10 bg-background"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Resize Handle */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="hidden md:block w-1 bg-border/30 hover:bg-primary/60 cursor-col-resize transition-colors hover:shadow-md hover:w-1.5"
            title="Drag to resize sidebar"
            style={{
              userSelect: "none",
              touchAction: "none",
            }}
          />
        )}

        {/* Collapsible Sidebar Toggle (Mobile) */}
        <div className="md:hidden absolute top-16 left-4 z-40">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 rounded-xl hover:bg-muted transition-colors bg-background border border-border/50"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Drawer */}
        {drawerOpen && (
          <>
            <div 
              className="fixed inset-0 z-30 bg-black/40 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-40 w-72 bg-background border-r border-border/50 flex flex-col md:hidden animated-in slide-in-from-left-72 duration-300">
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <h2 className="font-semibold">Conversations</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 border-b border-border/50 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search chats..."
                    className="w-full rounded-xl border border-border bg-muted/50 px-9 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <Button onClick={handleNewChat} className="w-full rounded-xl" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Chat
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2 p-3">
                  {filteredConversations.map((conversation) => (
                    <button
                      key={conversation._id}
                      onClick={() => {
                        handleSelectConversation(conversation._id);
                        setDrawerOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all",
                        conversation._id === activeConversationId
                          ? "bg-purple-500/10 hover:bg-purple-500/20"
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="font-medium text-sm line-clamp-1">
                        {conversation.title || "New Chat"}
                      </div>
                      {conversation.lastMessage && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {conversation.lastMessage.content}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-background to-muted/30">
          {/* Chat Header */}
          <div className="flex-shrink-0 border-b border-border/50 px-6 py-4 h-14 flex items-center justify-between gap-4 bg-background">
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-foreground truncate">
                {activeTitle || "New Chat"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {!activeConversationId ? "Start a new conversation" : "Ask anything..."}
              </p>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRegenerate} 
                disabled={!activeConversationId || isStreaming}
                className="rounded-lg"
                title="Regenerate last response"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Regenerate</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleNewChat}
                className="rounded-lg"
                title="Start new conversation"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth pb-32 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60"
          >
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h2 className="font-semibold text-foreground mb-2">No messages yet</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Start a conversation by typing a message below
                </p>
              </div>
            ) : (
              <div className="flex w-full min-w-0 flex-col gap-6 px-6 py-8">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div key={message._id} className="animate-in fade-in duration-300 w-full">
                      {isUser ? (
                        <div className="flex w-full min-w-0 justify-end">
                          <div className="w-fit max-w-[60%] overflow-hidden px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white text-base font-medium">
                            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full min-w-0 border-t border-gray-200 pt-6 text-lg leading-relaxed text-gray-800 dark:text-gray-200 space-y-4">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeHighlight, rehypeKatex]}
                            components={{
                              h1: ({ node, ...props }) => <h1 className="text-xl font-semibold mt-6 mb-3" {...props} />,
                              h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-6 mb-3" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mt-5 mb-2" {...props} />,
                              p: ({ node, ...props }) => <p className="text-lg leading-relaxed mb-4 last:mb-0" {...props} />,
                              ul: ({ node, ...props }) => <ul className="list-disc list-outside pl-6 mb-4 space-y-2" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal list-outside pl-6 mb-4 space-y-2" {...props} />,
                              blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-600 dark:text-gray-300 my-4" {...props} />
                              ),
                              table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full border-collapse border border-gray-300" {...props} />
                                </div>
                              ),
                              th: ({ node, ...props }) => <th className="border border-gray-300 px-3 py-2 bg-gray-50 text-left" {...props} />,
                              td: ({ node, ...props }) => <td className="border border-gray-300 px-3 py-2" {...props} />,
                              tr: ({ node, ...props }) => <tr className="odd:bg-white even:bg-gray-50/60" {...props} />,
                              code: ({ inline, className, children, ...props }: any) => {
                                const rawCode = Array.isArray(children)
                                  ? children.map((child) => (typeof child === "string" ? child : "")).join("")
                                  : String(children ?? "");

                                if (inline) {
                                  return (
                                    <code className="bg-gray-200 px-1.5 py-0.5 rounded text-sm font-mono text-gray-900" {...props}>
                                      {children}
                                    </code>
                                  );
                                }

                                return (
                                  <div className="relative group mb-4">
                                    <button
                                      onClick={() => copyText(rawCode, `code-${message._id}-${rawCode.length}`)}
                                      className="absolute top-2 right-2 text-xs bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
                                    >
                                      {copiedToken === `code-${message._id}-${rawCode.length}` ? "Copied" : "Copy"}
                                    </button>
                                    <pre className="bg-[#0f172a] text-white rounded-xl px-5 py-4 text-sm overflow-x-auto border border-gray-700 shadow-sm">
                                      <code className={className} {...props}>{children}</code>
                                    </pre>
                                  </div>
                                );
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>

                          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                            <button
                              onClick={() =>
                                setReactions((prev) => ({
                                  ...prev,
                                  [message._id]: prev[message._id] === "like" ? undefined : "like",
                                }))
                              }
                              className={cn(
                                "cursor-pointer transition-colors hover:text-black dark:hover:text-white",
                                reactions[message._id] === "like" && "text-black dark:text-white"
                              )}
                            >
                              Like
                            </button>
                            <button
                              onClick={() =>
                                setReactions((prev) => ({
                                  ...prev,
                                  [message._id]: prev[message._id] === "dislike" ? undefined : "dislike",
                                }))
                              }
                              className={cn(
                                "cursor-pointer transition-colors hover:text-black dark:hover:text-white",
                                reactions[message._id] === "dislike" && "text-black dark:text-white"
                              )}
                            >
                              Dislike
                            </button>
                            <button
                              onClick={() => handleRegenerateMessage(message._id)}
                              disabled={isStreaming || lastAssistantId !== message._id}
                              className="cursor-pointer transition-colors hover:text-black dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={() => copyText(message.content, `answer-${message._id}`)}
                              className="cursor-pointer transition-colors hover:text-black dark:hover:text-white"
                            >
                              Copy full answer
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isStreaming && (
                  <div className="animate-in fade-in duration-300 flex w-full justify-start">
                    <div className="w-full text-base leading-relaxed text-gray-800 dark:text-gray-200">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce delay-100" />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce delay-200" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">AI is thinking...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area - Sticky Bottom */}
          <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-border/50 bg-white px-6 py-4 dark:bg-background">
            <form onSubmit={handleSubmit} className="flex w-full min-w-0 items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onInput={(event) => {
                  const target = event.currentTarget;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(input);
                    setInput("");
                  }
                }}
                placeholder="Ask anything... (Shift + Enter for new line)"
                className="min-w-0 flex-1 resize-none rounded-2xl border border-border/50 bg-muted/50 px-5 py-4 text-base shadow-sm placeholder:opacity-70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
                rows={1}
              />
              {isStreaming ? (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleStop}
                  className="shrink-0 rounded-2xl"
                  size="lg"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={!input.trim()}
                  className="shrink-0 rounded-2xl gap-2"
                  size="lg"
                >
                  {isStreaming ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.title}" and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
