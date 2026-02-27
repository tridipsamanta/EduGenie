import React, { createContext, useContext, useCallback, useEffect, Dispatch, SetStateAction } from "react";

export type ChatMessage = {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
};

export type Conversation = {
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

interface ChatStoreContextType {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  conversations: Conversation[];
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  clearChatStore: () => void;
}

const ChatStoreContext = createContext<ChatStoreContextType | undefined>(undefined);

export function ChatStoreProvider({ children }: { children: React.ReactNode }) {
  const [activeConversationId, setActiveConversationIdState] = React.useState<string | null>(null);
  const [messages, setMessagesState] = React.useState<ChatMessage[]>([]);
  const [conversations, setConversationsState] = React.useState<Conversation[]>([]);

  // Initialize from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("activeConversationId");
    if (saved && saved !== "null") {
      setActiveConversationIdState(saved);
    }
  }, []);

  // Persist activeConversationId to localStorage
  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdState(id);
    if (id) {
      localStorage.setItem("activeConversationId", id);
    } else {
      localStorage.removeItem("activeConversationId");
    }
  }, []);

  // Clear all chat state (called on logout)
  const clearChatStore = useCallback(() => {
    setActiveConversationIdState(null);
    setMessagesState([]);
    setConversationsState([]);
    localStorage.removeItem("activeConversationId");
  }, []);

  const value: ChatStoreContextType = {
    activeConversationId,
    setActiveConversationId,
    messages,
    setMessages: setMessagesState,
    conversations,
    setConversations: setConversationsState,
    clearChatStore,
  };

  return (
    <ChatStoreContext.Provider value={value}>
      {children}
    </ChatStoreContext.Provider>
  );
}

export function useChatStore() {
  const context = useContext(ChatStoreContext);
  if (!context) {
    throw new Error("useChatStore must be used within ChatStoreProvider");
  }
  return context;
}
