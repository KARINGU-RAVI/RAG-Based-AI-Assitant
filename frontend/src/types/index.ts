export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface SourceCitation {
  document_name: string;
  chunk_index: number;
  content: string;
  similarity_score: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  sources_json?: string | null;  // Serialized SourceCitation[]
  feedback_rating?: number | null;
  feedback_text?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SystemLog {
  id: number;
  level: string;
  module: string;
  message: string;
  details_json?: string | null;
  created_at: string;
}

export interface Analytics {
  total_users: number;
  total_documents: number;
  total_conversations: number;
  total_messages: number;
  average_similarity_score: number;
  total_tokens_used: number;
}
