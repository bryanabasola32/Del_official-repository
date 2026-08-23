'use client';

import { createContext, useContext, useMemo } from 'react';
import { useConversations } from '@/hooks/useConversations';
import type { Conversation } from '@/hooks/useConversations';
import type { ConversationMessage } from '@/components/intelligence';

interface ConversationContextValue {
  conversations: Conversation[];
  loading: boolean;
  activeConversationId: string | null;
  messages: ConversationMessage[];
  messagesLoading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ConversationMessage[]>>;
  selectConversation: (id: string | null) => Promise<void>;
  createConversation: (title?: string) => Promise<string | null>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (conversationId: string, message: ConversationMessage) => Promise<void>;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ConversationMessage>) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  searchConversations: (query: string) => void;
  refreshConversations: (search?: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const conv = useConversations();

  const value = useMemo<ConversationContextValue>(() => ({
    conversations: conv.conversations,
    loading: conv.loading,
    activeConversationId: conv.activeConversationId,
    messages: conv.messages,
    messagesLoading: conv.messagesLoading,
    setMessages: conv.setMessages,
    selectConversation: conv.selectConversation,
    createConversation: conv.createConversation,
    renameConversation: conv.renameConversation,
    deleteConversation: conv.deleteConversation,
    addMessage: conv.addMessage,
    updateMessage: conv.updateMessage,
    updateConversationTitle: conv.updateConversationTitle,
    searchConversations: conv.searchConversations,
    refreshConversations: conv.refreshConversations,
  }), [conv]);

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversationContext() {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error('useConversationContext must be used within ConversationProvider');
  }
  return ctx;
}
