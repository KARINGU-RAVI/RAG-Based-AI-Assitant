import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Sparkles, MessageSquare, Plus, Trash2, 
  FileText, UploadCloud, Send, LogOut, Sun, Moon, 
  Activity, Star, ExternalLink, HelpCircle, 
  Menu, X, LineChart, Sliders, Database, Cpu, CheckCircle, AlertTriangle
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { chatApi, documentsApi, systemApi, streamChat } from '../services/api';
import { Conversation, Message, Document, SourceCitation } from '../types';
import AdminDashboard from './AdminDashboard';

export default function ChatPage() {
  const { username, logout, role } = useAuthStore();
  const { 
    conversations, activeConversationId, messages, isStreaming, streamingReply, selectedSource,
    setConversations, setActiveConversationId, setMessages, addMessage, setStreaming, 
    appendStreamingReply, clearStreamingReply, setSelectedSource, updateMessageFeedback 
  } = useChatStore();
  const { theme, toggleTheme } = useUIStore();

  // Premium View & UI state overrides
  const [currentView, setCurrentView] = useState<'chat' | 'kb' | 'analytics' | 'settings'>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings State variables
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [generationTemp, setGenerationTemp] = useState(0.2);
  const [debugLogsEnabled, setDebugLogsEnabled] = useState(true);

  // Drag and Drop State
  const [dragActive, setDragActive] = useState(false);

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

  // Poll processing files every 4 seconds if any doc is 'pending' or 'processing'
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
    setMessages([]);
    setCurrentView('chat');
  };

  const handleSwitchSession = async (id: string) => {
    setActiveConversationId(id);
    setCurrentView('chat');
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
    await uploadFileAction(file);
  };

  const uploadFileAction = async (file: File) => {
    setUploadingFile(file.name);
    setUploadProgress(10);
    
    try {
      await documentsApi.upload(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      
      setUploadProgress(100);
      setTimeout(() => setUploadingFile(null), 1000);
      triggerToast(`Document "${file.name}" ingested successfully!`);
      
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
      triggerToast(`Document "${name}" deleted.`);
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
      triggerToast("Thank you for your feedback!");
    } catch (err) {
      console.error("Failed to record star feedback", err);
    }
  };

  // 5. Drag and Drop handlers
  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadFileAction(file);
    }
  };

  // 6. UI Helpers
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveSettings = () => {
    localStorage.setItem('gemini_api_key', geminiApiKey);
    triggerToast("System configurations saved successfully!");
  };

  // Extract statistics for RAG Insights panel
  const lastBotMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const activeSourcesCount = lastBotMessage?.sources_json ? JSON.parse(lastBotMessage.sources_json).length : 0;
  const activeTokensIncurred = lastBotMessage?.total_tokens || 0;
  const activeSourcesList: SourceCitation[] = lastBotMessage?.sources_json ? JSON.parse(lastBotMessage.sources_json) : [];

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text font-sans antialiased relative transition-colors duration-300">
      
      {/* Toast Notification */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 bg-text text-bg text-xs font-semibold rounded-lg shadow-lg z-50 transition-all duration-300 pointer-events-none select-none uppercase tracking-wider ${
        toastMessage ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}>
        {toastMessage}
      </div>

      {/* Mobile Sidebar Overlay Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity duration-150"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── 1. LEFT SIDEBAR PANEL ── */}
      <div className={`h-full bg-bg-subtle border-r border-border select-none z-40 flex flex-col transition-all duration-200 ${
        sidebarCollapsed ? "w-12" : "w-58"
      } ${
        mobileMenuOpen ? "fixed left-0 top-0 translate-x-0 w-58" : "hidden md:flex"
      }`}>
        
        {/* Toggle Collapse Trigger (only visible on desktop) */}
        <div className="p-3 pb-0 flex justify-end shrink-0 hidden md:flex">
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-7 h-7 rounded-md hover:bg-bg-hover text-text-4 hover:text-text-2 flex items-center justify-center transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Brand & New Chat */}
        <div className="p-3 pt-2 flex flex-col gap-2 shrink-0">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="flex items-center font-extrabold text-xs text-text uppercase tracking-widest">
                <Sparkles className="w-4.5 h-4.5 text-accent mr-1.5 shrink-0" />
                RAG Control
              </span>
              <div className={`flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                systemHealthy ? 'bg-green-dim text-green' : 'bg-red-dim text-red'
              }`}>
                <Activity className="w-2.5 h-2.5 mr-1" />
                {systemHealthy ? 'Online' : 'Offline'}
              </div>
            </div>
          )}

          <button
            onClick={handleStartNewChat}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border-mid bg-surface hover:bg-bg-subtle text-xs font-semibold text-text-2 hover:text-text transition-all ${
              sidebarCollapsed ? "justify-center" : "shadow-sm"
            }`}
            title="Start new conversation"
          >
            <Plus className="w-4 h-4 text-accent shrink-0" />
            {!sidebarCollapsed && <span className="truncate">New Chat</span>}
          </button>
        </div>

        {/* Sidebar Main Navigation Tabs */}
        <div className="px-2 py-2 flex flex-col gap-0.5 shrink-0">
          {[
            { id: 'chat', label: 'Conversational Chat', icon: MessageSquare },
            { id: 'kb', label: 'Knowledge Base', icon: Database, badge: docs.length },
            { id: 'analytics', label: 'System Analytics', icon: LineChart, adminOnly: true },
            { id: 'settings', label: 'AI Settings', icon: Sliders }
          ].map((tab) => {
            if (tab.adminOnly && role !== 'admin') return null;
            const Icon = tab.icon;
            const isActive = currentView === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => { setCurrentView(tab.id as any); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  isActive 
                    ? "bg-surface text-text border-border-mid shadow-sm" 
                    : "border-transparent text-text-3 hover:bg-bg-hover hover:text-text-2"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={tab.label}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-accent" : ""}`} />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate">{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="ml-auto text-[9px] font-bold bg-bg-muted text-text-3 px-1.5 py-0.5 rounded-full border border-border">
                        {tab.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Chat History Scroll (only when chat view active & expanded) */}
        {!sidebarCollapsed && currentView === 'chat' && (
          <div className="flex-1 overflow-y-auto px-2 py-4 border-t border-border/60">
            <span className="block px-2 text-[9px] font-extrabold uppercase tracking-widest text-text-4 mb-2">Recent Threads</span>
            {conversations.length === 0 ? (
              <p className="px-2 text-[11px] text-text-4 italic font-medium">No conversations recorded.</p>
            ) : (
              <div className="space-y-0.5">
                {conversations.map(conv => {
                  const isActive = activeConversationId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSwitchSession(conv.id)}
                      className={`flex items-center w-full px-2.5 py-1.5 text-left rounded-lg text-[11.5px] font-medium border transition-all truncate focus:outline-none ${
                        isActive 
                          ? 'bg-surface text-text border-border-mid shadow-sm' 
                          : 'border-transparent text-text-3 hover:bg-bg-hover hover:text-text-2'
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 mr-2 shrink-0 ${isActive ? "text-accent" : "text-text-4"}`} />
                      <span className="truncate flex-1">{conv.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sidebar Collapsible User Footer */}
        <div className="p-3 border-t border-border shrink-0 bg-bg-subtle">
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? "justify-center" : "px-1"}`}>
            <div className="w-6 h-6 rounded-full bg-text text-bg flex items-center justify-center font-bold text-[9px] uppercase shrink-0">
              {username ? username[0] : 'U'}
            </div>
            
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-text truncate max-w-[90px]">{username}</h4>
                  <span className="text-[10px] text-text-4 capitalize font-semibold tracking-wide">{role}</span>
                </div>
                <button 
                  onClick={logout}
                  className="p-1 rounded hover:bg-red-dim text-text-4 hover:text-red transition-colors"
                  title="Sign out of system"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 2. MAIN WORKSPACE PANELS ── */}
      <div className="flex-1 flex flex-col overflow-hidden h-full relative">
        
        {/* TOPBAR HEADER */}
        <div className="h-topbar border-b border-border flex items-center justify-between px-3 md:px-5 shrink-0 bg-bg z-30">
          <div className="flex items-center gap-2">
            {/* Mobile menu trigger */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded hover:bg-bg-hover text-text-3 hover:text-text-2 shrink-0 transition-colors"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            
            {/* App Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-text-3 select-none">
              <span className="font-semibold capitalize text-text-3">
                {currentView === 'kb' ? 'Knowledge Base' : currentView}
              </span>
              <span className="text-text-4">›</span>
              <span className="text-text font-bold truncate max-w-[150px]">
                {currentView === 'chat' 
                  ? (conversations.find(c => c.id === activeConversationId)?.title || 'New conversation')
                  : currentView === 'kb' ? 'Ingestion Repository'
                  : currentView === 'analytics' ? 'System Audits'
                  : 'AI configuration'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions Bar */}
            {currentView === 'chat' && (
              <button 
                onClick={() => setShowInsights(!showInsights)}
                className={`p-1.5 rounded hover:bg-bg-hover text-text-3 hover:text-text-2 transition-colors shrink-0 ${
                  showInsights ? "bg-accent-dim text-accent border border-accent-mid" : ""
                }`}
                title="Toggle RAG Pipeline Insights"
              >
                <Cpu className="w-4 h-4" />
              </button>
            )}
            
            <button 
              onClick={toggleTheme}
              className="p-1.5 rounded hover:bg-bg-hover text-text-3 hover:text-text-2 transition-colors shrink-0"
              title="Toggle theme mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setCurrentView('settings')}
              className="p-1.5 rounded hover:bg-bg-hover text-text-3 hover:text-text-2 transition-colors shrink-0"
              title="AI Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-border shrink-0 mx-1" />

            <div className="flex items-center gap-2 cursor-pointer hover:opacity-90 select-none" onClick={() => setCurrentView('settings')}>
              <div className="w-5.5 h-5.5 rounded-full bg-text text-bg flex items-center justify-center font-bold text-[9px] uppercase">
                {username ? username[0] : 'U'}
              </div>
              <span className="text-[11.5px] font-semibold text-text-2 hidden sm:inline truncate max-w-[80px]">{username}</span>
            </div>
          </div>
        </div>

        {/* WORKSPACE CONTENT ROUTER */}
        <div className="flex-1 flex overflow-hidden relative bg-bg">
          
          {/* VIEW A: CHAT FEED */}
          <div className={`flex-1 flex flex-col overflow-hidden h-full ${
            currentView === 'chat' ? 'flex' : 'hidden'
          }`}>
            
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scrollbar-thin">
              {messages.length === 0 && !isStreaming ? (
                /* Intro Grounded Empty State */
                <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center mt-12 md:mt-24 select-none">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-12 h-12 rounded-xl bg-text flex items-center justify-center text-bg mb-6 animate-pulse-subtle"
                  >
                    <Sparkles className="w-6 h-6 stroke-bg" />
                  </motion.div>
                  
                  <h2 className="text-lg md:text-xl font-bold text-text tracking-tight">
                    Grounded Knowledge Retrieval Assistant
                  </h2>
                  <p className="text-xs md:text-sm text-text-3 mt-1 max-w-sm mx-auto leading-relaxed">
                    Upload manuals, guides, or PDFs in the Knowledge Base tab. I utilize real-time embeddings and vector search to answer queries strictly without hallucinations.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-8 w-full">
                    {[
                      "What is our corporate password policy?",
                      "Summarize key rules in the security handbook."
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(prompt)}
                        className="p-3 text-left rounded-xl border border-border bg-surface hover:bg-bg-hover text-xs font-semibold text-text-2 hover:text-text transition-all shadow-xs active:scale-99"
                      >
                        <HelpCircle className="w-4 h-4 text-accent mb-1" />
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Chat Messages List */
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const sources: SourceCitation[] = msg.sources_json ? JSON.parse(msg.sources_json) : [];
                    
                    return (
                      <div key={msg.id} className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'}`}>
                        
                        {!isUser && (
                          <div className="w-7 h-7 rounded-lg bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 animate-pulse-subtle">
                            <Sparkles className="w-4 h-4 text-accent" />
                          </div>
                        )}
                        
                        <div className="group max-w-[85%]">
                          <div className={`p-4 rounded-xl text-xs md:text-sm leading-relaxed border transition-all ${
                            isUser 
                              ? 'bg-text text-bg border-text/10 rounded-br-sm' 
                              : 'bg-bg-subtle text-text border-border rounded-bl-sm shadow-sm'
                          }`}>
                            
                            {/* Render rich Markdown content */}
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                code: ({ children }) => (
                                  <code className={`p-1 rounded font-mono text-[11.5px] font-bold leading-normal ${
                                    isUser ? 'bg-white/15 text-white' : 'bg-bg-muted text-accent'
                                  }`}>
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="p-3 my-2 bg-text text-bg rounded-lg text-xs font-mono overflow-x-auto border border-border-mid leading-normal">
                                    {children}
                                  </pre>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-2 border border-border rounded-lg">
                                    <table className="min-w-full text-xs text-left divide-y divide-border">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                th: ({ children }) => <th className="px-3 py-2 bg-bg-muted font-bold uppercase tracking-wider text-[10px] text-text-3">{children}</th>,
                                td: ({ children }) => <td className="px-3 py-1.5 border-t border-border text-text-2">{children}</td>,
                                ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>

                            {/* Token and Sources Metadata Audits */}
                            {!isUser && msg.total_tokens !== undefined && (
                              <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[9px] text-text-4 font-bold select-none uppercase tracking-wider">
                                <span>Grounded Context Chunks: {sources.length}</span>
                                <span>Context Budget: {msg.total_tokens} tokens</span>
                              </div>
                            )}
                          </div>

                          {/* Grounded Citations Chips */}
                          {!isUser && sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {sources.map((src, i) => (
                                <button
                                  key={i}
                                  onClick={() => setSelectedSource(src)}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-[10.5px] font-bold bg-bg-subtle hover:bg-bg-hover text-text-3 border border-border transition-colors outline-none"
                                >
                                  <FileText className="w-3 h-3 mr-1 text-accent" />
                                  <span className="truncate max-w-[120px]">{src.document_name}</span>
                                  <span className="ml-1 text-green font-mono">{(src.similarity_score * 100).toFixed(0)}%</span>
                                  <ExternalLink className="w-2.5 h-2.5 ml-1 text-text-4" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Star Feedback Ratings Panel */}
                          {!isUser && (
                            <div className="mt-2 flex items-center justify-between px-1 select-none">
                              {msg.feedback_rating ? (
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      className={`w-3.5 h-3.5 ${
                                        s <= (msg.feedback_rating || 0) 
                                          ? 'text-amber fill-amber' 
                                          : 'text-text-4 fill-none'
                                      }`} 
                                    />
                                  ))}
                                  {msg.feedback_text && (
                                    <span className="ml-2 text-[10px] text-text-3 font-semibold italic truncate max-w-[150px]">
                                      "{msg.feedback_text}"
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  {activeFeedbackId === msg.id ? (
                                    <div className="flex flex-col p-2.5 mt-1 bg-surface border border-border-mid rounded-xl min-w-[220px] space-y-2 shadow-sm">
                                      <span className="text-[10px] font-bold text-text-3">Rate Grounded Response:</span>
                                      <div className="flex gap-1.5 justify-center">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <button 
                                            key={s}
                                            onClick={() => handleRatingSubmit(msg.id, s)}
                                            className="hover:scale-125 transition-transform"
                                          >
                                            <Star className="w-5 h-5 text-text-4 hover:text-amber fill-none" />
                                          </button>
                                        ))}
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Optional feedback notes..."
                                        value={feedbackNotes[msg.id] || ''}
                                        onChange={(e) => setFeedbackNotes({ ...feedbackNotes, [msg.id]: e.target.value })}
                                        className="w-full px-2 py-1.5 border border-border bg-bg-subtle rounded text-[10px] focus:border-accent outline-none text-text-2"
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setActiveFeedbackId(msg.id)}
                                      className="opacity-0 group-hover:opacity-100 flex items-center text-[10px] font-bold text-text-4 hover:text-amber transition-all focus:outline-none"
                                    >
                                      <Star className="w-3.5 h-3.5 mr-1" />
                                      Rate Answer
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

                  {/* Dynamic Streaming Text Buffer Box */}
                  {isStreaming && streamingReply && (
                    <div className="flex items-start justify-start">
                      <div className="w-7 h-7 rounded-lg bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-accent" />
                      </div>
                      <div className="p-4 rounded-xl rounded-bl-sm text-xs md:text-sm bg-bg-subtle text-text border border-border max-w-[85%] leading-relaxed shadow-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {streamingReply}
                        </ReactMarkdown>
                        {/* Live Streaming cursor line */}
                        <span className="w-1.5 h-4 bg-accent inline-block ml-1 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* General Typing loading indicators */}
                  {isStreaming && !streamingReply && (
                    <div className="flex items-start justify-start">
                      <div className="w-7 h-7 rounded-lg bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-accent" />
                      </div>
                      <div className="p-3 px-4 rounded-xl rounded-bl-sm bg-bg-subtle border border-border flex items-center gap-0.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  )}

                  {/* Scroll Anchor */}
                  <div ref={scrollRef} />
                </div>
              )}
            </div>

            {/* Bottom Input Search Panel */}
            <div className="p-4 border-t border-border shrink-0 bg-bg z-10">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 bg-bg-subtle border border-border-mid focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-dim rounded-2xl p-2.5 transition-all shadow-xs">
                  
                  <button 
                    onClick={handleUploadClick}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-4 hover:text-accent transition-colors shrink-0"
                    title="Ingest local document manual"
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
                    placeholder="Query your enterprise knowledge base assistant..."
                    className="flex-1 bg-transparent border-none text-xs md:text-sm focus:ring-0 outline-none text-text resize-none max-h-24 min-h-[22px] py-1.5 leading-relaxed placeholder:text-text-4"
                    rows={1}
                  />

                  <button
                    disabled={!inputText.trim() || isStreaming}
                    onClick={() => handleSendMessage()}
                    className="w-8 h-8 rounded-xl bg-text text-bg hover:bg-black/90 active:scale-95 disabled:opacity-40 transition-all shrink-0 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 stroke-bg fill-none" />
                  </button>
                </div>

                <div className="text-center mt-2.5 text-[9px] text-text-4 font-bold select-none uppercase tracking-widest leading-relaxed">
                  Answers are grounded strictly in uploaded business manuals. Vector similarity filter (score &gt;= 0.60) applies.
                </div>
              </div>
            </div>

          </div>

          {/* VIEW B: KNOWLEDGE BASE DRAG & DROP REPO */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentView === 'kb' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-4xl mx-auto space-y-6 select-none">
              
              <div className="page-header">
                <div className="page-header-text">
                  <h2 className="text-lg font-bold tracking-tight text-text">Knowledge Base Repository</h2>
                  <p className="text-xs text-text-3 mt-0.5">Ingest, parse, index, and manage your manuals in the vector database space</p>
                </div>
                
                <button 
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 h-8.5 px-4 bg-text text-bg hover:bg-black/90 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  <UploadCloud className="w-4 h-4 stroke-bg" />
                  Upload Document
                </button>
              </div>

              {/* Hidden file input anchor */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".pdf,.txt,.docx,.json" 
                className="hidden" 
              />

              {/* Ingest Progress bar */}
              {uploadingFile && (
                <div className="p-4 bg-accent-dim border border-accent-mid rounded-xl text-xs font-semibold shadow-xs">
                  <div className="flex items-center justify-between text-text-2 mb-2 font-bold uppercase tracking-wider">
                    <span className="truncate">Extracting chunks: {uploadingFile}</span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                    <div className="bg-accent h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Dotted Drag & Drop Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleUploadClick}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? "border-accent bg-accent-dim shadow-inner" 
                    : "border-border-strong bg-bg-subtle hover:border-accent hover:bg-accent-dim/30"
                }`}
              >
                <div className="w-11 h-11 rounded-lg border border-border-mid bg-surface flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <UploadCloud className="w-5 h-5 text-text-3" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-text mb-1">Drag and drop manual here</h3>
                <p className="text-[11px] text-text-3">or click to browse your local file system</p>
                
                <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
                  {['.PDF', '.DOCX', '.TXT', '.JSON'].map(ext => (
                    <span key={ext} className="text-[9.5px] font-bold text-text-3 bg-surface border border-border-mid px-2 py-0.5 rounded-md uppercase tracking-wider select-none">
                      {ext}
                    </span>
                  ))}
                </div>
              </div>

              {/* Document Repository statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  { label: "Total Ingested", value: docs.length, icon: FileText, color: "text-accent bg-accent-dim border-accent-mid" },
                  { label: "FAISS Indexed", value: docs.filter(d => d.status === 'completed').length, icon: CheckCircle, color: "text-green bg-green-dim border-green-dim" },
                  { label: "Processing", value: docs.filter(d => d.status === 'processing' || d.status === 'pending').length, icon: Activity, color: "text-amber bg-amber-dim border-amber-dim" },
                  { label: "Failed Ingestion", value: docs.filter(d => d.status === 'failed').length, icon: AlertTriangle, color: "text-red bg-red-dim border-red-dim" }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="p-3 border border-border rounded-xl bg-surface flex items-center gap-3 shadow-xs">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${stat.color} shrink-0`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-4 uppercase tracking-wider">{stat.label}</span>
                        <span className="text-lg font-extrabold text-text mt-0.5">{stat.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Document List Grid */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-4 mb-3.5 px-1">Indexed Manuals</h3>
                {docs.length === 0 ? (
                  <p className="text-xs text-text-4 italic font-medium p-6 border border-border rounded-xl bg-surface text-center">No indexed manuals in knowledge base yet. Drag or click the upload panel above.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {docs.map(doc => {
                      const isWord = doc.name.toLowerCase().endsWith('.docx');
                      const isPdf = doc.name.toLowerCase().endsWith('.pdf');
                      const isJson = doc.name.toLowerCase().endsWith('.json');
                      
                      return (
                        <div key={doc.id} className="p-4 border border-border rounded-xl bg-surface hover:border-border-strong transition-all flex flex-col justify-between shadow-xs relative group">
                          
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-red-dim/60 text-red border border-red-dim' :
                              isWord ? 'bg-brand-50 text-accent border border-brand-100' :
                              isJson ? 'bg-amber-dim text-amber border border-amber-dim' :
                              'bg-bg-muted text-text-3 border border-border'
                            }`}>
                              <FileText className="w-5 h-5 stroke-current" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-text truncate max-w-[190px] mb-0.5" title={doc.name}>
                                {doc.name}
                              </h4>
                              <span className="text-[10px] text-text-3 capitalize">
                                {(doc.file_size / 1024).toFixed(0)} KB • {doc.file_type.split('/')[1] || 'text'}
                              </span>
                            </div>

                            <button 
                              onClick={() => handleDeleteDocument(doc.id, doc.name)}
                              className="w-7 h-7 rounded-md hover:bg-red-dim text-text-4 hover:text-red flex items-center justify-center transition-colors shrink-0 outline-none"
                              title="Delete from knowledge base"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1 select-none">
                            <span className="text-[9px] font-extrabold text-text-4 uppercase tracking-wider">Status</span>
                            
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc.status === 'completed' ? 'bg-green-dim text-green' :
                              doc.status === 'failed' ? 'bg-red-dim text-red' :
                              'bg-amber-dim text-amber animate-pulse'
                            }`}>
                              <span className="w-1 h-1 rounded-full bg-current" />
                              {doc.status === 'completed' ? 'FAISS Indexed' :
                               doc.status === 'failed' ? 'Ingest Error' :
                               'Segmenting...'}
                            </span>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* VIEW C: SYSTEM AUDITS & ANALYTICS */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentView === 'analytics' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-4xl mx-auto space-y-6 select-none">
              <div className="page-header">
                <div className="page-header-text">
                  <h2 className="text-lg font-bold tracking-tight text-text">System Audits & Analytics</h2>
                  <p className="text-xs text-text-3 mt-0.5">Audit relational database schemas, active connection pools, and real-time logging events</p>
                </div>
              </div>
              
              {/* Embed the custom AdminDashboard component directly */}
              <AdminDashboard embedMode={true} />
            </div>
          </div>

          {/* VIEW D: AI CONFIGURATION SETTINGS */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentView === 'settings' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-2xl mx-auto space-y-6 select-none">
              
              <div className="page-header">
                <div className="page-header-text">
                  <h2 className="text-lg font-bold tracking-tight text-text">AI Configuration Settings</h2>
                  <p className="text-xs text-text-3 mt-0.5">Configure system parameters, LLM temperature budgets, and debug logging states</p>
                </div>
              </div>

              <div className="p-6 border border-border rounded-2xl bg-surface space-y-6 shadow-sm">
                
                {/* Gemini API Key */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-text uppercase tracking-wider">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your secure Gemini API Key..."
                    className="w-full px-3 h-9 rounded-lg border border-border-mid bg-bg-subtle focus:border-accent focus:ring-2 focus:ring-accent-dim outline-none text-xs text-text transition-all placeholder:text-text-4 font-mono"
                  />
                  <p className="text-[10px] text-text-4 font-medium leading-relaxed">
                    By default, the backend utilizes the server-side environment key. Overrides are stored securely in local browser storage.
                  </p>
                </div>

                {/* LLM Generation Temperature */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center select-none">
                    <label className="block text-xs font-bold text-text uppercase tracking-wider">Generation Temperature</label>
                    <span className="text-xs font-mono font-bold text-accent">{generationTemp}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={generationTemp}
                    onChange={(e) => setGenerationTemp(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <p className="text-[10px] text-text-4 font-medium leading-relaxed">
                    Lower values (e.g. 0.2) force maximum factual precision. Higher values allow creative, subjective reasoning.
                  </p>
                </div>

                {/* Debug Logging Toggle */}
                <div className="flex items-center justify-between py-2 border-t border-border/40 select-none">
                  <div>
                    <h4 className="text-xs font-bold text-text uppercase tracking-wider">Extended Audit Logging</h4>
                    <p className="text-[10px] text-text-4 font-medium mt-0.5">Asynchronously captures pipeline events and similarity scores in system_logs table</p>
                  </div>
                  <button 
                    onClick={() => setDebugLogsEnabled(!debugLogsEnabled)}
                    className={`w-9 h-5 rounded-full relative border transition-all ${
                      debugLogsEnabled ? "bg-text border-text" : "bg-bg-muted border-border-mid"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow-xs ${
                      debugLogsEnabled ? "right-0.5" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between py-2 border-t border-border/40 select-none">
                  <div>
                    <h4 className="text-xs font-bold text-text uppercase tracking-wider">Theme Mode Toggler</h4>
                    <p className="text-[10px] text-text-4 font-medium mt-0.5">Toggle standard clean surgical surgical layout and deep modern dark mode</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className={`w-9 h-5 rounded-full relative border transition-all ${
                      theme === 'dark' ? "bg-text border-text" : "bg-bg-muted border-border-mid"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow-xs ${
                      theme === 'dark' ? "right-0.5" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* Submit configurations */}
                <div className="border-t border-border/40 pt-4 flex justify-end">
                  <button 
                    onClick={saveSettings}
                    className="h-8.5 px-5 bg-text text-bg hover:bg-black/90 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all"
                  >
                    Save Configurations
                  </button>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ── 3. COLLAPSIBLE RIGHT INSIGHTS DRAWER PANEL ── */}
      {currentView === 'chat' && (
        <div className={`h-full border-l border-border bg-bg-subtle flex flex-col shrink-0 transition-all duration-200 select-none ${
          showInsights ? "w-64 opacity-100" : "w-0 opacity-0 overflow-hidden"
        }`}>
          <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-text">Pipeline Insights</h3>
            <button 
              onClick={() => setShowInsights(false)}
              className="p-1 rounded hover:bg-bg-hover text-text-4 hover:text-text-2 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            
            {/* Active Generative Model Card */}
            <div className="p-3 bg-surface border border-border rounded-xl shadow-xs">
              <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider text-text-4">
                <Cpu className="w-3 h-3 text-accent" /> Active LLM Model
              </span>
              <h4 className="text-xs font-bold text-text mt-1.5 leading-none">Gemini 2.5 Flash</h4>
              <p className="text-[10px] text-text-3 mt-1 leading-relaxed">Grounded with top K = 5 vectors retrieved at strict similarity filter (score &gt;= 0.60).</p>
            </div>

            {/* Ingestion Budgets Card */}
            <div className="p-3 bg-surface border border-border rounded-xl shadow-xs">
              <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider text-text-4">
                <Database className="w-3 h-3 text-accent" /> Context Token Budgets
              </span>
              <h4 className="text-xs font-extrabold text-text mt-1.5 leading-none">{activeTokensIncurred.toLocaleString()} tokens</h4>
              <p className="text-[10px] text-text-3 mt-1 leading-relaxed">Prompts and message buffers mapped into dynamic sliding context limits.</p>
            </div>

            {/* Retrieved Excerpts Card */}
            <div>
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-text-4 mb-2.5 px-1">Retrieved Excerpts ({activeSourcesCount})</span>
              {activeSourcesList.length === 0 ? (
                <p className="text-[11px] text-text-4 italic font-medium p-4 border border-border rounded-xl bg-surface text-center leading-relaxed">Ask a question to see real-time vector search retrieval logs.</p>
              ) : (
                <div className="space-y-2">
                  {activeSourcesList.map((src, i) => (
                    <div key={i} className="p-3 border border-border rounded-xl bg-surface space-y-2 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-text truncate max-w-[120px] font-mono leading-none">{src.document_name}</span>
                        <span className="text-[10px] font-bold text-green font-mono">{(src.similarity_score * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-[10.5px] text-text-3 font-mono leading-relaxed line-clamp-3 italic">
                        "{src.content}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Glass Citation Source modal details panel drawer */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedSource(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg p-6 bg-surface border border-border-mid shadow-lg rounded-2xl select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
                <div className="flex items-center min-w-0 mr-4">
                  <FileText className="w-5 h-5 text-accent mr-2 shrink-0" />
                  <span className="font-extrabold text-sm truncate text-text leading-tight" title={selectedSource.document_name}>
                    {selectedSource.document_name}
                  </span>
                </div>
                
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-dim text-accent border border-accent-mid select-none uppercase tracking-wider">
                  Confidence: {(selectedSource.similarity_score * 100).toFixed(1)}%
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 text-left">
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-text-4 leading-none">Retrieved segment [chunk {selectedSource.chunk_index}]:</span>
                <div className="p-4 bg-bg-subtle border border-border rounded-xl text-xs md:text-sm leading-relaxed text-text-2 overflow-y-auto font-mono italic">
                  "{selectedSource.content}"
                </div>
              </div>

              <button
                onClick={() => setSelectedSource(null)}
                className="w-full py-2 mt-5 text-xs font-bold border border-border-mid hover:bg-bg-hover rounded-xl text-text-2 transition-colors focus:outline-none uppercase tracking-wider shrink-0"
              >
                Close Citation
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
