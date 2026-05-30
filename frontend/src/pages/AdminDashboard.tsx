import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, FileText, MessageSquare, ShieldAlert, Cpu, 
  ArrowLeft, Search, RefreshCw, AlertTriangle, CheckCircle, Info, Database 
} from 'lucide-react';
import { adminApi } from '../services/api';
import { Analytics, SystemLog } from '../types';
import { useUIStore } from '../store/uiStore';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  
  const setActiveTab = useUIStore((state) => state.setActiveTab);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [analyticsData, logsData] = await Promise.all([
        adminApi.getAnalytics(),
        adminApi.getLogs(100)
      ]);
      setAnalytics(analyticsData);
      setLogs(logsData);
    } catch (err) {
      console.error("Failed to load administrative analytics data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.module.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLogLevel === 'ALL' || log.level === selectedLogLevel;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="min-h-screen px-6 py-8 bg-slate-50 dark:bg-[#080b11] transition-colors duration-300">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <button 
            onClick={() => setActiveTab('chat')}
            className="flex items-center text-xs font-semibold text-brand-500 hover:text-brand-600 mb-2 uppercase tracking-widest focus:outline-none"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Conversational Chat
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Cpu className="w-8 h-8 text-brand-500 mr-2 shadow-glow-indigo rounded-lg" />
            System Control Panel
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit system operations, database states, vector search indices, and API tokens
          </p>
        </div>
        
        <div className="mt-4 md:mt-0">
          <button 
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Control Panel
          </button>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading control dashboard analytics...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Aggregate Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Total Users */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-indigo-500">
                <Users className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Users</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.total_users ?? 0}
                </p>
              </div>
            </div>

            {/* Total Documents */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-emerald-500">
                <FileText className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Vector</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Knowledge Base</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.total_documents ?? 0}
                </p>
              </div>
            </div>

            {/* Total Conversations */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-cyan-500">
                <MessageSquare className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Threads</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Conversations</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.total_conversations ?? 0}
                </p>
              </div>
            </div>

            {/* Total Messages */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-violet-500">
                <Database className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Database</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Messages</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.total_messages ?? 0}
                </p>
              </div>
            </div>

            {/* Vector Similarity Average */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-amber-500">
                <ShieldAlert className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Precision</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Confidence Score</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.average_similarity_score ? `${(analytics.average_similarity_score * 100).toFixed(1)}%` : '0.0%'}
                </p>
              </div>
            </div>

            {/* Total Tokens Used */}
            <div className="p-5 glass-card rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 text-pink-500">
                <Cpu className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">API Budgets</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Tokens Ingested</h3>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {analytics?.total_tokens_used ? analytics.total_tokens_used.toLocaleString() : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* System Audit Logs Section */}
          <div className="p-6 glass-card rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Structured System Logs</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time database audits, uploading stages, and model exceptions
                </p>
              </div>

              {/* Logs Filtering Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="w-48 pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
                  />
                </div>

                {/* Level Selection */}
                <select
                  value={selectedLogLevel}
                  onChange={(e) => setSelectedLogLevel(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-slate-300"
                >
                  <option value="ALL" className="dark:bg-[#0f1422]">All Levels</option>
                  <option value="INFO" className="dark:bg-[#0f1422]">INFO</option>
                  <option value="WARNING" className="dark:bg-[#0f1422]">WARNING</option>
                  <option value="ERROR" className="dark:bg-[#0f1422]">ERROR</option>
                  <option value="CRITICAL" className="dark:bg-[#0f1422]">CRITICAL</option>
                </select>
              </div>
            </div>

            {/* Logs Table Area */}
            <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/80 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-900/20 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No system logs found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      
                      return (
                        <React.Fragment key={log.id}>
                          <tr 
                            onClick={() => log.details_json && setExpandedLogId(isExpanded ? null : log.id)}
                            className={`hover:bg-slate-100/20 dark:hover:bg-slate-800/20 transition-colors ${log.details_json ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.level === 'INFO' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                log.level === 'WARNING' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                'bg-red-500/10 text-red-600 dark:text-red-400'
                              }`}>
                                {log.level === 'INFO' && <CheckCircle className="w-2.5 h-2.5 mr-1" />}
                                {log.level === 'WARNING' && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                                {log.level === 'ERROR' && <ShieldAlert className="w-2.5 h-2.5 mr-1" />}
                                {log.level === 'CRITICAL' && <ShieldAlert className="w-2.5 h-2.5 mr-1" />}
                                {log.level}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400 font-bold">{log.module}</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                              {log.message}
                              {log.details_json && (
                                <span className="ml-2 text-[10px] text-brand-500 underline font-semibold">
                                  {isExpanded ? 'Hide details' : 'Show details'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {new Date(log.created_at).toLocaleString()}
                            </td>
                          </tr>
                          
                          {/* Expanded JSON Details Panel */}
                          <AnimatePresence>
                            {isExpanded && log.details_json && (
                              <tr>
                                <td colSpan={4} className="bg-slate-100/10 dark:bg-slate-900/30 p-4">
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                                      {JSON.stringify(JSON.parse(log.details_json), null, 2)}
                                    </pre>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
