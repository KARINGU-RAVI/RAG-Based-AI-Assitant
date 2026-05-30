import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { User, Document, Conversation, Message, SystemLog, Analytics, SourceCitation } from '../types';

// Create central Axios instance
export const apiClient = axios.create({
  baseURL: '', // Relative baseURL proxy redirection configured in vite.config.ts
});

// Request Interceptor: Automatically inject Bearer JWT credentials to outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API endpoint providers
export const authApi = {
  register: async (username: string, email: string, password: string): Promise<User> => {
    const res = await apiClient.post('/api/v1/auth/register', { username, email, password });
    return res.data;
  },
  login: async (username: string, password: string) => {
    // Standard OAuth2 form request structure
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const res = await apiClient.post('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data; // Returns { access_token, role, username }
  },
  me: async (): Promise<User> => {
    const res = await apiClient.get('/api/v1/auth/me');
    return res.data;
  }
};

export const documentsApi = {
  list: async (): Promise<Document[]> => {
    const res = await apiClient.get('/api/v1/documents/');
    return res.data;
  },
  upload: async (file: File, onUploadProgress?: (progressEvent: any) => void): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/api/v1/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress
    });
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/documents/${id}`);
  }
};

export const chatApi = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await apiClient.get('/api/v1/chat/conversations');
    return res.data;
  },
  getMessages: async (sessionId: string): Promise<Message[]> => {
    const res = await apiClient.get(`/api/v1/chat/conversations/${sessionId}/messages`);
    return res.data;
  },
  submitFeedback: async (messageId: string, rating: number, text?: string): Promise<void> => {
    await apiClient.post(`/api/v1/chat/messages/${messageId}/feedback`, { rating, text });
  }
};

export const adminApi = {
  getLogs: async (limit = 100, offset = 0): Promise<SystemLog[]> => {
    const res = await apiClient.get(`/api/v1/admin/logs?limit=${limit}&offset=${offset}`);
    return res.data;
  },
  getAnalytics: async (): Promise<Analytics> => {
    const res = await apiClient.get('/api/v1/admin/analytics');
    return res.data;
  }
};

export const systemApi = {
  getHealth: async (): Promise<{ status: string }> => {
    const res = await apiClient.get('/api/health');
    return res.data;
  }
};

/**
 * Custom SSE reader that executes a post-body search request and parses chunk bytes
 * using a ReadableStream, enabling real-time JWT authenticated token streams.
 */
export async function streamChat(
  sessionId: string,
  message: string,
  onChunk: (token: string) => void,
  onDone: (payload: { reply: string; sources: SourceCitation[]; similarityScores: number[]; tokensUsed: number }) => void,
  onError: (errorMsg: string) => void
) {
  const token = useAuthStore.getState().token;
  
  try {
    const response = await fetch('/api/v1/chat/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId, message })
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Failed to initialize chat stream.');
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body stream is unreadable.');
    }
    
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save incomplete trailing line back to buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.startsWith('data: ')) {
          const rawData = cleanLine.substring(6);
          
          try {
            const parsed = JSON.parse(rawData);
            
            if (parsed.error) {
              onError(parsed.error);
              return;
            }
            
            if (parsed.done === true) {
              onDone(parsed);
            } else if (parsed.token) {
              onChunk(parsed.token);
            }
          } catch (jsonErr) {
            // Safe fallback for parsing fragments
            continue;
          }
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'Connection lost.');
  }
}
