'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import type { ConversationMessage } from '@/components/intelligence';

export interface Conversation {
  id: string;
  title: string;
  executive_id: string | null;
  research_job_id: string | null;
  report_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface PersistedMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function toConversationMessage(msg: PersistedMessage): ConversationMessage {
  const meta = msg.metadata || {};
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.created_at,
    responseCard: meta.responseCard as ConversationMessage['responseCard'],
    thinkingStages: meta.thinkingStages as ConversationMessage['thinkingStages'],
    actions: meta.actions as ConversationMessage['actions'],
    executiveId: meta.executiveId as string | undefined,
    executiveName: meta.executiveName as string | undefined,
    provider: meta.provider as string | undefined,
    model: meta.model as string | undefined,
    isMock: meta.isMock as boolean | undefined,
    citations: meta.citations as ConversationMessage['citations'],
    executionTimeMs: meta.executionTimeMs as number | undefined,
    cacheHit: meta.cacheHit as boolean | undefined,
  };
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const searchRef = useRef('');

  const fetchConversations = useCallback(async (search?: string) => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }
    const { data } = await query;
    setConversations((data || []) as Conversation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const selectConversation = useCallback(async (id: string | null) => {
    setActiveConversationId(id);
    if (!id) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages((data as PersistedMessage[]).map(toConversationMessage));
    }
    setMessagesLoading(false);
  }, []);

  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title: title || 'New Conversation' })
      .select()
      .maybeSingle();
    if (error || !data) return null;
    const conv = data as Conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    return conv.id;
  }, [user]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      );
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);
    if (!error) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    }
  }, [activeConversationId]);

  const addMessage = useCallback(async (
    conversationId: string,
    message: ConversationMessage,
  ): Promise<void> => {
    const metadata: Record<string, unknown> = {};
    if (message.responseCard) metadata.responseCard = message.responseCard;
    if (message.thinkingStages) metadata.thinkingStages = message.thinkingStages;
    if (message.actions) metadata.actions = message.actions;
    if (message.executiveId) metadata.executiveId = message.executiveId;
    if (message.executiveName) metadata.executiveName = message.executiveName;
    if (message.provider) metadata.provider = message.provider;
    if (message.model) metadata.model = message.model;
    if (message.isMock !== undefined) metadata.isMock = message.isMock;
    if (message.citations) metadata.citations = message.citations;
    if (message.executionTimeMs !== undefined) metadata.executionTimeMs = message.executionTimeMs;
    if (message.cacheHit !== undefined) metadata.cacheHit = message.cacheHit;

    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      metadata,
    });

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, []);

  const updateMessage = useCallback(async (
    conversationId: string,
    messageId: string,
    updates: Partial<ConversationMessage>,
  ) => {
    const metadata: Record<string, unknown> = {};
    if (updates.responseCard) metadata.responseCard = updates.responseCard;
    if (updates.thinkingStages) metadata.thinkingStages = updates.thinkingStages;
    if (updates.actions) metadata.actions = updates.actions;
    if (updates.executiveId) metadata.executiveId = updates.executiveId;
    if (updates.executiveName) metadata.executiveName = updates.executiveName;
    if (updates.provider) metadata.provider = updates.provider;
    if (updates.model) metadata.model = updates.model;
    if (updates.isMock !== undefined) metadata.isMock = updates.isMock;
    if (updates.citations) metadata.citations = updates.citations;
    if (updates.executionTimeMs !== undefined) metadata.executionTimeMs = updates.executionTimeMs;
    if (updates.cacheHit !== undefined) metadata.cacheHit = updates.cacheHit;

    await supabase
      .from('chat_messages')
      .update({ content: updates.content || '', metadata })
      .eq('id', messageId);

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, []);

  const updateConversationTitle = useCallback(async (id: string, title: string) => {
    await supabase
      .from('conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const searchConversations = useCallback((query: string) => {
    searchRef.current = query;
    fetchConversations(query);
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    activeConversationId,
    messages,
    messagesLoading,
    setMessages,
    selectConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    addMessage,
    updateMessage,
    updateConversationTitle,
    searchConversations,
    refreshConversations: fetchConversations,
  };
}
