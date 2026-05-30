import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Sparkles, MessageSquare, Plus, Trash2, Shield, 
  FileText, UploadCloud, Send, LogOut, Sun, Moon, 
  Activity, Star, ExternalLink, HelpCircle, CornerDownLeft 
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { chatApi, documentsApi, systemApi, streamChat } from '../services/api';
import { Conversation, Message, Document, SourceCitation } from '../types';

export default function ChatPage() {
  const { username, logout, role } = useAuthStore();
  const { 
    conversations, activeConversationId, messages, isStreaming, streamingReply, selectedSource,
    setConversations, setActiveConversationId, setMessages, addMessage, setStreaming, 
    appendStreamingReply, clearStreamingReply, setSelectedSource, updateMessageFeedback 
  } = useChatStore();
  const { theme, toggleTheme, setActiveTab } = useUIStore();

  // Local Page States
  const [inputText, setInputText] = useState('');
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [systemHealthy, setSystemHealthy] = useState(true);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);

  // Refs for layouts
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Initial Data Fetching
  const fetchConversationsAndDocs = async () => {
    try {
      const [convList, docList] = await Promise.all([
        chatApi.getConversations(),
        documentsApi.list()
      ]);
      setConversations(convList);
      setDocs(docList);
    } catch (err) {
      console.error("Failed to load initial chat page logs", err);
    }
  };

  const checkHealthStatus = async () => {
    try {
      const health = await systemApi.getHealth();
      setSystemHealthy(health.status === 'healthy');
    } catch {
      setSystemHealthy(false);
    }
  };

  useEffect(() => {
    fetchConversationsAndDocs();
    checkHealthStatus();
    
    // Set a recurring check for server health
    const healthInterval = setInterval(checkHealthStatus, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  // Poll processing files every 5 seconds if any doc is 'pending' or 'processing'
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'pending' || d.status === 'processing');
    if (!hasProcessing) return;

    const docInterval = setInterval(async () => {
      try {
        const freshDocs = await documentsApi.list();
        setDocs(freshDocs);
      } catch (err) {
        console.error("Failed to fetch fresh docs", err);
      }
    }, 4000);

    return () => clearInterval(docInterval);
  }, [docs]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingReply, isStreaming]);

  // 2. Chat Operations
  const handleStartNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setActiveConversationId(newSessionId);
  };

  const handleSwitchSession = async (id: string) => {
    setActiveConversationId(id);
    try {
      const history = await chatApi.getMessages(id);
      setMessages(history);
    } catch (err) {
      console.error("Failed to load messages history", err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isStreaming) return;

    setInputText('');
    let sessionId = activeConversationId;
    
    // Auto initiate session if none selected
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      setActiveConversationId(sessionId);
      
      // Seed a temporary blank conversation in sidebar
      const tempConv: Conversation = {
        id: sessionId,
        title: query.substring(0, 30) + (query.length > 30 ? '...' : ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setConversations([tempConv, ...conversations]);
    }

    // Append user message instantly
    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      conversation_id: sessionId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString()
    };
    addMessage(userMsg);
    
    setStreaming(true);
    clearStreamingReply();

    // Trigger post SSE fetch stream
    await streamChat(
      sessionId,
      query,
      (chunk) => {
        appendStreamingReply(chunk);
      },
      async (doneMeta) => {
        setStreaming(false);
        clearStreamingReply();
        
        // Append full assistant response
        const assistantMsg: Message = {
          id: `ast-${Date.now()}`,
          conversation_id: sessionId!,
          role: 'assistant',
          content: doneMeta.reply,
          sources_json: JSON.stringify(doneMeta.sources),
          total_tokens: doneMeta.tokensUsed,
          created_at: new Date().toISOString()
        };
        addMessage(assistantMsg);
        
        // Refresh conversations list to update titles/orders
        const list = await chatApi.getConversations();
        setConversations(list);
      },
      (error) => {
        setStreaming(false);
        clearStreamingReply();
        
        const errorMsg: Message = {
          id: `err-${Date.now()}`,
          conversation_id: sessionId!,
          role: 'assistant',
          content: `⚠️ Failed to fetch grounded response: ${error}`,
          created_at: new Date().toISOString()
        };
        addMessage(errorMsg);
      }
    );
  };

  // 3. Document Operations
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(file.name);
    setUploadProgress(10);
    
    try {
      await documentsApi.upload(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      
      setUploadProgress(100);
      setTimeout(() => setUploadingFile(null), 1000);
      
      // Fetch fresh list
      const freshDocs = await documentsApi.list();
      setDocs(freshDocs);
    } catch (err: any) {
      alert(err.response?.data?.detail || `Upload failed for file ${file.name}`);
      setUploadingFile(null);
    }
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name} from Knowledge Base? This re-indexes the vector space.`)) return;
    
    try {
      await documentsApi.delete(id);
      setDocs(docs.filter(d => d.id !== id));
    } catch (err) {
      console.error("Failed to delete document", err);
    }
  };

  // 4. Feedback Operations
  const handleRatingSubmit = async (messageId: string, rating: number) => {
    try {
      const text = feedbackNotes[messageId] || '';
      await chatApi.submitFeedback(messageId, rating, text);
      updateMessageFeedback(messageId, rating, text);
      setActiveFeedbackId(null);
    } catch (err) {
      console.error("Failed to record star feedback", err);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#07090e] transition-colors duration-300">
      
      {/* 1. Left Sidebar Panel */}
      <div className="hidden md:flex flex-col w-72 bg-white/40 dark:bg-slate-900/35 border-r border-slate-200 dark:border-slate-800/80 backdrop-blur-xl h-full select-none z-10">
        
        {/* Logo & New Chat */}
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-4">
            <span className="flex items-center font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-widest">
              <Sparkles className="w-5 h-5 text-brand-500 mr-1.5 shadow-glow-indigo rounded" />
              RAG Control Room
            </span>
            <div className={`flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
              systemHealthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
            }`}>
              <Activity className="w-2.5 h-2.5 mr-1" />
              {systemHealthy ? 'Online' : 'Offline'}
            </div>
          </div>
          
          <button
            onClick={handleStartNewChat}
            className="flex items-center justify-center w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all focus:outline-none"
          >
            <Plus className="w-4 h-4 mr-1.5 text-brand-500" />
            New Chat
          </button>
        </div>

        {/* Dynamic Chat History Scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <span className="block px-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">History</span>
          {conversations.length === 0 ? (
            <p className="px-2 text-xs text-slate-400 italic">No conversation logs yet.</p>
          ) : (
            conversations.map(conv => {
              const isActive = activeConversationId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSwitchSession(conv.id)}
                  className={`flex items-center w-full px-3 py-2 text-left rounded-lg text-xs font-medium border transition-all truncate focus:outline-none ${
                    isActive 
                      ? 'bg-brand-500 text-white border-brand-500/20 shadow-glow-indigo' 
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Knowledge Base Ingest List */}
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 p-4 max-h-56 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Knowledge Base</span>
            <button 
              onClick={handleUploadClick}
              className="text-[10px] font-bold text-brand-500 hover:underline flex items-center"
            >
              <UploadCloud className="w-3.5 h-3.5 mr-0.5" />
              Add
            </button>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf,.txt,.docx,.json" 
            className="hidden" 
          />

          {/* Active Uploading Indicator */}
          {uploadingFile && (
            <div className="p-2 mb-2 bg-brand-500/5 border border-brand-500/20 rounded-lg text-[10px]">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-bold mb-1">
                <span className="truncate">Ingesting: {uploadingFile}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {docs.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic">No files in directory.</p>
            ) : (
              docs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-1.5 rounded bg-slate-100/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 text-[10px] group">
                  <div className="flex items-center min-w-0 mr-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 mr-1.5 flex-shrink-0" />
                    <span className="truncate font-medium text-slate-700 dark:text-slate-300">{doc.name}</span>
                  </div>
                  
                  {/* Status lights */}
                  <div className="flex items-center">
                    {doc.status === 'processing' || doc.status === 'pending' ? (
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse mr-1" title="Embedding chunks..." />
                    ) : doc.status === 'failed' ? (
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1" title="Parsing error" />
                    ) : (
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" title="FAISS Indexed" />
                    )}
                    
                    <button 
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity ml-1 focus:outline-none"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Settings User Panel */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-100/30 dark:bg-slate-900/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
              <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center font-black mr-2 text-[10px] uppercase">
                {username ? username[0] : 'U'}
              </div>
              <span className="truncate max-w-[120px]">{username}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                  title="System Panel"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}
              
              <button 
                onClick={toggleTheme}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button 
                onClick={logout}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 focus:outline-none"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden h-full relative">
        
        {/* Mobile Navbar Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/35 backdrop-blur-xl">
          <span className="flex items-center font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-brand-500 mr-1.5" />
            RAG Assistant
          </span>
          <button 
            onClick={logout}
            className="text-xs text-slate-400 hover:text-red-500 font-semibold"
          >
            Sign Out
          </button>
        </div>

        {/* Conversation Stream Scroll Box */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
          {messages.length === 0 && !isStreaming ? (
            /* Intro Empty State */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center mt-12 md:mt-24">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-glow-indigo text-white mb-6 animate-pulse-subtle"
              >
                <Sparkles className="w-6 h-6" />
              </motion.div>
              <h2 className="text-xl md:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                Grounded Knowledge Search Assistant
              </h2>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Upload your business manuals, PDFs, spreadsheets, JSON keys, or txt guides in the sidebar. 
                I utilize real-time vector similarity indices to extract facts and draft strict, grounded, hallucination-free replies.
              </p>

              {/* Sample clicks suggestion row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-8 w-full">
                {[
                  "What is the employee password reset protocol?",
                  "Summarize key aspects in our security handbook."
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors focus:outline-none"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-brand-500 mb-1" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Message Bubbles list */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const sources: SourceCitation[] = msg.sources_json ? JSON.parse(msg.sources_json) : [];
                
                return (
                  <div key={msg.id} className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'}`}>
                    
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 animate-pulse-subtle">
                        AI
                      </div>
                    )}
                    
                    <div className="group max-w-[85%]">
                      <div className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed border transition-all ${
                        isUser 
                          ? 'bg-brand-500 text-white border-brand-500/20 shadow-glow-indigo rounded-br-sm' 
                          : 'bg-white/40 dark:bg-slate-900/30 text-slate-800 dark:text-slate-100 border-slate-200/60 dark:border-slate-800/60 rounded-bl-sm backdrop-blur-md'
                      }`}>
                        
                        {/* Render rich Markdown content */}
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            code: ({ children }) => (
                              <code className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded font-mono text-xs text-brand-500 font-bold leading-normal">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="p-3 my-2 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800 leading-normal">
                                {children}
                              </pre>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2 border border-slate-100 dark:border-slate-800 rounded-lg">
                                <table className="min-w-full text-xs text-left divide-y divide-slate-100 dark:divide-slate-800">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => <th className="px-3 py-2 bg-slate-100/50 dark:bg-slate-800/40 font-bold uppercase tracking-wider">{children}</th>,
                            td: ({ children }) => <td className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">{children}</td>,
                            ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {/* Audit Details (Tokens used) */}
                        {!isUser && msg.total_tokens !== undefined && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between text-[9px] text-slate-400 font-bold select-none uppercase tracking-wider">
                            <span>Ingested Context Sources: {sources.length}</span>
                            <span>Tokens Incurred: {msg.total_tokens}</span>
                          </div>
                        )}
                      </div>

                      {/* Grounded Citation Cards */}
                      {!isUser && sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {sources.map((src, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedSource(src)}
                              className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-slate-200/40 hover:bg-slate-200 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/40 dark:border-slate-800/40 transition-colors focus:outline-none"
                            >
                              <FileText className="w-3 h-3 mr-1 text-brand-500" />
                              <span className="truncate max-w-[120px]">{src.document_name}</span>
                              <span className="ml-1 text-slate-400 font-black">{(src.similarity_score * 100).toFixed(0)}%</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-1 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Rating star feedback button panel */}
                      {!isUser && (
                        <div className="mt-2 flex items-center justify-between px-1">
                          {msg.feedback_rating ? (
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star 
                                  key={s} 
                                  className={`w-3.5 h-3.5 ${
                                    s <= (msg.feedback_rating || 0) 
                                      ? 'text-amber-500 fill-amber-500' 
                                      : 'text-slate-300 dark:text-slate-700'
                                  }`} 
                                />
                              ))}
                              {msg.feedback_text && (
                                <span className="ml-2 text-[10px] text-slate-400 font-bold italic truncate max-w-[150px]">
                                  "{msg.feedback_text}"
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {activeFeedbackId === msg.id ? (
                                <div className="flex flex-col p-2.5 mt-1 bg-white/40 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 min-w-[220px] space-y-2">
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Rate AI grounded answer:</span>
                                  <div className="flex gap-1.5 justify-center">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <button 
                                        key={s}
                                        onClick={() => handleRatingSubmit(msg.id, s)}
                                        className="hover:scale-125 transition-transform"
                                      >
                                        <Star className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-amber-500 hover:fill-amber-500 fill-none" />
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Optional comment..."
                                    value={feedbackNotes[msg.id] || ''}
                                    onChange={(e) => setFeedbackNotes({ ...feedbackNotes, [msg.id]: e.target.value })}
                                    className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-700 dark:text-slate-300"
                                  />
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActiveFeedbackId(msg.id)}
                                  className="opacity-0 group-hover:opacity-100 flex items-center text-[10px] font-bold text-slate-400 hover:text-amber-500 transition-all focus:outline-none"
                                >
                                  <Star className="w-3.5 h-3.5 mr-1" />
                                  Rate grounded answer
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

              {/* Streaming token-by-token word buffer message block */}
              {isStreaming && streamingReply && (
                <div className="flex items-start justify-start">
                  <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 animate-pulse">
                    AI
                  </div>
                  <div className="p-4 rounded-2xl rounded-bl-sm text-xs md:text-sm bg-white/40 dark:bg-slate-900/30 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-800/60 max-w-[85%] leading-relaxed backdrop-blur-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                      {streamingReply}
                    </ReactMarkdown>
                    
                    {/* Live streaming pulsing indicator */}
                    <span className="w-1.5 h-4 bg-brand-500 inline-block ml-1 animate-pulse" />
                  </div>
                </div>
              )}

              {/* General Loading Typing dots indicator */}
              {isStreaming && !streamingReply && (
                <div className="flex items-start justify-start">
                  <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0 animate-pulse">
                    AI
                  </div>
                  <div className="p-3 px-4 rounded-2xl rounded-bl-sm bg-white/40 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 flex items-center gap-0.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* 3. Bottom Text Entry Box */}
        <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-white/20 dark:bg-slate-950/20 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto relative flex items-center bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-brand-500/25 px-4 py-2 transition-all">
            
            {/* Embedded inline Attachment button */}
            <button 
              onClick={handleUploadClick}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-400 hover:text-brand-500 transition-colors focus:outline-none mr-2"
              title="Attach Document Guide"
            >
              <UploadCloud className="w-5 h-5" />
            </button>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask the knowledge base assistant..."
              className="flex-1 bg-transparent border-none text-xs md:text-sm focus:outline-none focus:ring-0 dark:text-white resize-none max-h-24 min-h-[36px] py-2 overflow-y-auto leading-relaxed"
              rows={1}
            />

            {/* Inline dynamic submit send icon */}
            <button
              disabled={!inputText.trim() || isStreaming}
              onClick={() => handleSendMessage()}
              className="p-2 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white shadow-glow-indigo transition-all focus:outline-none ml-2 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>

            {/* Corner down indicator */}
            <div className="absolute right-16 bottom-3.5 hidden md:flex items-center gap-0.5 text-[8px] text-slate-400 font-extrabold uppercase select-none tracking-widest pointer-events-none">
              <span>Enter</span>
              <CornerDownLeft className="w-2 h-2" />
            </div>

          </div>
          
          <div className="max-w-3xl mx-auto text-center mt-2 text-[9px] text-slate-400 font-bold select-none uppercase tracking-widest">
            Answers are grounded strictly in knowledge base uploads. Vector similarity threshold limit (0.75) applies.
          </div>
        </div>

        {/* 4. Glass overlay drawer citation drawer */}
        <AnimatePresence>
          {selectedSource && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/20 dark:bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center p-4"
              onClick={() => setSelectedSource(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-lg p-6 glass-card rounded-2xl select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                  <div className="flex items-center min-w-0 mr-4">
                    <FileText className="w-5 h-5 text-brand-500 mr-2 flex-shrink-0" />
                    <span className="font-extrabold text-sm truncate text-slate-800 dark:text-white leading-tight">
                      {selectedSource.document_name}
                    </span>
                  </div>
                  
                  <div className="flex items-center flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-500/10 text-brand-500 border border-brand-500/15">
                      Confidence: {(selectedSource.similarity_score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Retrieved excerpt [chunk {selectedSource.chunk_index}]:</span>
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl text-xs md:text-sm leading-relaxed text-slate-700 dark:text-slate-200 overflow-y-auto font-mono italic">
                    "{selectedSource.content}"
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSource(null)}
                  className="w-full py-2.5 mt-6 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 transition-colors focus:outline-none"
                >
                  Close Citation
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
