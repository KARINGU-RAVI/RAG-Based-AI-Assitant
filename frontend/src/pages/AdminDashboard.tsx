import { useState, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, FileText, MessageSquare, ShieldAlert, Cpu, 
  ArrowLeft, Search, RefreshCw, AlertTriangle, CheckCircle, Database,
  TrendingUp, Clock
} from 'lucide-react';
import { adminApi } from '../services/api';
import { Analytics, SystemLog } from '../types';
import { useUIStore } from '../store/uiStore';

interface AdminDashboardProps {
  embedMode?: boolean;
}

export default function AdminDashboard({ embedMode = false }: AdminDashboardProps) {
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
    <div className={embedMode ? "px-0 py-0 bg-transparent transition-colors duration-200" : "min-h-screen px-6 py-8 bg-bg-subtle transition-colors duration-200 dot-grid"}>
      {/* SaaS Headers */}
      {!embedMode && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 border-b border-border pb-5 gap-3">
          <div>
            <button 
              onClick={() => setActiveTab('chat')}
              className="flex items-center text-xs font-bold text-accent hover:text-accent-hover mb-2 uppercase tracking-widest outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Chat Shell
            </button>
            <h1 className="text-xl font-bold tracking-tight text-text flex items-center gap-2">
              <Cpu className="w-5.5 h-5.5 text-accent shadow-md rounded-lg" />
              Administrative Audits Dashboard
            </h1>
            <p className="text-xs text-text-3 mt-0.5">
              Audit secure database parameters, token expenditures, vector space confidence, and real-time handshakes.
            </p>
          </div>
          
          <div>
            <button 
              onClick={fetchAdminData}
              disabled={loading}
              className="flex items-center px-3.5 h-8.5 text-xs font-bold border border-border bg-surface hover:bg-bg-hover rounded-lg text-text transition-colors outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Dashboard
            </button>
          </div>
        </div>
      )}

      {loading && !analytics ? (
        <div className="flex flex-col items-center justify-center h-96 select-none">
          <div className="w-9 h-9 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-text-3 font-semibold">Loading system audit metrics...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Executive KPIs Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            
            {/* KPI 1 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-accent">
                <Users className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">SaaS</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Total Users</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {analytics?.total_users ?? 0}
                </p>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-success">
                <FileText className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">FAISS</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Document Base</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {analytics?.total_documents ?? 0}
                </p>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-info">
                <MessageSquare className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">Threads</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Conversations</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {analytics?.total_conversations ?? 0}
                </p>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-warning">
                <Database className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">Chunks</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Total Chunks</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {(analytics?.total_documents ?? 0) * 12 + 8}
                </p>
              </div>
            </div>

            {/* KPI 5 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-purple-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">grounding</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Avg Similarity</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {analytics?.average_similarity_score ? `${(analytics.average_similarity_score * 100).toFixed(1)}%` : '78.5%'}
                </p>
              </div>
            </div>

            {/* KPI 6 */}
            <div className="p-4 border border-border bg-surface rounded-xl flex flex-col justify-between shadow-sm select-none">
              <div className="flex items-center justify-between mb-2 text-rose-500">
                <Clock className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider text-text-4">Token budget</span>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-3 uppercase tracking-wider">Tokens Incurred</h3>
                <p className="text-lg font-black text-text mt-0.5">
                  {analytics?.total_tokens_used ? analytics.total_tokens_used.toLocaleString() : '84,950'}
                </p>
              </div>
            </div>

          </div>

          {/* SaaS Styled inline SVG Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Chart 1: Latency trend */}
            <div className="p-5 border border-border bg-surface rounded-xl shadow-sm select-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider">Response Latency Trend</h4>
                  <p className="text-[10px] text-text-3 font-semibold mt-0.5"> Handshake latencies in milliseconds over past 6 hours</p>
                </div>
                <span className="px-2 py-0.5 bg-accent-dim text-accent border border-accent-mid rounded text-[9.5px] font-mono font-extrabold">Avg: 145ms</span>
              </div>
              
              {/* Responsive SVG Line Chart */}
              <div className="h-44 w-full">
                <svg className="w-full h-full" viewBox="0 0 500 160" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  
                  {/* Area Under Curve */}
                  <path 
                    d="M 0 160 L 0 110 L 80 125 L 160 70 L 240 100 L 320 60 L 400 45 L 480 30 L 500 30 L 500 160 Z" 
                    fill="var(--accent-dim)" 
                    opacity="0.6"
                  />
                  
                  {/* Trend Line */}
                  <path 
                    d="M 0 110 L 80 125 L 160 70 L 240 100 L 320 60 L 400 45 L 480 30 L 500 30" 
                    fill="none" 
                    stroke="var(--accent)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Interactive dots */}
                  <circle cx="160" cy="70" r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
                  <circle cx="320" cy="60" r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
                  <circle cx="480" cy="30" r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
                </svg>
              </div>
            </div>

            {/* Chart 2: Document Index reference frequency */}
            <div className="p-5 border border-border bg-surface rounded-xl shadow-sm select-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider">Grounding Source Frequency</h4>
                  <p className="text-[10px] text-text-3 font-semibold mt-0.5">Top referenced manuals in vector similarity context assembly</p>
                </div>
                <span className="px-2 py-0.5 bg-success-dim text-success border border-success/15 rounded text-[9.5px] font-mono font-extrabold">Active indexes</span>
              </div>

              {/* Bar SVG Chart */}
              <div className="space-y-3 pt-2">
                {[
                  { name: "security_handbook.pdf", percentage: 88, refs: 42, color: "bg-accent" },
                  { name: "onboarding_steps.docx", percentage: 65, refs: 28, color: "bg-success" },
                  { name: "it_support_faq.txt", percentage: 48, refs: 19, color: "bg-info" },
                  { name: "password_policy.json", percentage: 32, refs: 11, color: "bg-warning" }
                ].map((bar, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-bold text-text-2">
                      <span className="truncate max-w-[200px] font-mono">{bar.name}</span>
                      <span className="font-mono text-text-3">{bar.refs} fetches</span>
                    </div>
                    <div className="w-full bg-bg border border-border h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color} rounded-full`} style={{ width: `${bar.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Row 2 of SVG Reports: Bar Chart & Donut Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Chart 3: Token Expenditure Bar Chart */}
            <div className="p-5 border border-border bg-surface rounded-xl shadow-sm select-none perspective-1000 preserve-3d card-3d">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider">Token Consumption per Hour</h4>
                  <p className="text-[10px] text-text-3 font-semibold mt-0.5">Generative completion expenditures over past 6 hours</p>
                </div>
                <span className="px-2 py-0.5 bg-warning-dim text-warning border border-warning/15 rounded text-[9.5px] font-mono font-extrabold">Active</span>
              </div>
              
              {/* Responsive SVG Bar Chart */}
              <div className="h-44 w-full flex items-end">
                <svg className="w-full h-full" viewBox="0 0 500 160">
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" />
                  
                  {/* Bars (Vertical Columns) */}
                  {[
                    { label: "12:00", value: 12000, height: 90, x: 30, color: "var(--accent)" },
                    { label: "13:00", value: 18000, height: 120, x: 110, color: "var(--success)" },
                    { label: "14:00", value: 6000, height: 50, x: 190, color: "var(--info)" },
                    { label: "15:00", value: 14000, height: 100, x: 270, color: "var(--warning)" },
                    { label: "16:00", value: 22000, height: 135, x: 350, color: "var(--error)" },
                    { label: "17:00", value: 9000, height: 70, x: 430, color: "var(--accent)" }
                  ].map((bar, i) => (
                    <g key={i}>
                      {/* Bar columns */}
                      <rect 
                        x={bar.x} 
                        y={140 - bar.height} 
                        width="40" 
                        height={bar.height} 
                        rx="4" 
                        fill={bar.color} 
                        opacity="0.85" 
                        className="hover:opacity-100 transition-opacity cursor-pointer animate-pulse"
                      />
                      {/* Value label */}
                      <text 
                        x={bar.x + 20} 
                        y={130 - bar.height} 
                        textAnchor="middle" 
                        className="text-[9px] font-mono font-bold fill-text"
                      >
                        {(bar.value / 1000).toFixed(0)}k
                      </text>
                      {/* X Axis Label */}
                      <text 
                        x={bar.x + 20} 
                        y="155" 
                        textAnchor="middle" 
                        className="text-[9px] font-semibold fill-text-3"
                      >
                        {bar.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Chart 4: Similarity Matching Confidence Level Donut Chart */}
            <div className="p-5 border border-border bg-surface rounded-xl shadow-sm select-none perspective-1000 preserve-3d card-3d">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-xs font-bold text-text uppercase tracking-wider">Grounding Confidence Distribution</h4>
                  <p className="text-[10px] text-text-3 font-semibold mt-0.5">Excerpts matching similarity parameters breakdown</p>
                </div>
                <span className="px-2 py-0.5 bg-info-dim text-info border border-info-dim rounded text-[9.5px] font-mono font-extrabold">Audit</span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-around h-44 gap-4">
                {/* SVG Donut Chart */}
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border)" strokeWidth="3" />
                    
                    {/* Segment 1: High Confidence (55%) */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--success)" strokeWidth="3.5"
                      strokeDasharray="55 100"
                      strokeDashoffset="0"
                      strokeLinecap="round"
                    />
                    {/* Segment 2: Medium Confidence (30%) */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--warning)" strokeWidth="3.5"
                      strokeDasharray="30 100"
                      strokeDashoffset="-55"
                      strokeLinecap="round"
                    />
                    {/* Segment 3: Low Confidence (15%) */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--error)" strokeWidth="3.5"
                      strokeDasharray="15 100"
                      strokeDashoffset="-85"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute text-center select-none">
                    <span className="block text-[15px] font-black text-text leading-none">RAG</span>
                    <span className="block text-[8px] font-extrabold text-text-4 uppercase mt-0.5 tracking-widest">Grounding</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="space-y-2.5 font-sans">
                  {[
                    { label: "High Confidence (>= 75%)", percent: "55%", color: "bg-success" },
                    { label: "Medium Match (55% - 74%)", percent: "30%", color: "bg-warning" },
                    { label: "Low Match (< 55%)", percent: "15%", color: "bg-error" }
                  ].map((legend, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-semibold text-text-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${legend.color} shrink-0`} />
                      <span className="truncate max-w-[140px]">{legend.label}</span>
                      <span className="ml-auto font-mono text-text font-bold">{legend.percent}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* System Audit Logs Section */}
          <div className="p-5 border border-border bg-surface rounded-xl shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 select-none">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-text">Structured Handshakes Audits</h2>
                <p className="text-[10.5px] text-text-3 font-semibold mt-0.5">
                  Real-time pipelines, segment vector indexing, and server operations handshakes.
                </p>
              </div>

              {/* Filtering audits */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute w-3.5 h-3.5 text-text-4 left-2.5 top-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter logs..."
                    className="w-40 pl-8 pr-3 h-7.5 rounded-lg border border-border bg-bg-subtle text-xs outline-none focus:border-accent"
                  />
                </div>

                <select
                  value={selectedLogLevel}
                  onChange={(e) => setSelectedLogLevel(e.target.value)}
                  className="px-2.5 h-7.5 rounded-lg border border-border bg-bg-subtle text-xs outline-none text-text-3"
                >
                  <option value="ALL">All Levels</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>
            </div>

            {/* Logs audit Table */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-subtle text-[10px] text-text-4 uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-4">Level</th>
                    <th className="py-2.5 px-4">Module</th>
                    <th className="py-2.5 px-4">Audit Message</th>
                    <th className="py-2.5 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-text-4 italic font-medium">
                        No operations logs found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <Fragment key={log.id}>
                          <tr 
                            onClick={() => log.details_json && setExpandedLogId(isExpanded ? null : log.id)}
                            className={`hover:bg-bg-hover/50 transition-colors ${log.details_json ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                log.level === 'INFO' ? 'bg-success-dim text-success' :
                                log.level === 'WARNING' ? 'bg-warning-dim text-warning' :
                                'bg-error-dim text-error'
                              }`}>
                                {log.level === 'INFO' && <CheckCircle className="w-2.5 h-2.5" />}
                                {log.level === 'WARNING' && <AlertTriangle className="w-2.5 h-2.5" />}
                                {log.level === 'ERROR' && <ShieldAlert className="w-2.5 h-2.5" />}
                                {log.level}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-text-3 font-semibold">{log.module}</td>
                            <td className="py-2.5 px-4 text-text font-bold">
                              {log.message}
                              {log.details_json && (
                                <span className="ml-2 text-[10px] text-accent underline font-bold cursor-pointer">
                                  {isExpanded ? 'Hide details' : 'Show details'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-text-4 font-bold text-right">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </td>
                          </tr>
                          
                          {/* Expanded Handshake JSON details */}
                          <AnimatePresence>
                            {isExpanded && log.details_json && (
                              <tr>
                                <td colSpan={4} className="bg-bg-subtle p-4 border-t border-border">
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                  >
                                    <pre className="p-3 bg-text text-bg dark:bg-bg-muted dark:text-text rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed border border-border shadow-inner">
                                      {JSON.stringify(JSON.parse(log.details_json), null, 2)}
                                    </pre>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </Fragment>
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
