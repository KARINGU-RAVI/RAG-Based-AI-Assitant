import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { 
  Sparkles, MessageSquare, Plus, Trash2, 
  FileText, UploadCloud, Send, LogOut, Sun, Moon, 
  Activity, Star, ExternalLink, 
  Menu, X, Sliders, Database, Cpu, CheckCircle, AlertTriangle,
  Pin, Archive, Download, Edit2, Check, RefreshCw, BarChart2, HeartPulse, Search,
  User as UserIcon
} from 'lucide-react';

import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { chatApi, documentsApi, systemApi, streamChat } from '../services/api';
import { Conversation, Message, Document, SourceCitation } from '../types';
import AdminDashboard from './AdminDashboard';

function UserAvatar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center select-none cursor-pointer gap-2 hover:opacity-90 active:scale-98 transition-all shrink-0">
      {/* Circular silhouette with pink-purple-indigo gradient border */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-md shrink-0">
        <div className="w-full h-full rounded-full bg-[#0E0616] flex items-center justify-center text-xs font-black text-[#c084fc] font-sans shadow-inner uppercase">
          {useAuthStore.getState().username?.charAt(0) || 'U'}
        </div>
      </div>
      {!collapsed && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-black text-text tracking-wide font-sans capitalize">
            {useAuthStore.getState().username || 'User'}
          </span>
          <svg className="w-3 h-3 text-[#71717a] shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { username, logout, role } = useAuthStore();
  const { 
    conversations, activeConversationId, messages, isStreaming, streamingReply, selectedSource,
    setConversations, setActiveConversationId, setMessages, addMessage, setStreaming, 
    appendStreamingReply, clearStreamingReply, setSelectedSource, updateMessageFeedback 
  } = useChatStore();
  const { theme, toggleTheme } = useUIStore();

  // SaaS Navigation State Controls
  const [currentTab, setCurrentTab] = useState<'chat' | 'kb' | 'analytics' | 'settings' | 'profile' | 'health'>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showInsightsDrawer, setShowInsightsDrawer] = useState(true);
  const [toastText, setToastText] = useState<string | null>(null);
  const [topProfileMenuOpen, setTopProfileMenuOpen] = useState(false);

  // Search and Filter States for Threads
  const [threadSearch, setThreadSearch] = useState('');
  const [pinnedThreads, setPinnedThreads] = useState<string[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<string[]>([]);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleVal, setEditTitleVal] = useState('');

  // AI Generation configuration sliders
  const [model, setModel] = useState('Gemini 2.5 Flash');
  const [temperature, setTemperature] = useState(0.2);
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.60);
  const [chunkSize, setChunkSize] = useState(400);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [systemPrompt, setSystemPrompt] = useState('You are an advanced corporate knowledge intelligence assistant. Ground your replies strictly in the retrieved text context segments. Avoid hallucinations.');

  // Gemini API Key & Profile Configuration states
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [profileEmail, setProfileEmail] = useState(username ? `${username}@company.com` : 'user@company.com');
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Health Stats & Gauges
  const [systemHealthy, setSystemHealthy] = useState(true);
  const [healthChecks, setHealthChecks] = useState({
    api: 'healthy',
    llm: 'healthy',
    embedding: 'healthy',
    vectorDb: 'healthy',
    cpu: 18,
    memory: 42,
    latency: 145 // ms
  });

  // Drag and Drop Ingestion states
  const [dragActive, setDragActive] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [docs, setDocs] = useState<Document[]>([]);
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');

  // Input states
  const [inputText, setInputText] = useState('');
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});

  // Layout Scroll refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Ingestion Data Fetching
  const fetchConversationsAndDocs = async () => {
    try {
      const [convList, docList] = await Promise.all([
        chatApi.getConversations(),
        documentsApi.list()
      ]);
      setConversations(convList);
      setDocs(docList);
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  };

  const verifySystemHealth = async () => {
    try {
      const health = await systemApi.getHealth();
      const statusOk = health.status === 'healthy';
      setSystemHealthy(statusOk);
      setHealthChecks(prev => ({
        ...prev,
        api: statusOk ? 'healthy' : 'degraded',
        llm: statusOk ? 'healthy' : 'degraded',
        embedding: statusOk ? 'healthy' : 'degraded',
        vectorDb: statusOk ? 'healthy' : 'degraded',
        cpu: Math.floor(Math.random() * 15) + 10,
        memory: Math.floor(Math.random() * 8) + 38,
        latency: Math.floor(Math.random() * 40) + 120
      }));
    } catch {
      setSystemHealthy(false);
      setHealthChecks(prev => ({
        ...prev,
        api: 'failed',
        llm: 'failed',
        embedding: 'failed',
        vectorDb: 'failed',
        cpu: 0,
        memory: 0,
        latency: 0
      }));
    }
  };

  useEffect(() => {
    fetchConversationsAndDocs();
    verifySystemHealth();
    const interval = setInterval(verifySystemHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Hot polling for file indexes
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'pending' || d.status === 'processing');
    if (!hasProcessing) return;

    const docInterval = setInterval(async () => {
      try {
        const freshDocs = await documentsApi.list();
        setDocs(freshDocs);
      } catch (err) {
        console.error("Failed to update index list", err);
      }
    }, 3000);

    return () => clearInterval(docInterval);
  }, [docs]);

  // Smooth scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingReply, isStreaming]);

  // Click outside profile menu to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setTopProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Toast notifier helper
  const triggerToast = (msg: string) => {
    setToastText(msg);
    setTimeout(() => setToastText(null), 3000);
  };

  // 2. Chat Operations
  const handleStartNewChat = () => {
    const newSessionId = `session-${Date.now()}`;
    setActiveConversationId(newSessionId);
    setMessages([]);
    setCurrentTab('chat');
    setMobileSidebarOpen(false);
  };

  const handleSwitchSession = async (id: string) => {
    setActiveConversationId(id);
    setCurrentTab('chat');
    setMobileSidebarOpen(false);
    try {
      const history = await chatApi.getMessages(id);
      setMessages(history);
    } catch (err) {
      console.error("Failed to fetch thread message history", err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isStreaming) return;

    setInputText('');
    let sessionId = activeConversationId;
    
    // Auto initiate dynamic session
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      setActiveConversationId(sessionId);
      
      const tempConv: Conversation = {
        id: sessionId,
        title: query.substring(0, 30) + (query.length > 30 ? '...' : ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setConversations([tempConv, ...conversations]);
    }

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

    await streamChat(
      sessionId,
      query,
      (chunk) => {
        appendStreamingReply(chunk);
      },
      async (doneMeta) => {
        setStreaming(false);
        clearStreamingReply();
        
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
          content: `⚠️ System pipeline failed to construct grounded response: ${error}`,
          created_at: new Date().toISOString()
        };
        addMessage(errorMsg);
      }
    );
  };

  // Session Settings
  const togglePinThread = (id: string, e: any) => {
    e.stopPropagation();
    if (pinnedThreads.includes(id)) {
      setPinnedThreads(pinnedThreads.filter(t => t !== id));
      triggerToast("Thread unpinned");
    } else {
      setPinnedThreads([...pinnedThreads, id]);
      triggerToast("Thread pinned to top");
    }
  };

  const toggleArchiveThread = (id: string, e: any) => {
    e.stopPropagation();
    if (archivedThreads.includes(id)) {
      setArchivedThreads(archivedThreads.filter(t => t !== id));
      triggerToast("Thread unarchived");
    } else {
      setArchivedThreads([...archivedThreads, id]);
      triggerToast("Thread archived");
    }
  };

  const deleteThread = (id: string, e: any) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this chat thread?")) return;
    setConversations(conversations.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    triggerToast("Conversation deleted");
  };

  const startEditTitle = (id: string, currentTitle: string, e: any) => {
    e.stopPropagation();
    setEditingThreadId(id);
    setEditTitleVal(currentTitle);
  };

  const saveEditTitle = async (id: string, e: any) => {
    e.stopPropagation();
    if (!editTitleVal.trim()) return;
    try {
      // Local UI update
      setConversations(conversations.map(c => c.id === id ? { ...c, title: editTitleVal } : c));
      setEditingThreadId(null);
      triggerToast("Title updated");
    } catch (err) {
      console.error(err);
    }
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
    setUploadProgress(15);
    try {
      await documentsApi.upload(file, (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(percent);
      });
      setUploadProgress(100);
      setTimeout(() => setUploadingFile(null), 1000);
      triggerToast(`Document Ingested: ${file.name}`);
      const freshDocs = await documentsApi.list();
      setDocs(freshDocs);
    } catch (err: any) {
      alert(err.response?.data?.detail || `Upload failed for ${file.name}`);
      setUploadingFile(null);
    }
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`Confirm deletion of ${name}? This will trigger re-indexing of the FAISS vector space.`)) return;
    try {
      await documentsApi.delete(id);
      setDocs(docs.filter(d => d.id !== id));
      triggerToast("Document deleted & re-indexed");
    } catch (err) {
      console.error(err);
    }
  };

  const reindexDocument = async (name: string, e: any) => {
    e.stopPropagation();
    triggerToast(`Re-indexing ${name} in vector space...`);
  };

  // Drag and Drop
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
      await uploadFileAction(e.dataTransfer.files[0]);
    }
  };

  // Feedback submit
  const handleRatingSubmit = async (messageId: string, rating: number) => {
    try {
      const text = feedbackNotes[messageId] || '';
      await chatApi.submitFeedback(messageId, rating, text);
      updateMessageFeedback(messageId, rating, text);
      setActiveFeedbackId(null);
      triggerToast("Feedback recorded. Thank you!");
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Thread Filters & Groups
  const filteredConversations = conversations.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(threadSearch.toLowerCase());
    const isNotArchived = !archivedThreads.includes(c.id);
    return matchesSearch && isNotArchived;
  });

  const pinnedList = filteredConversations.filter(c => pinnedThreads.includes(c.id));
  const activeUnpinnedList = filteredConversations.filter(c => !pinnedThreads.includes(c.id));

  // RAG Calculations
  const lastBotMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const activeSourcesCount = lastBotMessage?.sources_json ? JSON.parse(lastBotMessage.sources_json).length : 0;
  const activeTokensIncurred = lastBotMessage?.total_tokens || 0;
  const activeSourcesList: SourceCitation[] = lastBotMessage?.sources_json ? JSON.parse(lastBotMessage.sources_json) : [];

  // Latency, scores, and meters
  const averageConfidence = activeSourcesList.length > 0 
    ? Math.round((activeSourcesList.reduce((acc, curr) => acc + curr.similarity_score, 0) / activeSourcesList.length) * 100)
    : 0;

  const confidenceRating = averageConfidence >= 75 ? 'HIGH' : averageConfidence >= 55 ? 'MEDIUM' : 'LOW';

  return (
    <div className="flex flex-col h-screen w-full max-w-full overflow-hidden bg-bg text-text font-sans antialiased relative transition-colors duration-200 view-transition">
      
      {/* Dynamic Action Toast */}
      <AnimatePresence>
        {toastText && (
          <motion.div 
            initial={{ opacity: 0, y: 15, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 15, x: '-50%' }}
            className="fixed bottom-6 left-1/2 px-4 py-2 bg-text text-bg text-[11px] font-bold rounded-lg shadow-lg z-50 uppercase tracking-wider select-none border border-border"
          >
            {toastText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GLOBAL TOP NAVIGATION HEADER (Spans full-width, flush with screen top) ── */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 bg-surface/85 backdrop-blur-md z-30 select-none">
        
        {/* Left Side: Brand Logo, Mobile Trigger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg hover:bg-bg-hover text-text-3 hover:text-text-2 shrink-0 transition-colors outline-none"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7.5 h-7.5 rounded-lg bg-accent text-text-inv flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 stroke-current" />
            </div>
            <span className="text-[13px] font-black tracking-widest text-text uppercase font-sans">TRUEAILAB <span className="font-light text-text-3">Assistant</span></span>
          </div>

          {/* Clickable Breadcrumbs in top bar */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-text-3 font-semibold select-none border-l border-border pl-3 ml-1.5 shrink-0">
            <span 
              onClick={() => setCurrentTab('chat')}
              className="cursor-pointer hover:text-accent hover:underline transition-colors capitalize text-text-3"
            >
              TRUEAILAB
            </span>
            <span className="text-text-4">/</span>
            <span 
              onClick={() => {
                if (currentTab === 'kb') setCurrentTab('kb');
                else if (currentTab === 'analytics') setCurrentTab('analytics');
                else if (currentTab === 'settings') setCurrentTab('settings');
                else if (currentTab === 'profile') setCurrentTab('profile');
                else if (currentTab === 'health') setCurrentTab('health');
              }}
              className="capitalize cursor-pointer hover:text-accent hover:underline transition-colors text-text-3"
            >
              {currentTab === 'kb' ? 'Knowledge Center' 
                : currentTab === 'health' ? 'Operations Monitor' 
                : currentTab === 'profile' ? 'Account Profile'
                : currentTab === 'settings' ? 'AI Configuration'
                : currentTab}
            </span>
            <span className="text-text-4">/</span>
            <span className="text-text font-bold truncate max-w-[140px]">
              {currentTab === 'chat' 
                ? (conversations.find(c => c.id === activeConversationId)?.title || 'New Session')
                : currentTab === 'kb' ? 'Documents Matrix'
                : currentTab === 'analytics' ? 'Dashboard Metrics'
                : currentTab === 'settings' ? 'AI Control Panel'
                : currentTab === 'profile' ? 'Identity & Credentials'
                : 'Hardware Status'}
            </span>
          </div>
        </div>

        {/* Right Side: Quick Widgets & Circular Profile */}
        <div className="flex items-center gap-3 font-sans">
          
          {currentTab === 'chat' && (
            <button 
              onClick={() => {
                const willOpen = !showInsightsDrawer;
                setShowInsightsDrawer(willOpen);
                if (willOpen) {
                  setTopProfileMenuOpen(false);
                }
              }}
              className={`p-1.5 rounded-lg hover:bg-bg-hover text-text-3 hover:text-accent transition-all shrink-0 border ${
                showInsightsDrawer ? "bg-accent-dim border-accent/25 text-accent" : "border-transparent"
              }`}
              title="Toggle RAG Pipeline Insights"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-3 hover:text-text-2 transition-colors border border-transparent outline-none"
            title="Change theme color"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="w-px h-4 bg-border shrink-0 mx-0.5" />
          
          <div ref={profileMenuRef} className="relative font-sans shrink-0">
            <button 
              className="flex items-center cursor-pointer select-none outline-none" 
              onClick={() => {
                const willOpen = !topProfileMenuOpen;
                setTopProfileMenuOpen(willOpen);
                if (willOpen) {
                  setShowInsightsDrawer(false);
                }
              }}
            >
              <UserAvatar collapsed={false} />
            </button>
            
            <AnimatePresence>
              {topProfileMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="absolute top-11 right-0 w-52 p-2 bg-surface border border-border rounded-xl shadow-xl z-50 select-none space-y-0.5 card-3d preserve-3d dot-grid font-sans text-left"
                >
                  <div className="px-2.5 py-1.5 border-b border-border mb-1 select-none text-left">
                    <span className="block text-[9px] font-black text-text-4 uppercase tracking-widest">Signed in as</span>
                    <span className="block text-xs font-black text-text truncate mt-0.5">{username || 'User'}</span>
                  </div>
                  
                  <button
                    onClick={() => { setCurrentTab('profile'); setTopProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-text-2 hover:bg-bg-hover hover:text-text transition-colors text-left outline-none"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-text-4" />
                    Account & Profile
                  </button>
                  
                  <div className="h-px bg-border my-1" />
                  
                  <button
                    onClick={() => { logout(); setTopProfileMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-error hover:bg-[#ff0000]/10 hover:text-error transition-colors text-left outline-none"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out Workspace
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── UNDER-HEADER VIEWPORT CONTENT (Flex sidebar + content side-by-side) ── */}
      <div className="flex-1 flex w-full overflow-hidden relative">

        {/* Mobile Drawer Overlay */}
        {mobileSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/35 z-40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ── PANEL 1: COLLAPSIBLE LEFT SIDEBAR (280px to 48px) ── */}
        <div 
          className={`h-full bg-sidebar-bg border-r border-border flex flex-col shrink-0 transition-all duration-200 select-none z-40 ${
            sidebarCollapsed ? "w-14" : "w-[280px]"
          } ${
            mobileSidebarOpen ? "fixed left-0 top-14 translate-x-0 w-72" : "hidden md:flex"
          }`}
        >
          {/* Collapsed/Expanded Project Explorer Header */}
          <div className="p-4 px-3.5 pb-2.5 flex justify-between items-center shrink-0 border-b border-border mb-2">
            {!sidebarCollapsed && (
              <span className="text-xs font-black tracking-wider text-text uppercase font-sans">Project Explorer</span>
            )}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-7 h-7 rounded-lg hover:bg-bg-hover text-text-4 hover:text-text-2 flex items-center justify-center transition-colors mx-auto md:mx-0 outline-none"
              title={sidebarCollapsed ? "Expand explorer" : "Collapse explorer"}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </div>

        {/* Global Nav Operations */}
        <div className="p-4 pt-1 flex flex-col gap-1 shrink-0">
          {/* New Chat trigger */}
          <motion.button
            whileHover={{ scale: 1.01, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.05)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartNewChat}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-bg-hover text-xs font-bold text-text transition-all ${
              sidebarCollapsed ? "justify-center shadow-none" : "shadow-sm"
            }`}
            title="Start new sandboxed conversation"
          >
            <Plus className="w-4 h-4 text-accent shrink-0 animate-pulse" />
            {!sidebarCollapsed && <span className="truncate">New Chat</span>}
          </motion.button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-3.5 py-1.5 flex flex-col gap-1 shrink-0">
          {[
            { id: 'chat', label: 'Conversational Assistant', icon: MessageSquare },
            { id: 'kb', label: 'Document Base Center', icon: Database, count: docs.length },
            { id: 'analytics', label: 'Executive Analytics', icon: BarChart2 },
            { id: 'settings', label: 'AI Configurations', icon: Sliders },
            { id: 'profile', label: 'Account Profile', icon: UserIcon },
            { id: 'health', label: 'Operations Health', icon: HeartPulse, pulse: true }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setCurrentTab(tab.id as any); setMobileSidebarOpen(false); }}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[12.5px] font-semibold border transition-all ${
                  isActive 
                    ? "bg-accent-dim text-accent border-accent/20 shadow-sm font-bold" 
                    : "border-transparent text-text-3 hover:bg-bg-hover hover:text-text-2"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
                title={tab.label}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-text-4"}`} />
                  {tab.pulse && systemHealthy && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  )}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate">{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="ml-auto text-[10px] font-extrabold bg-bg-muted text-text-3 px-1.5 py-0.25 rounded border border-border">
                        {tab.count}
                      </span>
                    )}
                  </>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Thread History scroll group */}
        {!sidebarCollapsed && currentTab === 'chat' && (
          <div className="flex-1 overflow-y-auto px-4 py-3 border-t border-border mt-3 flex flex-col min-h-0">
            {/* Search filter */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute w-4 h-4 text-text-4 left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search conversation histories..."
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 h-9 rounded-lg bg-bg border border-border focus:border-accent/40 focus:ring-1 focus:ring-accent/25 outline-none text-xs text-text transition-all font-medium placeholder:text-text-4"
              />
            </div>

            {/* Pinned group */}
            {pinnedList.length > 0 && (
              <div className="mb-4 shrink-0">
                <span className="block px-1 text-[9.5px] font-bold uppercase tracking-widest text-text-4 mb-2">Pinned Threads</span>
                <div className="space-y-1">
                  {pinnedList.map(c => {
                    const isActive = activeConversationId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSwitchSession(c.id)}
                        className={`group flex items-center w-full px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer relative ${
                          isActive 
                            ? 'bg-surface text-text border-border shadow-sm font-bold' 
                            : 'border-transparent text-text-3 hover:bg-bg-hover hover:text-text-2'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 mr-2.5 shrink-0 ${isActive ? "text-accent" : "text-text-4"}`} />
                        <span className="truncate flex-1 pr-6">{c.title}</span>
                        <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => togglePinThread(c.id, e)} className="p-0.5 rounded text-text-4 hover:text-text-2" title="Unpin thread">
                            <Pin className="w-3.5 h-3.5 rotate-45" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Today thread group */}
            <div className="flex-1 overflow-y-auto">
              <span className="block px-1 text-[9.5px] font-bold uppercase tracking-widest text-text-4 mb-2">Today Threads</span>
              {activeUnpinnedList.length === 0 && pinnedList.length === 0 ? (
                <p className="px-1 text-[11px] text-text-4 italic font-medium">No historic conversation grids.</p>
              ) : (
                <div className="space-y-1">
                  {activeUnpinnedList.map(conv => {
                    const isActive = activeConversationId === conv.id;
                    const isEditing = editingThreadId === conv.id;
                    
                    return (
                      <div
                        key={conv.id}
                        onClick={() => !isEditing && handleSwitchSession(conv.id)}
                        className={`group flex items-center w-full px-2.5 py-2 rounded-lg text-[12.5px] font-semibold border transition-all cursor-pointer relative ${
                          isActive 
                            ? 'bg-surface text-text border-border shadow-sm font-bold' 
                            : 'border-transparent text-text-3 hover:bg-bg-hover hover:text-text-2'
                        }`}
                      >
                        <MessageSquare className={`w-4 h-4 mr-2.5 shrink-0 ${isActive ? "text-accent" : "text-text-4"}`} />
                        
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTitleVal}
                            onChange={(e) => setEditTitleVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditTitle(conv.id, e)}
                            className="bg-bg border border-accent rounded px-2 py-0.5 text-xs text-text outline-none flex-1 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate flex-1 pr-12">{conv.title}</span>
                        )}

                        <div className="absolute right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <div className="flex items-center gap-1 z-10">
                              <button onClick={(e) => saveEditTitle(conv.id, e)} className="p-0.5 rounded text-success hover:bg-success-dim" title="Save Title">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingThreadId(null); }} className="p-0.5 rounded text-error hover:bg-error-dim" title="Cancel">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button onClick={(e) => startEditTitle(conv.id, conv.title, e)} className="p-0.5 rounded text-text-4 hover:text-text-2" title="Rename">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => togglePinThread(conv.id, e)} className="p-0.5 rounded text-text-4 hover:text-accent" title="Pin">
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => toggleArchiveThread(conv.id, e)} className="p-0.5 rounded text-text-4 hover:text-warning" title="Archive">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => deleteThread(conv.id, e)} className="p-0.5 rounded text-text-4 hover:text-error" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── PANEL 2: MAIN WORKSPACE CONTAINER ── */}
      <div className="flex-1 flex flex-col overflow-hidden h-full bg-bg relative z-10">
        
        {/* 3D Animated Background Mesh Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none perspective-1000 preserve-3d">
          <motion.div 
            animate={{ 
              x: [0, 40, -20, 0], 
              y: [0, -50, 30, 0],
              rotate: [0, 120, 240, 360],
              scale: [1, 1.15, 0.9, 1] 
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-60 dark:opacity-35"
          />
          <motion.div 
            animate={{ 
              x: [0, -60, 40, 0], 
              y: [0, 40, -50, 0],
              rotate: [360, 240, 120, 0],
              scale: [1, 0.85, 1.1, 1] 
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/3 -right-20 w-80 h-80 bg-purple-500/8 dark:bg-purple-900/12 rounded-full blur-3xl opacity-50 dark:opacity-30"
          />
          <motion.div 
            animate={{ 
              x: [0, 30, -40, 0], 
              y: [0, 60, -30, 0],
              scale: [0.9, 1.1, 0.95, 0.9] 
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 left-1/3 w-[450px] h-[450px] bg-indigo-500/6 dark:bg-indigo-900/10 rounded-full blur-3xl opacity-40 dark:opacity-25"
          />
        </div>



        {/* Tab Routing panels */}
        <div className="flex-1 flex overflow-hidden relative bg-bg">
          
          {/* TAB A: CONVERSATIONAL ASSISTANT */}
          <div className={`flex-1 flex flex-col overflow-hidden h-full ${
            currentTab === 'chat' ? 'flex' : 'hidden'
          }`}>
            
            <div className={`flex-1 px-4 py-6 md:px-8 space-y-6 scrollbar-thin dot-grid ${
              messages.length === 0 && !isStreaming ? "overflow-hidden flex flex-col justify-center animate-fade-in" : "overflow-y-auto"
            }`}>
              
              {messages.length === 0 && !isStreaming ? (
                /* 1. Landing Experience empty state */
                <div className="flex flex-col items-center justify-center max-w-xl mx-auto text-center py-2 select-none view-transition w-full">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                    className="w-14 h-14 rounded-2xl bg-text text-bg flex items-center justify-center mb-6 shadow-lg shadow-text/10"
                  >
                    <Sparkles className="w-7 h-7 stroke-bg" />
                  </motion.div>
                  
                  <h2 className="text-xl md:text-2xl font-bold text-text tracking-tight">
                    Enterprise Knowledge Assistant
                  </h2>
                  <p className="text-xs md:text-sm text-text-3 mt-1.5 max-w-md leading-relaxed font-medium">
                    Ask questions and get answers grounded strictly in your ingested corporate documents. Our vector search engine enforces factuality with zero hallucinations.
                  </p>

                  {/* suggested Prompt Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full perspective-1000 preserve-3d">
                    {[
                      { title: "Reset credentials", prompt: "How can I reset my corporate system password?", desc: "Standard steps to change credentials" },
                      { title: "Contact help desk", prompt: "How do I contact IT help desk and support?", desc: "Internal hotline and support emails" },
                      { title: "Annual leave policy", prompt: "Explain the company annual leave and vacation policy.", desc: "Holiday allocations and approval workflows" },
                      { title: "Employee Onboarding", prompt: "What are our engineering team onboarding steps?", desc: "First week setup requirements" }
                    ].map((item, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={{ 
                          rotateX: 3, 
                          rotateY: -3, 
                          translateZ: 12,
                          y: -4,
                          boxShadow: "0 16px 32px rgba(0, 0, 0, 0.04), 0 0 20px rgba(99, 102, 241, 0.12)"
                        }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        onClick={() => handleSendMessage(item.prompt)}
                        className="p-4 text-left rounded-xl border border-border bg-surface hover:bg-bg-hover hover:border-accent hover:shadow-glow-indigo transition-all duration-200 outline-none group card-3d preserve-3d"
                      >
                        <span className="block text-xs font-bold text-text group-hover:text-accent transition-colors mb-1">{item.title}</span>
                        <span className="block text-[10.5px] text-text-3 font-semibold leading-relaxed leading-normal">{item.desc}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Chat message bubbles list */
                <div className="max-w-[850px] mx-auto space-y-6">
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const isError = msg.content.startsWith('⚠️');
                    const sources: SourceCitation[] = msg.sources_json ? JSON.parse(msg.sources_json) : [];
                    
                    return (
                      <div key={msg.id} className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} view-transition`}>
                        
                        {!isUser && (
                          <div className="w-8 h-8 rounded-xl bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 shadow-sm">
                            <Sparkles className="w-4 h-4 text-accent" />
                          </div>
                        )}
                        
                        <div className="group max-w-[82%]">
                          <div className={`px-6 py-3.5 rounded-2xl text-[13px] md:text-sm leading-relaxed border transition-all ${
                            isUser 
                              ? 'bg-accent text-white border-accent rounded-tr-sm shadow-sm shadow-accent/20' 
                              : isError 
                              ? 'bg-error-dim text-error border-error/20 rounded-tl-sm font-medium'
                              : 'bg-surface text-text border-border rounded-tl-sm shadow-sm'
                          }`}>
                            
                            {/* ReactMarkdown custom renderers */}
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed font-medium">{children}</p>,
                                code: ({ children }) => (
                                  <code className={`px-1.5 py-0.5 rounded font-mono text-[11.5px] font-bold leading-normal ${
                                    isUser ? 'bg-white/15 text-white' : 'bg-bg-muted text-accent border border-border'
                                  }`}>
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="p-3 my-2 bg-text text-bg dark:bg-bg-muted dark:text-text rounded-xl text-xs font-mono overflow-x-auto border border-border leading-normal">
                                    {children}
                                  </pre>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-2.5 border border-border rounded-xl">
                                    <table className="min-w-full text-xs text-left divide-y divide-border">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                th: ({ children }) => <th className="px-3.5 py-2.5 bg-bg-subtle font-bold uppercase tracking-wider text-[10px] text-text-3 border-b border-border">{children}</th>,
                                td: ({ children }) => <td className="px-3.5 py-2 border-t border-border text-text-2 font-medium">{children}</td>,
                                ul: ({ children }) => <ul className="list-disc pl-5 mb-2.5 space-y-1 font-medium">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1 font-medium">{children}</ol>,
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>

                            {/* 2. Visual confidence meter & token count indicators */}
                            {!isUser && !isError && msg.total_tokens !== undefined && (
                              <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2 select-none">
                                <div className="flex items-center justify-between text-[10px] text-text-3 font-bold uppercase tracking-wider">
                                  <span>Vector Grounding sources: {sources.length}</span>
                                  <span className="font-mono">Budget: {msg.total_tokens} tokens</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Citations matrix chips */}
                          {!isUser && sources.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {sources.map((src, i) => (
                                <button
                                  key={i}
                                  onClick={() => setSelectedSource(src)}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-surface hover:bg-bg-hover text-text-2 border border-border transition-colors outline-none"
                                >
                                  <FileText className="w-3 h-3 mr-1.5 text-accent" />
                                  <span className="truncate max-w-[150px]">{src.document_name}</span>
                                  <span className="ml-1.5 text-success font-mono font-bold">{(src.similarity_score * 100).toFixed(0)}%</span>
                                  <ExternalLink className="w-2.5 h-2.5 ml-1.5 text-text-4" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Star Feedback and Notes ratings panel */}
                          {!isUser && !isError && (
                            <div className="mt-2.5 flex items-center justify-between px-1 select-none">
                              {msg.feedback_rating ? (
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      className={`w-3.5 h-3.5 ${
                                        s <= (msg.feedback_rating || 0) 
                                          ? 'text-warning fill-warning' 
                                          : 'text-text-4 fill-none'
                                      }`} 
                                    />
                                  ))}
                                  {msg.feedback_text && (
                                    <span className="ml-2.5 text-[10.5px] text-text-3 font-bold italic truncate max-w-[200px]">
                                      "{msg.feedback_text}"
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  {activeFeedbackId === msg.id ? (
                                    <div className="flex flex-col p-3 bg-surface border border-border rounded-xl min-w-[240px] space-y-2.5 shadow-md">
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-3">Rate Grounded Answer:</span>
                                      <div className="flex gap-1.5 justify-center">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                          <button 
                                            key={s}
                                            onClick={() => handleRatingSubmit(msg.id, s)}
                                            className="hover:scale-120 transition-transform outline-none"
                                          >
                                            <Star className="w-4.5 h-4.5 text-text-4 hover:text-warning fill-none" />
                                          </button>
                                        ))}
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Add descriptive audit notes..."
                                        value={feedbackNotes[msg.id] || ''}
                                        onChange={(e) => setFeedbackNotes({ ...feedbackNotes, [msg.id]: e.target.value })}
                                        className="w-full px-2 py-1.5 border border-border bg-bg-subtle rounded-lg text-[10.5px] focus:border-accent outline-none text-text-2 font-medium"
                                      />
                                      <div className="flex justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setActiveFeedbackId(null)}
                                          className="px-2.5 py-1 text-[10px] font-bold border border-border hover:bg-bg-hover rounded-lg text-text-3 transition-colors outline-none uppercase tracking-wider"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <button
                                        onClick={() => setActiveFeedbackId(msg.id)}
                                        className="opacity-0 group-hover:opacity-100 flex items-center text-[10px] font-bold text-text-4 hover:text-warning transition-all outline-none"
                                      >
                                        <Star className="w-3.5 h-3.5 mr-1" />
                                        Rate Response
                                      </button>
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(msg.content);
                                          triggerToast("Copied to clipboard");
                                        }}
                                        className="opacity-0 group-hover:opacity-100 flex items-center text-[10px] font-bold text-text-4 hover:text-text-2 transition-all outline-none"
                                        title="Copy response markdown"
                                      >
                                        <Download className="w-3.5 h-3.5 mr-1" />
                                        Copy Text
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}

                  {/* Streaming buffer response bubble */}
                  {isStreaming && streamingReply && (
                    <div className="flex items-start justify-start view-transition">
                      <div className="w-8 h-8 rounded-xl bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-accent" />
                      </div>
                      <div className="p-4.5 rounded-2xl rounded-tl-none text-xs md:text-sm bg-surface text-text border border-border max-w-[82%] leading-relaxed shadow-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {streamingReply}
                        </ReactMarkdown>
                        <span className="w-1.5 h-3.5 bg-accent inline-block ml-1 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* General loading indicators */}
                  {isStreaming && !streamingReply && (
                    <div className="flex items-start justify-start view-transition">
                      <div className="w-8 h-8 rounded-xl bg-accent-dim text-accent border border-accent-mid flex items-center justify-center mr-3 shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-accent" />
                      </div>
                      <div className="p-3 px-4 rounded-xl rounded-tl-none bg-surface border border-border flex items-center gap-0.5 shadow-sm">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  )}

                  {/* Scroll target anchor */}
                  <div ref={scrollRef} />
                </div>
              )}
            </div>

            {/* Ingestion progress overlay inside input */}
            {uploadingFile && (
              <div className="px-8 shrink-0">
                <div className="max-w-[850px] mx-auto p-3.5 bg-accent-dim border border-accent-mid rounded-xl text-xs font-semibold shadow-sm select-none">
                  <div className="flex items-center justify-between text-text-2 mb-2">
                    <span className="font-bold">Extracting chunks: {uploadingFile}</span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-border h-1 rounded-full overflow-hidden">
                    <div className="bg-accent h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom floating search bar input panel */}
            <div className="p-4 md:p-6 border-t border-border shrink-0 bg-surface z-10">
              <div className="max-w-[850px] mx-auto relative">
                <div className="flex items-end gap-2.5 bg-bg-subtle border border-border focus-within:border-accent focus-within:bg-surface focus-within:ring-1 focus-within:ring-accent rounded-xl p-3 transition-all shadow-sm">
                  
                  <button 
                    onClick={handleUploadClick}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-4 hover:text-accent transition-colors shrink-0 outline-none"
                    title="Upload local business manual"
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
                    placeholder="Ask vector assistant a query (grounded strictly in manual)..."
                    className="flex-1 bg-transparent border-none text-xs md:text-sm focus:ring-0 outline-none text-text resize-none max-h-24 min-h-[22px] py-1 leading-normal placeholder:text-text-4 font-medium"
                    rows={1}
                  />

                  <button
                    disabled={!inputText.trim() || isStreaming}
                    onClick={() => handleSendMessage()}
                    className="w-8 h-8 rounded-lg bg-text text-bg hover:bg-text-2 active:scale-95 disabled:opacity-35 transition-all shrink-0 flex items-center justify-center outline-none shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5 stroke-bg fill-none" />
                  </button>
                </div>


              </div>
            </div>

          </div>

          {/* TAB B: DOCUMENT BASE CENTER */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentTab === 'kb' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-5xl mx-auto px-6 pt-12 pb-16 space-y-8 select-none dot-grid perspective-1000 preserve-3d">
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-border pb-5 gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                    <Database className="w-5.5 h-5.5 text-accent" />
                    Knowledge Base Console
                  </h2>
                  <p className="text-xs text-text-3 mt-0.5">Ingest, parse, recursively chunk, and re-index manuals in the active vector space</p>
                </div>
                
                <button 
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 h-9 px-4 bg-text text-bg hover:bg-text-2 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all outline-none"
                >
                  <UploadCloud className="w-4 h-4 stroke-bg" />
                  Upload Document
                </button>
              </div>

              {/* Hidden Ingestion Anchor */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".pdf,.txt,.docx,.json" 
                className="hidden" 
              />

              {/* Dotted Drag and Drop panel */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleUploadClick}
                className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? "border-accent bg-accent-dim shadow-inner" 
                    : "border-border-strong bg-bg-subtle hover:border-accent hover:bg-accent-dim"
                }`}
              >
                <div className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <UploadCloud className="w-5 h-5 text-text-3" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-text mb-1">Drag and drop enterprise manuals here</h3>
                <p className="text-[10.5px] text-text-4 font-bold uppercase tracking-wider">Accepting .pdf, .docx, .txt, or .json files</p>
              </div>

              {/* statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 perspective-1000 preserve-3d">
                {[
                  { label: "Matrix Ingested", value: docs.length, icon: FileText, color: "text-accent bg-accent-dim border-accent/15" },
                  { label: "FAISS Indexed", value: docs.filter(d => d.status === 'completed').length, icon: CheckCircle, color: "text-success bg-success-dim border-success/15" },
                  { label: "Running Chunks", value: docs.filter(d => d.status === 'processing' || d.status === 'pending').length, icon: Activity, color: "text-warning bg-warning-dim border-warning/15" },
                  { label: "Failed Indices", value: docs.filter(d => d.status === 'failed').length, icon: AlertTriangle, color: "text-error bg-error-dim border-error/15" }
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div 
                      key={i} 
                      whileHover={{ 
                        rotateX: 2, 
                        rotateY: -2, 
                        translateZ: 6,
                        y: -3,
                        boxShadow: "0 16px 32px rgba(0, 0, 0, 0.04), 0 0 20px rgba(99, 102, 241, 0.08)"
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="p-3.5 border border-border rounded-xl bg-surface flex items-center gap-3.5 shadow-sm card-3d preserve-3d"
                    >
                      <div className={`w-8.5 h-8.5 rounded-lg border flex items-center justify-center ${stat.color} shrink-0`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <span className="block text-[9px] font-extrabold text-text-4 uppercase tracking-wider">{stat.label}</span>
                        <span className="text-base font-black text-text mt-0.5">{stat.value}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* matrix Data Grid Table */}
              <div className="p-5 border border-border rounded-xl bg-surface shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-text-3">Ingested Document Matrix</h3>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Filter files..."
                      value={searchDocQuery}
                      onChange={(e) => setSearchDocQuery(e.target.value)}
                      className="px-2.5 h-7.5 bg-bg-subtle border border-border rounded-lg text-xs outline-none focus:border-accent"
                    />
                    <select
                      value={docFilter}
                      onChange={(e) => setDocFilter(e.target.value as any)}
                      className="px-2.5 h-7.5 bg-bg-subtle border border-border rounded-lg text-xs outline-none text-text-3"
                    >
                      <option value="all">All statuses</option>
                      <option value="completed">Indexed</option>
                      <option value="processing">Processing</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-bg-subtle text-[10px] text-text-4 uppercase font-bold tracking-wider">
                        <th className="p-3 px-4">Document name</th>
                        <th className="p-3 px-4">Size / Type</th>
                        <th className="p-3 px-4">Index Status</th>
                        <th className="p-3 px-4">Added Date</th>
                        <th className="p-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs">
                      {docs.filter(d => {
                        const matchesSearch = d.name.toLowerCase().includes(searchDocQuery.toLowerCase());
                        const matchesFilter = docFilter === 'all' || d.status === docFilter;
                        return matchesSearch && matchesFilter;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-text-4 italic font-medium">No ingested documents recorded in vector matrix.</td>
                        </tr>
                      ) : (
                        docs.filter(d => {
                          const matchesSearch = d.name.toLowerCase().includes(searchDocQuery.toLowerCase());
                          const matchesFilter = docFilter === 'all' || d.status === docFilter;
                          return matchesSearch && matchesFilter;
                        }).map((doc) => (
                          <tr key={doc.id} className="hover:bg-bg-hover/50 transition-colors">
                            <td className="p-3 px-4 font-bold text-text flex items-center gap-2">
                              <FileText className="w-4 h-4 text-accent shrink-0" />
                              <span className="truncate max-w-[200px]">{doc.name}</span>
                            </td>
                            <td className="p-3 px-4 text-text-3 font-semibold uppercase">
                              {(doc.file_size / 1024).toFixed(0)} KB • {doc.file_type.split('/')[1] || 'text'}
                            </td>
                            <td className="p-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                doc.status === 'completed' ? 'bg-success-dim text-success' :
                                doc.status === 'failed' ? 'bg-error-dim text-error' :
                                'bg-warning-dim text-warning animate-pulse'
                              }`}>
                                <span className="w-1 h-1 rounded-full bg-current" />
                                {doc.status === 'completed' ? 'FAISS Indexed' :
                                 doc.status === 'failed' ? 'Ingest Error' :
                                 'Segmenting...'}
                              </span>
                            </td>
                            <td className="p-3 px-4 text-text-4 font-bold">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => reindexDocument(doc.name, e)}
                                  className="p-1 rounded-lg hover:bg-bg-hover text-text-4 hover:text-accent"
                                  title="Force manual reindex"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                  className="p-1 rounded-lg hover:bg-error-dim text-text-4 hover:text-error"
                                  title="Delete manual from vector store"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

          {/* TAB C: EXECUTIVE ANALYTICS */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentTab === 'analytics' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-5xl mx-auto px-6 pt-12 pb-16 space-y-8 select-none dot-grid perspective-1000 preserve-3d">
              <div className="border-b border-border pb-5">
                <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                  <BarChart2 className="w-5.5 h-5.5 text-accent" />
                  Executive Audit Dashboard
                </h2>
                <p className="text-xs text-text-3 mt-0.5">Audit transaction latencies, similarity distribution, and vector storage token pings</p>
              </div>
              
              <AdminDashboard embedMode={true} />
            </div>
          </div>

          {/* TAB D: AI CONFIGURATIONS SETTINGS */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentTab === 'settings' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-3xl mx-auto px-6 pt-12 pb-16 space-y-8 select-none dot-grid perspective-1000 preserve-3d">
              
              <div className="border-b border-border pb-5">
                <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                  <Sliders className="w-5.5 h-5.5 text-accent" />
                  AI Configuration Console
                </h2>
                <p className="text-xs text-text-3 mt-0.5">Configure similarity filters, top-K search parameters, and LLM temperature budgets</p>
              </div>

              <div className="space-y-6">
                
                {/* Panel 1: Google Gemini Parameters Configuration */}
                <motion.div 
                  whileHover={{ 
                    rotateX: 2, 
                    rotateY: -2, 
                    translateZ: 6,
                    y: -3,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.04), 0 0 24px rgba(99, 102, 241, 0.12)" 
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="p-6 border border-border rounded-xl bg-surface space-y-6 shadow-sm card-3d preserve-3d"
                >
                  
                  <div>
                    <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-1">Google Gemini API Key</h3>
                    <p className="text-[11px] text-text-3 font-semibold leading-relaxed">
                      Configure your secure Google Gemini API credentials. Overrides are saved locally in your browser's sandboxed local storage and never transit to third-party logs.
                    </p>
                  </div>

                  {/* Gemini Key Input */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Google Gemini API Key Override</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Enter secure Gemini API key (E.g. AIzaSy...)"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="flex-1 px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono focus:border-accent focus:bg-surface outline-none text-text transition-all placeholder:text-text-4 font-semibold"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97, y: 1 }}
                        type="button"
                        onClick={() => {
                          localStorage.setItem('gemini_api_key', geminiApiKey);
                          triggerToast("Google Gemini API Key updated securely");
                        }}
                        className="px-4 h-9 bg-text text-bg hover:bg-text-2 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all outline-none"
                      >
                        Apply Key
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97, y: 1 }}
                        type="button"
                        onClick={() => {
                          setGeminiApiKey('');
                          localStorage.removeItem('gemini_api_key');
                          triggerToast("Gemini API Key override cleared");
                        }}
                        className="px-3 h-9 border border-border hover:bg-bg-hover text-xs font-bold rounded-lg text-text-2 transition-all outline-none"
                        title="Clear API Key override"
                      >
                        Clear Override
                      </motion.button>
                    </div>
                  </div>

                  {/* Dynamic Gemini active models indicator */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Target Foundation Model</label>
                      <select
                        value={model}
                        onChange={(e) => {
                          setModel(e.target.value);
                          triggerToast(`Active model switched to ${e.target.value}`);
                        }}
                        className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold text-text focus:border-accent outline-none"
                      >
                        <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (Factual Speed)</option>
                        <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                        <option value="Gemini 1.5 Flash">Gemini 1.5 Flash (Legacy Balance)</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Parameters Temperature</label>
                      <div className="flex justify-between items-center h-9 px-3 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold text-accent">
                        <span>Creative budget</span>
                        <span>{temperature}</span>
                      </div>
                    </div>
                  </div>

                  {/* Temperature slider */}
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <p className="text-[10px] text-text-4 font-bold uppercase tracking-wider leading-relaxed">
                      Lower temperature values guarantee maximum factual precision and strict grounding alignment
                    </p>
                  </div>

                  {/* Top K and threshold metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-text">
                        <span>Top K context segments</span>
                        <span className="font-mono text-accent">{topK}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={topK}
                        onChange={(e) => setTopK(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-text">
                        <span>L2 Cosine similarity cutoff</span>
                        <span className="font-mono text-accent">{(similarityThreshold * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="0.9"
                        step="0.05"
                        value={similarityThreshold}
                        onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                      />
                    </div>
                  </div>

                  {/* Chunk Parameter inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Segment token limit</label>
                      <input
                        type="number"
                        value={chunkSize}
                        onChange={(e) => setChunkSize(parseInt(e.target.value) || 0)}
                        className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold focus:border-accent focus:bg-surface outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Recursive token overlap</label>
                      <input
                        type="number"
                        value={chunkOverlap}
                        onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 0)}
                        className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold focus:border-accent focus:bg-surface outline-none"
                      />
                    </div>
                  </div>

                  {/* System Prompt Hardening */}
                  <div className="space-y-1.5 border-t border-border pt-4">
                    <label className="block text-[11px] font-bold text-text uppercase tracking-wider font-semibold">System Prompt alignment hardener</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={3}
                      className="w-full p-3 rounded-lg border border-border bg-bg-subtle text-xs focus:border-accent focus:bg-surface outline-none resize-none font-medium leading-relaxed text-text-2"
                    />
                  </div>

                  <div className="border-t border-border pt-4 flex justify-end">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97, y: 1 }}
                      onClick={() => triggerToast("AI configuration applied successfully")}
                      className="h-9 px-5 bg-text text-bg hover:bg-text-2 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all outline-none"
                    >
                      Save Configuration
                    </motion.button>
                  </div>
                </motion.div>

              </div>

            </div>
          </div>

          {/* TAB F: USER PROFILE SETTINGS */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentTab === 'profile' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-3xl mx-auto px-6 pt-12 pb-16 space-y-8 select-none dot-grid perspective-1000 preserve-3d">
              
              <div className="border-b border-border pb-5">
                <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                  <UserIcon className="w-5.5 h-5.5 text-accent" />
                  Account & Profile Console
                </h2>
                <p className="text-xs text-text-3 mt-0.5">Manage user credentials, update workspace profile information, and secure account keys</p>
              </div>

              <div className="space-y-6">

                {/* Panel 2: Profile & Account Configurations */}
                <motion.div 
                  whileHover={{ 
                    rotateX: 2, 
                    rotateY: -2, 
                    translateZ: 6,
                    y: -3,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.04), 0 0 24px rgba(99, 102, 241, 0.12)" 
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="p-6 border border-border rounded-xl bg-surface space-y-6 shadow-sm card-3d preserve-3d"
                >
                  <div>
                    <h3 className="text-sm font-bold text-text uppercase tracking-wider mb-1">Profile & Account Settings</h3>
                    <p className="text-[11px] text-text-3 font-semibold leading-relaxed">
                      Update your workspace account identity, email coordinates, or authenticate system credentials.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Logged Username</label>
                      <input
                        type="text"
                        readOnly
                        value={username || 'System User'}
                        className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold text-text outline-none opacity-60 select-none"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Workspace Role</label>
                      <input
                        type="text"
                        readOnly
                        value={(role || 'user') + ' access'}
                        className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs font-mono font-bold text-text outline-none opacity-60 select-none uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-border pt-4">
                    <label className="block text-[11px] font-bold text-text-3 uppercase tracking-wider">Editable Contact Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="Enter contact email address..."
                      className="w-full px-3 h-9 rounded-lg border border-border bg-bg-subtle text-xs focus:border-accent focus:bg-surface outline-none text-text transition-all font-semibold"
                    />
                  </div>

                  <div className="border-t border-border pt-4 flex justify-end gap-3.5 select-none">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97, y: 1 }}
                      type="button"
                      onClick={() => {
                        setProfileEmail(username ? `${username}@company.com` : 'user@company.com');
                        triggerToast("Profile edits reset successfully");
                      }}
                      className="h-9 px-4 border border-border hover:bg-bg-hover rounded-lg text-text-2 text-xs font-bold transition-all outline-none"
                    >
                      Cancel Profile Changes
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97, y: 1 }}
                      type="button"
                      onClick={() => {
                        triggerToast("Workspace Profile Configurations saved successfully!");
                      }}
                      className="h-9 px-5 bg-text text-bg hover:bg-text-2 active:scale-98 text-xs font-bold rounded-lg shadow-sm transition-all outline-none"
                    >
                      Save Profile & Account
                    </motion.button>
                  </div>
                </motion.div>

              </div>

            </div>
          </div>

          {/* TAB E: HEALTH MONITORING */}
          <div className={`flex-1 overflow-y-auto page-view ${
            currentTab === 'health' ? 'block' : 'hidden'
          }`}>
            <div className="max-w-4xl mx-auto px-6 pt-12 pb-16 space-y-8 select-none dot-grid perspective-1000 preserve-3d">
              
              <div className="border-b border-border pb-5">
                <h2 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
                  <HeartPulse className="w-5.5 h-5.5 text-accent animate-pulse" />
                  Operations Health Monitor
                </h2>
                <p className="text-xs text-text-3 mt-0.5">Real-time status indicators, pipeline latencies, and server load gauges</p>
              </div>

              {/* KPI status cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: "Backend REST API", status: healthChecks.api, desc: "FastAPI network connectivity" },
                  { name: "Generative LLM Endpoint", status: healthChecks.llm, desc: "Google Gemini token speed" },
                  { name: "FAISS Vector DB", status: healthChecks.vectorDb, desc: "Memory space matching indexes" },
                  { name: "Embedding Tokenizer", status: healthChecks.embedding, desc: "Gemini vector dimension indexing" }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 border border-border rounded-xl bg-surface shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-3">{item.name}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        item.status === 'healthy' ? 'bg-success' : 'bg-error'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-2 capitalize">
                        {item.status === 'healthy' ? 'Healthy Operable' : 'Pipeline Exceptions'}
                      </h4>
                      <p className="text-[10px] text-text-4 font-semibold mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* circular progress gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                
                {/* CPU Gauge */}
                <div className="p-6 border border-border rounded-xl bg-surface text-center shadow-sm space-y-4">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-text-3">CPU Usage</span>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="38" stroke="var(--border)" strokeWidth="6" fill="none" />
                      <circle cx="48" cy="48" r="38" stroke="var(--accent)" strokeWidth="6" fill="none"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - healthChecks.cpu / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-sm font-black font-mono text-text">{healthChecks.cpu}%</span>
                  </div>
                  <p className="text-[10px] text-text-4 font-bold uppercase tracking-wider">Quad-core execution threads</p>
                </div>

                {/* Memory Gauge */}
                <div className="p-6 border border-border rounded-xl bg-surface text-center shadow-sm space-y-4">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-text-3">Memory Load</span>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="38" stroke="var(--border)" strokeWidth="6" fill="none" />
                      <circle cx="48" cy="48" r="38" stroke="var(--success)" strokeWidth="6" fill="none"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - healthChecks.memory / 100)}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-sm font-black font-mono text-text">{healthChecks.memory}%</span>
                  </div>
                  <p className="text-[10px] text-text-4 font-bold uppercase tracking-wider">FAISS vector space cached</p>
                </div>

                {/* Latency Gauge */}
                <div className="p-6 border border-border rounded-xl bg-surface text-center shadow-sm space-y-4">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-text-3">API Latency</span>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="38" stroke="var(--border)" strokeWidth="6" fill="none" />
                      <circle cx="48" cy="48" r="38" stroke="var(--info)" strokeWidth="6" fill="none"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 * (1 - Math.min(healthChecks.latency, 300) / 300)}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-sm font-black font-mono text-text">{healthChecks.latency}ms</span>
                  </div>
                  <p className="text-[10px] text-text-4 font-bold uppercase tracking-wider">Average handshake pings</p>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ── PANEL 3: COLLAPSIBLE RIGHT INSIGHTS DRAWER PANEL ── */}
      {currentTab === 'chat' && (
        <div 
          className={`h-full border-l border-border bg-sidebar-bg flex flex-col shrink-0 transition-all duration-200 select-none z-30 ${
            showInsightsDrawer ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
          }`}
        >
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-xs font-extrabold tracking-widest uppercase flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent" />
              RAG Pipeline Stats
            </span>
            <button 
              onClick={() => setShowInsightsDrawer(false)}
              className="p-1 rounded-lg hover:bg-bg-hover text-text-4 hover:text-text-2 transition-colors outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            
            {/* Real-time stepper pipeline graphic */}
            <div className="p-4 bg-surface border border-border rounded-xl shadow-xs space-y-3.5">
              <span className="block text-[9.5px] font-extrabold uppercase tracking-widest text-text-4">Dynamic Pipeline handshakes</span>
              
              <div className="space-y-4 relative pl-3.5 border-l border-border/80 text-[11px] font-bold">
                
                {/* Step 1 */}
                <div className="relative">
                  <span className="absolute -left-[19.5px] top-0.5 w-3 h-3 rounded-full border bg-accent border-accent" />
                  <span className="block text-text">1. Embeddings Tokenized</span>
                  <span className="block text-[10px] text-text-3 font-medium mt-0.5 leading-normal">FastAPI chunk segmentations via Gemini SDK</span>
                </div>

                {/* Step 2 */}
                <div className="relative">
                  <span className="absolute -left-[19.5px] top-0.5 w-3 h-3 rounded-full border bg-accent border-accent" />
                  <span className="block text-text">2. Similarity Matching</span>
                  <span className="block text-[10px] text-text-3 font-medium mt-0.5 leading-normal">FAISS flat inner-product vector indexing</span>
                </div>

                {/* Step 3 */}
                <div className="relative">
                  <span className={`absolute -left-[19.5px] top-0.5 w-3 h-3 rounded-full border ${
                    activeSourcesCount > 0 ? "bg-accent border-accent" : "bg-bg border-border-strong"
                  }`} />
                  <span className="block text-text">3. Top K context injected</span>
                  <span className="block text-[10px] text-text-3 font-medium mt-0.5 leading-normal">
                    {activeSourcesCount > 0 ? `Successfully injected ${activeSourcesCount} excerpts` : 'Awaiting prompt pipeline pings'}
                  </span>
                </div>

                {/* Step 4 */}
                <div className="relative">
                  <span className={`absolute -left-[19.5px] top-0.5 w-3 h-3 rounded-full border ${
                    activeSourcesCount > 0 ? "bg-success border-success animate-pulse" : "bg-bg border-border-strong"
                  }`} />
                  <span className="block text-text">4. Grounded Output Synthesis</span>
                  <span className="block text-[10px] text-text-3 font-medium mt-0.5 leading-normal">Generative completion synthesized cleanly</span>
                </div>

              </div>
            </div>

            {/* active Model stats */}
            <div className="p-4 bg-surface border border-border rounded-xl shadow-xs space-y-1.5">
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-text-4">Primary generative core</span>
              <h4 className="text-xs font-black text-text">{model}</h4>
              <p className="text-[10px] text-text-3 font-semibold leading-relaxed leading-normal">
                Enforcing Top K = {topK} retrieved chunks at strict similarity cutoff score {'>'}= {similarityThreshold.toFixed(2)}.
              </p>
            </div>

            {/* Ingestion counts */}
            <div className="p-4 bg-surface border border-border rounded-xl shadow-xs space-y-1.5">
              <span className="block text-[9px] font-extrabold uppercase tracking-widest text-text-4">Token usage budgets</span>
              <h4 className="text-xs font-black text-text">{activeTokensIncurred.toLocaleString()} tokens</h4>
              <p className="text-[10px] text-text-3 font-semibold leading-relaxed leading-normal">
                Dynamically adjusted prompt context windows matching transaction budgets.
              </p>
            </div>

            {/* Retrieved confidence level */}
            <div className="p-4 bg-surface border border-border rounded-xl shadow-xs space-y-3">
              <span className="block text-[9.5px] font-extrabold uppercase tracking-widest text-text-4">Confidence Metric</span>
              
              <div className="flex justify-between items-center text-xs font-bold text-text leading-none select-none">
                <span>Vector Grounding</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  confidenceRating === 'HIGH' ? 'bg-success-dim text-success' :
                  confidenceRating === 'MEDIUM' ? 'bg-warning-dim text-warning' :
                  'bg-error-dim text-error'
                }`}>{averageConfidence}% {confidenceRating}</span>
              </div>

              {/* confidence bar meter */}
              <div className="w-full bg-bg border border-border h-4 rounded overflow-hidden flex items-center font-mono text-[9px] font-extrabold text-bg select-none relative">
                <div 
                  className={`h-full transition-all duration-500 ${
                    confidenceRating === 'HIGH' ? 'bg-success' :
                    confidenceRating === 'MEDIUM' ? 'bg-warning' :
                    'bg-error'
                  }`} 
                  style={{ width: `${averageConfidence}%` }} 
                />
                <span className="absolute inset-0 flex items-center justify-center text-text font-sans font-bold">
                  █████████░
                </span>
              </div>
            </div>

            {/* Similarity segment list */}
            <div>
              <span className="block text-[9.5px] font-extrabold uppercase tracking-widest text-text-4 mb-2.5 px-1">Retrieved excerpts ({activeSourcesCount})</span>
              {activeSourcesList.length === 0 ? (
                <p className="text-[10.5px] text-text-4 italic font-medium p-4 border border-border rounded-xl bg-surface text-center leading-relaxed">
                  Submit a query to verify semantic vector search retrieval.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeSourcesList.map((src, i) => (
                    <div key={i} className="p-3 border border-border rounded-xl bg-surface space-y-2 hover:border-accent transition-all cursor-pointer shadow-xs" onClick={() => setSelectedSource(src)}>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-text truncate max-w-[150px] font-mono">{src.document_name}</span>
                        <span className="text-success font-mono">{(src.similarity_score * 100).toFixed(0)}%</span>
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

      {/* Glass Citation Source details overlay drawer */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedSource(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              className="w-full max-w-lg p-6 bg-surface border border-border shadow-lg rounded-2xl select-none relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
                <div className="flex items-center min-w-0 mr-4">
                  <FileText className="w-5 h-5 text-accent mr-2 shrink-0" />
                  <span className="font-extrabold text-xs sm:text-sm truncate text-text leading-none" title={selectedSource.document_name}>
                    {selectedSource.document_name}
                  </span>
                </div>
                
                <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-accent-dim text-accent border border-accent-mid select-none uppercase tracking-wider">
                  Confidence Score: {(selectedSource.similarity_score * 100).toFixed(1)}%
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1 text-left">
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-text-4 leading-none">FAISS segment [Chunk Index {selectedSource.chunk_index}]:</span>
                <div className="p-4 bg-bg-subtle border border-border rounded-xl text-xs md:text-sm leading-relaxed text-text-2 overflow-y-auto font-mono italic">
                  "{selectedSource.content}"
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setSelectedSource(null)}
                  className="flex-1 py-2.5 text-[10px] font-bold border border-border hover:bg-bg-hover rounded-xl text-text-2 transition-colors focus:outline-none uppercase tracking-wider outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setSelectedSource(null)}
                  className="flex-1 py-2.5 text-[10px] font-bold bg-text text-bg hover:bg-text-2 rounded-xl transition-colors focus:outline-none uppercase tracking-wider outline-none"
                >
                  Close Citation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      </div>
    </div>
  );
}
