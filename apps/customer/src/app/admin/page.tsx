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
  Loader2
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../../lib/api';

interface DashboardStats {
  today: {
    revenue: number;
    printJobs: number;
    pages: number;
    successful: number;
    failed: number;
  };
  kiosks: {
    total: number;
    online: number;
  };
}

interface Job {
  id: string;
  displayId: string;
  status: string;
  printMethod: string;
  colorMode: string;
  sides?: string;
  printCode?: string;
  printCodeStatus?: string;
  copies: number;
  totalPages: number;
  totalPrice: number;
  fileName: string;
  kioskName: string;
  kioskLocation: string;
  paymentStatus: string;
  paymentAmount: number;
  createdAt: string;
  completedAt: string | null;
}

interface PricingRule {
  id: string;
  paperSize: string;
  colorMode: string;
  pricePerPage: number;
  isActive: boolean;
}

interface KioskInfo {
  id: string;
  displayId: string;
  name: string;
  location: string;
  status: string;
  printerStatus: string;
  printerName: string;
  isOnline: boolean;
  lastHeartbeat: string | null;
  cpu: number;
  ram: number;
  disk: number;
}

type Tab = 'dashboard' | 'jobs' | 'kiosks' | 'pricing';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [kiosks, setKiosks] = useState<KioskInfo[]>([]);
  const [pricing, setPricing] = useState<PricingRule[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingPrice, setEditingPrice] = useState<{ paperSize: string; colorMode: string; price: string } | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastLiveEvent, setLastLiveEvent] = useState<string | null>(null);

  // Add Kiosk Modal State
  const [showAddKiosk, setShowAddKiosk] = useState(false);
  const [newKioskId, setNewKioskId] = useState('');
  const [newKioskName, setNewKioskName] = useState('');
  const [newKioskLocation, setNewKioskLocation] = useState('');
  const [newKioskPrinter, setNewKioskPrinter] = useState('MF280 Series');
  const [addingKiosk, setAddingKiosk] = useState(false);
  const [kioskAddError, setKioskAddError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  // Fetch dashboard stats
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/dashboard`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (e) { console.error(e); }
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: jobsPage.toString(), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${getApiUrl()}/api/admin/jobs?${params}`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.data.jobs);
        setJobsTotal(data.data.pagination.total);
      }
    } catch (e) { console.error(e); }
  }, [jobsPage, statusFilter]);

  // Fetch kiosks
  const fetchKiosks = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/kiosks`);
      const data = await res.json();
      if (data.success) setKiosks(data.data);
    } catch (e) { console.error(e); }
  }, []);

  // Fetch pricing
  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/pricing`);
      const data = await res.json();
      if (data.success) setPricing(data.data);
    } catch (e) { console.error(e); }
  }, []);

  // ── Real-Time WebSocket Connection ──
  useEffect(() => {
    const socket = io(getApiUrl(), { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Admin WebSocket Connected');
      setLiveConnected(true);
      socket.emit('join_admin');
    });

    socket.on('disconnect', () => {
      console.log('❌ Admin WebSocket Disconnected');
      setLiveConnected(false);
    });

    // Real-time Stats Stream
    socket.on('admin_stats', (liveStats: DashboardStats) => {
      setStats(liveStats);
      setLastLiveEvent(`Stats updated: ₹${liveStats.today.revenue} revenue, ${liveStats.today.printJobs} jobs`);
    });

    // Real-time Job Events
    socket.on('job_updated', (updatedJob: any) => {
      setLastLiveEvent(`Job ${updatedJob.displayId} is now ${updatedJob.status}`);
      // Refresh jobs list instantly
      fetchJobs();
      fetchDashboard();
    });

    // Real-time Kiosk Heartbeat
    socket.on('kiosk_heartbeat', (kioskEvent: any) => {
      setKiosks(prev => prev.map(k => {
        if (k.id === kioskEvent.kioskId || k.displayId === kioskEvent.displayId) {
          return {
            ...k,
            isOnline: kioskEvent.isOnline !== undefined ? kioskEvent.isOnline : true,
            cpu: kioskEvent.cpu ?? k.cpu,
            ram: kioskEvent.ram ?? k.ram,
            disk: kioskEvent.disk ?? k.disk,
            printerStatus: kioskEvent.printerStatus ?? k.printerStatus,
            lastHeartbeat: kioskEvent.lastHeartbeat ?? new Date().toISOString(),
          };
        }
        return k;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchJobs, fetchDashboard]);

  // Initial Load + 5s background poll
  useEffect(() => {
    fetchDashboard();
    fetchKiosks();
    fetchPricing();
    const interval = setInterval(() => {
      fetchDashboard();
      fetchKiosks();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchDashboard, fetchKiosks, fetchPricing]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Update pricing
  const updatePricing = async (paperSize: string, colorMode: string, pricePerPage: number) => {
    try {
      await fetch(`${getApiUrl()}/api/admin/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperSize, colorMode, pricePerPage }),
      });
      fetchPricing();
      setEditingPrice(null);
    } catch (e) { console.error(e); }
  };

  // Create new kiosk
  const handleAddKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKioskId || !newKioskName || !newKioskLocation) return;
    setAddingKiosk(true);
    setKioskAddError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/kiosks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayId: newKioskId.trim().toUpperCase(),
          name: newKioskName.trim(),
          location: newKioskLocation.trim(),
          printerName: newKioskPrinter.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddKiosk(false);
        setNewKioskId('');
        setNewKioskName('');
        setNewKioskLocation('');
        fetchKiosks();
        fetchDashboard();
      } else {
        setKioskAddError(data.error || 'Failed to add kiosk');
      }
    } catch (err: any) {
      setKioskAddError(err?.message || 'Network error');
    } finally {
      setAddingKiosk(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-accent-green/20 text-accent-green border-accent-green/30';
      case 'PRINTING': return 'bg-xpos-500/20 text-xpos-300 border-xpos-500/40 animate-pulse';
      case 'SENDING': case 'QUEUED': return 'bg-accent-amber/20 text-accent-amber border-accent-amber/30';
      case 'PAID': case 'PAYMENT_PENDING': return 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30';
      case 'FAILED': case 'PRINT_FAILED': case 'PAYMENT_FAILED': return 'bg-accent-rose/20 text-accent-rose border-accent-rose/30';
      case 'CANCELLED': return 'bg-dark-500/20 text-dark-400 border-dark-500/30';
      default: return 'bg-dark-500/20 text-dark-300 border-dark-500/30';
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-white/10 bg-[#0c1024]/80 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xpos-500 to-xpos-700 flex items-center justify-center glow">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-display tracking-wide">XPOS Live Admin</h1>
                {/* Live WebSocket Indicator */}
                <div className="flex items-center gap-1.5 bg-accent-green/15 border border-accent-green/30 text-accent-green px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-accent-green animate-ping" />
                  <span>REAL-TIME LIVE</span>
                </div>
              </div>
              <p className="text-xs text-dark-400">Autonomous Self-Service Printing Control Center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastLiveEvent && (
              <span className="text-xs text-xpos-300 bg-xpos-500/10 border border-xpos-500/20 px-3 py-1 rounded-lg truncate max-w-xs animate-fade-in">
                ⚡ {lastLiveEvent}
              </span>
            )}
            <button
              onClick={() => { fetchDashboard(); fetchJobs(); fetchKiosks(); fetchPricing(); }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-dark-300 hover:text-white transition-all active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync
            </button>
          </div>
        </div>
      </header>

      {/* ── Navigation Tabs ── */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-1.5 bg-white/5 border border-white/10 rounded-2xl p-1.5 w-fit mb-8 shadow-inner">
          {([
            { id: 'dashboard', label: 'Overview', icon: BarChart3 },
            { id: 'jobs', label: 'Live Print Queue', icon: FileText },
            { id: 'kiosks', label: 'Kiosks & Hardware', icon: Printer },
            { id: 'pricing', label: 'Dynamic Pricing', icon: DollarSign },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === id
                  ? 'bg-xpos-600 text-white shadow-lg shadow-xpos-500/30'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 1: REAL-TIME DASHBOARD OVERVIEW */}
        {/* ════════════════════════════════════════════════ */}
        {tab === 'dashboard' && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Real-time Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Revenue */}
              <div className="glass-card p-6 rounded-3xl border border-accent-green/20 bg-gradient-to-br from-accent-green/10 via-transparent to-transparent relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-green/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-accent-green" />
                  </div>
                  <span className="flex items-center gap-1 text-accent-green text-xs font-bold bg-accent-green/10 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" /> TODAY
                  </span>
                </div>
                <p className="text-4xl font-bold text-white font-display">₹{stats.today.revenue}</p>
                <p className="text-dark-400 text-sm mt-1">Total Revenue Collected</p>
              </div>

              {/* Total Jobs */}
              <div className="glass-card p-6 rounded-3xl border border-xpos-500/20 bg-gradient-to-br from-xpos-600/10 via-transparent to-transparent relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-xpos-600/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-xpos-400" />
                  </div>
                  <span className="text-xpos-300 text-xs font-bold bg-xpos-500/10 px-2.5 py-1 rounded-full">
                    {stats.today.pages} pages printed
                  </span>
                </div>
                <p className="text-4xl font-bold text-white font-display">{stats.today.printJobs}</p>
                <p className="text-dark-400 text-sm mt-1">Total Print Jobs</p>
              </div>

              {/* Successful Prints */}
              <div className="glass-card p-6 rounded-3xl border border-accent-cyan/20 bg-gradient-to-br from-accent-cyan/10 via-transparent to-transparent relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-cyan/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-accent-cyan" />
                  </div>
                  <span className="text-accent-rose text-xs font-bold bg-accent-rose/10 px-2 py-1 rounded-full">
                    {stats.today.failed} failed
                  </span>
                </div>
                <p className="text-4xl font-bold text-white font-display">{stats.today.successful}</p>
                <p className="text-dark-400 text-sm mt-1">Successful Prints</p>
              </div>

              {/* Kiosks Online */}
              <div className="glass-card p-6 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-600/10 via-transparent to-transparent relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/20 flex items-center justify-center">
                    <Printer className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-accent-green text-xs font-bold bg-accent-green/10 px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /> LIVE
                  </span>
                </div>
                <p className="text-4xl font-bold text-white font-display">{stats.kiosks.online} / {stats.kiosks.total}</p>
                <p className="text-dark-400 text-sm mt-1">Active Kiosks Online</p>
              </div>
            </div>

            {/* Quick Live Control Shortcuts */}
            <div className="glass-card p-8 rounded-3xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-xpos-400" /> Real-time System Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setTab('jobs')}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-98 group"
                >
                  <FileText className="w-7 h-7 text-xpos-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-white text-base">Inspect Live Jobs Queue</p>
                  <p className="text-xs text-dark-400 mt-1">View active printing jobs & status</p>
                </button>
                <button
                  onClick={() => setTab('pricing')}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-98 group"
                >
                  <DollarSign className="w-7 h-7 text-accent-green mb-3 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-white text-base">Adjust Pricing Rules</p>
                  <p className="text-xs text-dark-400 mt-1">Change B&W / Color page rates in real-time</p>
                </button>
                <button
                  onClick={() => setTab('kiosks')}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-98 group"
                >
                  <Printer className="w-7 h-7 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-white text-base">Monitor Hardware Kiosks</p>
                  <p className="text-xs text-dark-400 mt-1">Check CPU, RAM & printer connection</p>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 2: LIVE PRINT QUEUE & JOBS */}
        {/* ════════════════════════════════════════════════ */}
        {tab === 'jobs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setJobsPage(1); }}
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white outline-none focus:border-xpos-500"
                >
                  <option value="" className="bg-[#0c1024]">All Print Statuses</option>
                  <option value="CREATED" className="bg-[#0c1024]">Created</option>
                  <option value="PAID" className="bg-[#0c1024]">Paid</option>
                  <option value="QUEUED" className="bg-[#0c1024]">Queued</option>
                  <option value="SENDING" className="bg-[#0c1024]">Sending</option>
                  <option value="PRINTING" className="bg-[#0c1024]">Printing (Active)</option>
                  <option value="COMPLETED" className="bg-[#0c1024]">Completed</option>
                  <option value="PRINT_FAILED" className="bg-[#0c1024]">Failed</option>
                </select>
                <span className="text-dark-400 text-sm font-medium">{jobsTotal} Total Jobs Recorded</span>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="glass-card rounded-3xl overflow-hidden border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-dark-400 bg-white/5">
                      <th className="px-5 py-4 font-bold">Job ID</th>
                      <th className="px-4 py-4 font-bold">6-Digit OTP Code</th>
                      <th className="px-4 py-4 font-bold">Document</th>
                      <th className="px-4 py-4 font-bold">Status</th>
                      <th className="px-4 py-4 font-bold">Format</th>
                      <th className="px-4 py-4 font-bold">Pages</th>
                      <th className="px-4 py-4 font-bold">Amount</th>
                      <th className="px-4 py-4 font-bold">Payment</th>
                      <th className="px-4 py-4 font-bold">Assigned Kiosk</th>
                      <th className="px-4 py-4 font-bold">Uploaded At</th>
                      <th className="px-4 py-4 font-bold">Printed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-xpos-300">{job.displayId}</td>
                        <td className="px-4 py-4 font-mono">
                          {job.printCode ? (
                            <span className="px-3 py-1.5 bg-xpos-500/25 border-2 border-xpos-400 text-white rounded-xl font-bold text-sm shadow-md tracking-wider inline-block">
                              {job.printCode}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-white/5 text-dark-500 rounded-lg text-xs font-mono">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-4 truncate max-w-[150px] text-white font-medium">{job.fileName || 'Document'}</td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-dark-300 text-xs">
                          {job.colorMode === 'BW' ? 'B&W' : 'Color'} • {job.sides === 'DOUBLE' ? 'Duplex' : 'Single'}
                        </td>
                        <td className="px-4 py-4 text-white font-medium">{job.totalPages}</td>
                        <td className="px-4 py-4 font-bold text-accent-green">₹{job.totalPrice}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${job.paymentStatus === 'PAID' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-amber/20 text-accent-amber'}`}>
                            {job.paymentStatus || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-dark-300 font-mono text-xs">
                          {job.kioskName ? `${job.kioskName} (MF280)` : 'Any Kiosk'}
                        </td>
                        <td className="px-4 py-4 text-dark-400 font-mono text-xs">{formatTime(job.createdAt)}</td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {job.completedAt ? (
                            <span className="text-accent-green font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {formatTime(job.completedAt)}
                            </span>
                          ) : job.status === 'PRINTING' ? (
                            <span className="text-accent-cyan font-semibold animate-pulse flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-ping" /> Printing now
                            </span>
                          ) : (
                            <span className="text-dark-500">Waiting for Kiosk</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-dark-400">No print jobs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 3: KIOSKS & HARDWARE MONITOR */}
        {/* ════════════════════════════════════════════════ */}
        {tab === 'kiosks' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-1">Kiosks & Hardware Monitor</h2>
                <p className="text-dark-400 text-sm">Manage multi-location kiosks and monitor printer readiness in real-time.</p>
              </div>
              <button
                onClick={() => setShowAddKiosk(true)}
                className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm font-bold shadow-lg shadow-xpos-500/20"
              >
                <Plus className="w-4 h-4" /> Add New Kiosk
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kiosks.map((kiosk) => (
                <div key={kiosk.id} className="glass-card p-6 rounded-3xl border border-white/10 hover:border-xpos-500/40 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kiosk.isOnline ? 'bg-accent-green/20' : 'bg-accent-rose/20'}`}>
                        <Printer className={`w-6 h-6 ${kiosk.isOnline ? 'text-accent-green' : 'text-accent-rose'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-lg text-white font-display">{kiosk.displayId}</p>
                        <p className="text-xs text-dark-400">{kiosk.name}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                      kiosk.isOnline ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' : 'bg-accent-rose/20 text-accent-rose border border-accent-rose/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${kiosk.isOnline ? 'bg-accent-green animate-pulse' : 'bg-accent-rose'}`} />
                      {kiosk.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Location</span>
                      <span className="text-white font-medium truncate max-w-[180px]">{kiosk.location}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Printer Status</span>
                      <span className={kiosk.printerStatus === 'READY' ? 'text-accent-green font-semibold' : 'text-accent-amber font-semibold'}>
                        {kiosk.printerStatus}
                      </span>
                    </div>
                    {kiosk.cpu !== null && (
                      <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs text-dark-400">
                        <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-xpos-400" /> CPU: {Math.round(kiosk.cpu)}%</span>
                        <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5 text-accent-cyan" /> RAM: {Math.round(kiosk.ram)}%</span>
                      </div>
                    )}
                    {kiosk.lastHeartbeat && (
                      <div className="flex justify-between items-center pt-1 text-xs text-dark-500">
                        <span>Last Heartbeat</span>
                        <span className="font-mono">{formatTime(kiosk.lastHeartbeat)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Kiosk Modal */}
            <AnimatePresence>
              {showAddKiosk && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="glass-card p-6 md:p-8 rounded-3xl border border-white/20 w-full max-w-md bg-[#0d1226] text-white shadow-2xl relative"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-xpos-500/20 flex items-center justify-center">
                          <Plus className="w-5 h-5 text-xpos-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-display font-bold text-white">Add New Kiosk</h3>
                          <p className="text-xs text-dark-400">Register a new physical printing station</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAddKiosk(false)}
                        className="text-dark-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleAddKiosk} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-dark-300 block mb-1.5">Kiosk Display ID</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. XPOS-002"
                          value={newKioskId}
                          onChange={(e) => setNewKioskId(e.target.value.toUpperCase())}
                          className="w-full bg-white/5 border border-white/10 focus:border-xpos-500 rounded-xl px-4 py-3 text-white font-mono font-bold text-sm outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-dark-300 block mb-1.5">Kiosk Name / Station</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Library 2nd Floor Kiosk"
                          value={newKioskName}
                          onChange={(e) => setNewKioskName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-xpos-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-dark-300 block mb-1.5">Physical Location</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Campus Block B, Room 204"
                          value={newKioskLocation}
                          onChange={(e) => setNewKioskLocation(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-xpos-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-dark-300 block mb-1.5">Connected Printer Model</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Canon MF280 Series"
                          value={newKioskPrinter}
                          onChange={(e) => setNewKioskPrinter(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 focus:border-xpos-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                        />
                      </div>

                      {kioskAddError && (
                        <p className="text-xs text-accent-rose font-medium mt-2">{kioskAddError}</p>
                      )}

                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowAddKiosk(false)}
                          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-dark-300 font-semibold text-sm transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addingKiosk}
                          className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-xpos-500/20"
                        >
                          {addingKiosk ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Kiosk'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* TAB 4: DYNAMIC PRICING MANAGER */}
        {/* ════════════════════════════════════════════════ */}
        {tab === 'pricing' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-1">Dynamic Pricing Controls</h2>
              <p className="text-dark-400 text-sm">Changes made here take effect across all kiosks and customer apps instantly in real-time.</p>
            </div>

            <div className="space-y-4">
              {pricing.map((rule) => (
                <div key={rule.id} className="glass-card p-6 rounded-3xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg text-white">
                      {rule.paperSize} — {rule.colorMode === 'BW' ? 'Black & White' : 'Full Color'}
                    </p>
                    <p className="text-xs text-dark-400 mt-0.5">{rule.isActive ? 'Active pricing rule' : 'Disabled'}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    {editingPrice && editingPrice.paperSize === rule.paperSize && editingPrice.colorMode === rule.colorMode ? (
                      <div className="flex items-center gap-2">
                        <span className="text-dark-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={editingPrice.price}
                          onChange={(e) => setEditingPrice({ ...editingPrice, price: e.target.value })}
                          className="w-20 bg-white/10 border border-xpos-500 rounded-xl px-3 py-2 text-white font-bold text-center outline-none"
                          autoFocus
                        />
                        <span className="text-dark-400 text-xs font-semibold">/page</span>
                        <button
                          onClick={() => updatePricing(rule.paperSize, rule.colorMode, parseFloat(editingPrice.price))}
                          className="px-4 py-2 bg-xpos-600 hover:bg-xpos-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPrice(null)}
                          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-dark-400 rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="text-3xl font-bold font-display text-accent-green">₹{rule.pricePerPage}</p>
                          <p className="text-xs text-dark-500">per page</p>
                        </div>
                        <button
                          onClick={() => setEditingPrice({ paperSize: rule.paperSize, colorMode: rule.colorMode, price: rule.pricePerPage.toString() })}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-dark-300 hover:text-white transition-all active:scale-95"
                        >
                          Edit Rate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
