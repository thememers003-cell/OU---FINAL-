'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Printer,
  DollarSign,
  FileText,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Radio,
  Wifi,
  Activity,
  Cpu,
  HardDrive,
  Plus,
  X,
  MapPin,
  Loader2,
  Trash2,
  Ban,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Sliders,
  Download,
  Eye,
  Layers,
  FileCheck,
  Zap,
  Power
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../../lib/api';

interface DashboardStats {
  today: {
    revenue: number;
    allTimeRevenue: number;
    printJobs: number;
    pages: number;
    successful: number;
    failed: number;
    cancelled: number;
    activeCodes: number;
  };
  kiosks: {
    total: number;
    online: number;
  };
}

interface PrintJob {
  id: string;
  displayId: string;
  status: string;
  printMethod: string;
  colorMode: string;
  copies: number;
  totalPages: number;
  totalPrice: number;
  sides: string;
  printCode: string | null;
  printCodeStatus: string | null;
  printCodeExpiresAt: string | null;
  fileName: string;
  fileSize?: number;
  kioskName?: string;
  kioskLocation?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  paymentOrderId?: string;
  createdAt: string;
  completedAt?: string;
}

interface KioskInfo {
  id: string;
  displayId: string;
  name: string;
  location: string;
  status: string;
  printerStatus: string;
  printerName: string;
  totalJobsServed: number;
  lastHeartbeat: string;
  isOnline: boolean;
  paperLevel: number;
  tonerLevel: number;
  cpu: number;
  ram: number;
  disk: number;
  appVersion: string;
}

interface PricingRule {
  id?: string;
  paperSize: string;
  colorMode: string;
  pricePerPage: number;
  isActive: boolean;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'kiosks' | 'pricing' | 'logs'>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [kiosks, setKiosks] = useState<KioskInfo[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [showAddKioskModal, setShowAddKioskModal] = useState(false);
  const [newKioskDisplayId, setNewKioskDisplayId] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newKioskLocation, setNewKioskLocation] = useState('');
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // ── Show Temporary Notification ──
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // ── Fetch All Admin Data ──
  const fetchData = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const [statsRes, jobsRes, kiosksRes, pricingRes, logsRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/dashboard`).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/api/admin/jobs?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/api/admin/kiosks`).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/api/pricing`).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/api/admin/audit-logs`).then(r => r.json()).catch(() => ({})),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (jobsRes.success) setJobs(jobsRes.data?.jobs || []);
      if (kiosksRes.success) setKiosks(kiosksRes.data || []);
      if (pricingRes.success) setPricingRules(pricingRes.data || []);
      if (logsRes.success) setAuditLogs(logsRes.data || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── WebSocket Real-Time Listener ──
  useEffect(() => {
    const socket = io(getApiUrl(), { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsLiveConnected(true);
      socket.emit('join_admin');
    });

    socket.on('disconnect', () => setIsLiveConnected(false));
    socket.on('job_updated', () => fetchData());
    socket.on('job_update', () => fetchData());

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  // ── Action Handlers ──
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this print job and revoke its code?')) return;
    setActionLoading(jobId);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Job cancelled successfully');
        fetchData();
        setSelectedJob(null);
      } else {
        showToast(data.error || 'Failed to cancel job', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeCode = async (code: string) => {
    if (!confirm(`Revoke 6-digit release code ${code}?`)) return;
    setActionLoading(code);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/codes/${code}/revoke`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Code ${code} revoked`);
        fetchData();
      } else {
        showToast(data.error || 'Failed to revoke code', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendCode = async (code: string) => {
    setActionLoading(code);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/codes/${code}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 24 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Code extended by +24 Hours`);
        fetchData();
      } else {
        showToast(data.error || 'Failed to extend code', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleKioskStatus = async (kioskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    setActionLoading(kioskId);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/kiosks/${kioskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Kiosk status set to ${nextStatus}`);
        fetchData();
      } else {
        showToast(data.error || 'Failed to update kiosk status', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRebootKiosk = async (kioskId: string, displayId: string) => {
    if (!confirm(`Send remote reboot command to Station ${displayId}?`)) return;
    setActionLoading(kioskId);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/kiosks/${kioskId}/reboot`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Reboot signal sent to Station ${displayId}`);
      } else {
        showToast(data.error || 'Failed to reboot kiosk', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKioskDisplayId.trim()) return;
    setActionLoading('add-kiosk');
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/kiosks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId: newKioskDisplayId.trim().toUpperCase(),
          name: newKioskName.trim() || `XPOS Station ${newKioskDisplayId.trim().toUpperCase()}`,
          location: newKioskLocation.trim() || 'Main Hall',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Kiosk ${newKioskDisplayId.toUpperCase()} added successfully!`);
        setShowAddKioskModal(false);
        setNewKioskDisplayId('');
        setNewKioskName('');
        setNewKioskLocation('');
        fetchData();
      } else {
        showToast(data.error || 'Failed to add kiosk', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdatePrice = async (paperSize: string, colorMode: string, newPrice: number) => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperSize, colorMode, pricePerPage: newPrice }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Price updated to ₹${newPrice}/page`);
        fetchData();
      } else {
        showToast(data.error || 'Failed to update pricing', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    }
  };

  const handleEmergencyFlush = async () => {
    setActionLoading('emergency-flush');
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/queue/flush`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'All print queues flushed!', 'success');
        setShowEmergencyModal(false);
        fetchData();
      } else {
        showToast(data.error || 'Failed to flush queue', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const exportJobsCSV = () => {
    if (jobs.length === 0) return;
    const headers = ['Display ID', 'Status', 'File Name', 'Pages', 'Price (INR)', 'Code', 'Kiosk', 'Date'];
    const rows = jobs.map(j => [
      j.displayId,
      j.status,
      `"${j.fileName.replace(/"/g, '""')}"`,
      j.totalPages,
      j.totalPrice,
      j.printCode || 'N/A',
      j.kioskName || 'N/A',
      j.createdAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `XPOS_Jobs_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> COMPLETED</span>;
      case 'PRINTING':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse"><Printer className="w-3.5 h-3.5" /> PRINTING</span>;
      case 'QUEUED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="w-3.5 h-3.5" /> CODE ACTIVE</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-500/10 text-slate-400 border border-slate-500/20"><Ban className="w-3.5 h-3.5" /> CANCELLED</span>;
      case 'FAILED':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-400 border border-rose-500/20"><XCircle className="w-3.5 h-3.5" /> FAILED</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 font-sans selection:bg-blue-500 selection:text-white pb-20">
      {/* ── Top Super Admin Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-[#0d1527]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-white tracking-tight">XPOS SUPER ADMIN</h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
                  Control Center
                </span>
              </div>
              <p className="text-xs text-slate-400">Enterprise Cloud Fleet & Print Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live WebSocket Status Pulse */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              isLiveConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{isLiveConnected ? 'Cloud WebSockets: LIVE' : 'Reconnecting...'}</span>
            </div>

            {/* Emergency Stop Button */}
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-black transition-all active:scale-95 shadow-sm"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>EMERGENCY STOP</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Toast Notification ── */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-18 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            }`}
          >
            {actionMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <span>{actionMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-6 space-y-6">
        {/* ── High-Level Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          <div className="bg-[#131b2e] border border-slate-800 p-5 rounded-3xl relative overflow-hidden shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Today's Revenue</span>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-white mb-1">
              ₹{stats?.today.revenue || 0}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-bold">All-time: ₹{stats?.today.allTimeRevenue || 0}</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Active 6-Digit Codes */}
          <div className="bg-[#131b2e] border border-slate-800 p-5 rounded-3xl relative overflow-hidden shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Active Release Codes</span>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-400 mb-1">
              {stats?.today.activeCodes || 0} <span className="text-sm font-bold text-slate-400">Ready</span>
            </div>
            <div className="text-xs text-slate-400">Valid 24h for customer release</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Completed Prints */}
          <div className="bg-[#131b2e] border border-slate-800 p-5 rounded-3xl relative overflow-hidden shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Prints Delivered</span>
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-blue-400 mb-1">
              {stats?.today.successful || 0} <span className="text-sm font-bold text-slate-400">({stats?.today.pages || 0} pgs)</span>
            </div>
            <div className="text-xs text-slate-400">{stats?.today.printJobs || 0} total requests created today</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Kiosk Fleet */}
          <div className="bg-[#131b2e] border border-slate-800 p-5 rounded-3xl relative overflow-hidden shadow-lg">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Kiosk Stations</span>
              <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Radio className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl font-black text-indigo-400 mb-1">
              {kiosks.filter(k => k.status === 'ACTIVE').length} / {kiosks.length}
            </div>
            <div className="text-xs text-slate-400">Stations Active in Cloud Fleet</div>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          {[
            { id: 'overview', label: '📊 Control Overview' },
            { id: 'jobs', label: '🖨️ Jobs & 6-Digit Codes' },
            { id: 'kiosks', label: '🖥️ Kiosk Stations Fleet' },
            { id: 'pricing', label: '💰 Dynamic Pricing Matrix' },
            { id: 'logs', label: '📜 Live Audit Logs' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-[#131b2e] text-slate-400 hover:text-white border border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB 1 & 2: JOBS & CODES MANAGEMENT ── */}
        {(activeTab === 'overview' || activeTab === 'jobs') && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-[#131b2e] border border-slate-800 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Job ID (XP-000001), Document Name, or 6-Digit Code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Filter Status:</span>
                {['ALL', 'QUEUED', 'PRINTING', 'COMPLETED', 'CANCELLED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}

                <button
                  onClick={exportJobsCSV}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all ml-2 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="bg-[#131b2e] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead className="bg-[#0e1628] text-slate-400 font-bold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Job ID / File</th>
                      <th className="p-4">6-Digit Code</th>
                      <th className="p-4">Settings</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Kiosk</th>
                      <th className="p-4">Time</th>
                      <th className="p-4 text-right">Super Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
                          <span>Loading print queue & live codes...</span>
                        </td>
                      </tr>
                    ) : jobs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-400">
                          No print jobs found matching filters.
                        </td>
                      </tr>
                    ) : (
                      jobs.map(job => (
                        <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-mono font-black text-white text-sm">{job.displayId}</div>
                            <div className="text-slate-400 text-xs truncate max-w-[180px] font-medium" title={job.fileName}>
                              {job.fileName}
                            </div>
                          </td>
                          <td className="p-4">
                            {job.printCode ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-base text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
                                  {job.printCode}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">None</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-300">{job.totalPages} pgs • {job.colorMode}</div>
                            <div className="text-slate-500 text-[11px]">{job.copies} copy • {job.sides}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-emerald-400">₹{job.totalPrice}</div>
                            <div className="text-[10px] text-slate-500 uppercase">{job.paymentStatus || 'PAID'}</div>
                          </td>
                          <td className="p-4">
                            {getStatusBadge(job.status)}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-slate-300">{job.kioskName || 'Any Kiosk'}</span>
                          </td>
                          <td className="p-4 text-slate-400 text-xs font-mono">
                            {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Inspect */}
                              <button
                                onClick={() => setSelectedJob(job)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 transition-all"
                                title="Inspect Job Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Cancel Active Job */}
                              {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => handleCancelJob(job.id)}
                                  disabled={actionLoading === job.id}
                                  className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all active:scale-95"
                                  title="Cancel Print Job"
                                >
                                  {actionLoading === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                </button>
                              )}

                              {/* Extend 6-digit Code */}
                              {job.printCode && job.status === 'QUEUED' && (
                                <button
                                  onClick={() => handleExtendCode(job.printCode!)}
                                  disabled={actionLoading === job.printCode}
                                  className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all active:scale-95"
                                  title="Extend Code (+24 Hours)"
                                >
                                  <Clock className="w-4 h-4" />
                                </button>
                              )}
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
        )}

        {/* ── TAB 3: KIOSK FLEET MANAGEMENT ── */}
        {activeTab === 'kiosks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Kiosk Stations & Hardware Fleet</h2>
                <p className="text-slate-400 text-xs">Monitor paper levels, toner, hardware health, and maintenance modes</p>
              </div>
              <button
                onClick={() => setShowAddKioskModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs md:text-sm shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Kiosk Station</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {kiosks.map(kiosk => (
                <div
                  key={kiosk.id}
                  className={`bg-[#131b2e] border rounded-3xl p-6 space-y-5 transition-all shadow-xl ${
                    kiosk.status === 'ACTIVE' ? 'border-slate-800' : 'border-amber-500/40 bg-[#161a28]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-white">{kiosk.displayId}</h3>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          kiosk.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {kiosk.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{kiosk.name} • {kiosk.location}</p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-800 text-blue-400">
                      <Printer className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Printer Telemetry */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-[#0a0f1d] p-3.5 rounded-2xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Printer Engine</span>
                      <span className="text-white font-black truncate block">{kiosk.printerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase">Hardware Status</span>
                      <span className="text-emerald-400 font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {kiosk.printerStatus}
                      </span>
                    </div>
                  </div>

                  {/* Gauges (Paper & Toner) */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">Paper Tray</span>
                        <span className="text-blue-400">{kiosk.paperLevel}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${kiosk.paperLevel}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">Toner Cartridge</span>
                        <span className="text-purple-400">{kiosk.tonerLevel}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${kiosk.tonerLevel}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleKioskStatus(kiosk.id, kiosk.status)}
                      disabled={actionLoading === kiosk.id}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                        kiosk.status === 'ACTIVE'
                          ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{kiosk.status === 'ACTIVE' ? 'Set Maintenance' : 'Set Active'}</span>
                    </button>

                    <button
                      onClick={() => handleRebootKiosk(kiosk.id, kiosk.displayId)}
                      disabled={actionLoading === kiosk.id}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                      title="Remote Reboot"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: DYNAMIC PRICING MATRIX ── */}
        {activeTab === 'pricing' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-[#131b2e] border border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-black text-white">Dynamic Pricing Matrix</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Adjust per-page printing rates in real time. Changes take effect instantly across all customer devices and kiosks.
                </p>
              </div>

              <div className="space-y-4">
                {/* Black & White A4 */}
                <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-white">
                      B&W
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base">Black & White (A4)</h4>
                      <p className="text-xs text-slate-400">Standard monochrome print</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={pricingRules.find(r => r.colorMode === 'BW')?.pricePerPage || 2}
                      onBlur={(e) => handleUpdatePrice('A4', 'BW', Number(e.target.value))}
                      className="w-20 bg-[#131b2e] border border-blue-500 rounded-xl px-3 py-2 text-center text-lg font-black text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-500">/ page</span>
                  </div>
                </div>

                {/* Color A4 */}
                <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center font-black text-white">
                      CLR
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base">Full Color (A4)</h4>
                      <p className="text-xs text-slate-400">High-resolution vibrant color print</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      defaultValue={pricingRules.find(r => r.colorMode === 'COLOR')?.pricePerPage || 10}
                      onBlur={(e) => handleUpdatePrice('A4', 'COLOR', Number(e.target.value))}
                      className="w-20 bg-[#131b2e] border border-blue-500 rounded-xl px-3 py-2 text-center text-lg font-black text-white focus:outline-none"
                    />
                    <span className="text-xs text-slate-500">/ page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: AUDIT LOGS ── */}
        {activeTab === 'logs' && (
          <div className="bg-[#131b2e] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-white">System & Security Audit Trail</h2>
            <div className="divide-y divide-slate-800/80">
              {auditLogs.length === 0 ? (
                <p className="text-slate-400 text-xs py-6 text-center">No recent audit events logged.</p>
              ) : (
                auditLogs.map((log: any) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-blue-400 uppercase bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                        {log.action}
                      </span>
                      <span className="text-slate-300">{log.entityType} ({log.entityId || 'Global'})</span>
                    </div>
                    <span className="text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL: INSPECT JOB DETAILS ── */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#131b2e] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white">{selectedJob.displayId}</h3>
                  <p className="text-xs text-slate-400">Detailed Print Job Telemetry</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between bg-[#0a0f1d] p-3 rounded-xl">
                  <span className="text-slate-400 font-bold">Document Name</span>
                  <span className="text-white font-black">{selectedJob.fileName}</span>
                </div>
                <div className="flex justify-between bg-[#0a0f1d] p-3 rounded-xl">
                  <span className="text-slate-400 font-bold">6-Digit Release Code</span>
                  <span className="text-amber-400 font-mono font-black text-sm">{selectedJob.printCode || 'None'}</span>
                </div>
                <div className="flex justify-between bg-[#0a0f1d] p-3 rounded-xl">
                  <span className="text-slate-400 font-bold">Total Pages / Copies</span>
                  <span className="text-white font-bold">{selectedJob.totalPages} pages ({selectedJob.copies} copy)</span>
                </div>
                <div className="flex justify-between bg-[#0a0f1d] p-3 rounded-xl">
                  <span className="text-slate-400 font-bold">Amount Paid</span>
                  <span className="text-emerald-400 font-black">₹{selectedJob.totalPrice}</span>
                </div>
                <div className="flex justify-between bg-[#0a0f1d] p-3 rounded-xl">
                  <span className="text-slate-400 font-bold">Assigned Kiosk</span>
                  <span className="text-white font-bold">{selectedJob.kioskName || 'Any Kiosk Station'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                {selectedJob.status !== 'COMPLETED' && selectedJob.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleCancelJob(selectedJob.id)}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                  >
                    Cancel This Job & Invalidate Code
                  </button>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: ADD KIOSK STATION ── */}
      <AnimatePresence>
        {showAddKioskModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#131b2e] border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-white">Add Kiosk Station</h3>
                  <p className="text-xs text-slate-400">Register new physical touchpoint in cloud</p>
                </div>
                <button
                  onClick={() => setShowAddKioskModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddKiosk} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Kiosk ID (e.g. XPOS-002)</label>
                  <input
                    type="text"
                    required
                    placeholder="XPOS-002"
                    value={newKioskDisplayId}
                    onChange={(e) => setNewKioskDisplayId(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Station Name</label>
                  <input
                    type="text"
                    placeholder="Library Lobby Kiosk"
                    value={newKioskName}
                    onChange={(e) => setNewKioskName(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Physical Location</label>
                  <input
                    type="text"
                    placeholder="Building B, Floor 1"
                    value={newKioskLocation}
                    onChange={(e) => setNewKioskLocation(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={actionLoading === 'add-kiosk'}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {actionLoading === 'add-kiosk' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Save & Register Kiosk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddKioskModal(false)}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: EMERGENCY STOP & FLUSH QUEUE ── */}
      <AnimatePresence>
        {showEmergencyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e131d] border border-rose-500/50 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-300">EMERGENCY FLUSH</h3>
                  <p className="text-xs text-slate-400">Cancel all active printing jobs immediately</p>
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed">
                This will immediately cancel all queued and in-progress print jobs across all kiosks and invalidate all active release codes. Use in case of paper jams, hardware emergencies, or maintenance shutdowns.
              </p>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={handleEmergencyFlush}
                  disabled={actionLoading === 'emergency-flush'}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30"
                >
                  {actionLoading === 'emergency-flush' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>CONFIRM FLUSH ALL JOBS</span>
                </button>
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
