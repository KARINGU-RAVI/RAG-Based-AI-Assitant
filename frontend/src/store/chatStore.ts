import { create } from 'zustand';
import { Conversation, Message, SourceCitation } from '../types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingReply: string;
  selectedSource: SourceCitation | null;
  
  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStreaming: (isStreaming: boolean) => void;
  appendStreamingReply: (token: string) => void;
  clearStreamingReply: () => void;
  setSelectedSource: (source: SourceCitation | null) => void;
  updateMessageFeedback: (messageId: string, rating: number, text?: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingReply: '',
  selectedSource: null,
  
  setConversations: (conversations) => set({ conversations }),
  
  setActiveConversationId: (activeConversationId) => set({ 
    activeConversationId,
    messages: [], // Clear cached messages when switching conversations
    streamingReply: '',
    isStreaming: false,
    selectedSource: null
  }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  
  setStreaming: (isStreaming) => set({ isStreaming }),
  
  appendStreamingReply: (token) => set((state) => ({ 
    streamingReply: state.streamingReply + token 
  })),
  
  clearStreamingReply: () => set({ streamingReply: '' }),
  
  setSelectedSource: (selectedSource) => set({ selectedSource }),
  
  updateMessageFeedback: (messageId, rating, text = null) => set((state) => ({
    messages: state.messages.map((msg) => 
      msg.id === messageId 
        ? { ...msg, feedback_rating: rating, feedback_text: text } 
        : msg
    )
  }))
}));
