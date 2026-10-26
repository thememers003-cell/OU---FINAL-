'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  Hash,
  Printer,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowLeft,
  Sparkles,
  Delete,
  FileText,
  Check,
  Zap,
  Clock,
  Heart
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { getRandomCharmingLine, getRandomCompletionLine } from '../lib/charming-lines';
import { playKeySound } from '../lib/sound';

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const apiParam = params.get('api');
    if (apiParam) return apiParam;

    const hostname = window.location.hostname;
    if (hostname.includes('loca.lt')) {
      return 'https://xpos-api-cloud.loca.lt';
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('192.168.') && !envUrl.includes('localhost')) {
    return envUrl;
  }
  return 'https://xpos-printing-cloud.onrender.com';
}

function getAppUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const appParam = params.get('app');
    if (appParam) return appParam.replace(/\/$/, '');

    const { protocol, hostname, port, origin } = window.location;

    if (hostname.includes('loca.lt')) {
      return 'https://xpos-print-customer.loca.lt';
    }

    const envApp = process.env.NEXT_PUBLIC_APP_URL;
    if (envApp && !envApp.includes('xpos-printing-cloud-customer.vercel.app') && !envApp.includes('localhost')) {
      return envApp.replace(/\/$/, '');
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }

    if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)) {
      return `http://${hostname}:3000`;
    }

    if (port === '3002') {
      return `${protocol}//${hostname}:3000`;
    }

    return origin;
  }

  const envApp = process.env.NEXT_PUBLIC_APP_URL;
  if (envApp && !envApp.includes('xpos-printing-cloud-customer.vercel.app')) {
    return envApp.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

const DEFAULT_KIOSK_ID = process.env.NEXT_PUBLIC_KIOSK_ID || 'XPOS-001';
const IDLE_TIMEOUT = 60000;

type Screen = 'idle' | 'qr' | 'printing' | 'completed' | 'error';

interface PrintJobData {
  jobId: string;
  displayId: string;
  downloadUrl: string;
  totalPages: number;
  currentPage: number;
  fileName: string;
  colorMode: string;
  copies: number;
}

export default function KioskApp() {
  // Synchronously initialize kioskId from URL query param if present
  const [kioskId, setKioskId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('kiosk');
      if (param) return param.trim();
    }
    return DEFAULT_KIOSK_ID;
  });

  const kioskIdRef = useRef<string>(kioskId);
  kioskIdRef.current = kioskId;

  // Available kiosks list for station switcher
  const [allKiosks, setAllKiosks] = useState<any[]>([]);
  const [showStationPicker, setShowStationPicker] = useState(false);

  const [screen, setScreen] = useState<Screen>('idle');
  const [kioskInfo, setKioskInfo] = useState<any>(null);
  const [printerStatus, setPrinterStatus] = useState<string>('READY');
  const [jobData, setJobData] = useState<PrintJobData | null>(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // 🔒 Dynamic pairing token
  const [pairToken, setPairToken] = useState<string>(() => {
    return 'XPOS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36);
  });

  const rotatePairToken = useCallback(() => {
    const newToken = 'XPOS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString(36);
    setPairToken(newToken);
  }, []);

  // 5-Second Auto Return Countdown for Upload Screen
  const [qrCountdown, setQrCountdown] = useState(5);

  // Charming flirty quotes
  const [currentCharmingLine, setCurrentCharmingLine] = useState('');
  const [currentCompletionLine, setCurrentCompletionLine] = useState('');

  // Completed countdown timer (7 Seconds)
  const [countdown, setCountdown] = useState(7);

  const socketRef = useRef<Socket | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Read kiosk ID from URL query param on mount or URL change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('kiosk');
      if (param && param.trim() !== kioskId) {
        const clean = param.trim();
        setKioskId(clean);
        kioskIdRef.current = clean;
      }
    }
  }, []);

  // Load all available kiosks from backend for station switcher
  useEffect(() => {
    async function loadAllKiosks() {
      try {
        const res = await fetch(`${getApiUrl()}/api/kiosks`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAllKiosks(json.data);
        }
      } catch (e) {
        console.warn('Could not load kiosk fleet list:', e);
      }
    }
    loadAllKiosks();
  }, []);

  const handleSelectStation = (newId: string) => {
    const cleanId = newId.trim();
    setKioskId(cleanId);
    kioskIdRef.current = cleanId;
    setShowStationPicker(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('kiosk', cleanId);
      window.history.replaceState({}, '', url.toString());
    }
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_kiosk', { kioskId: cleanId });
    }
  };

  // ── 5-Second Auto Return from Scan QR Upload Screen ──
  useEffect(() => {
    if (screen !== 'qr') return;
    setQrCountdown(5);

    const interval = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setScreen('idle');
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen]);

  // ── Reset idle timer ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (screen !== 'idle' && screen !== 'printing' && screen !== 'completed') {
      idleTimerRef.current = setTimeout(() => {
        setScreen('idle');
        setJobData(null);
        setError('');
      }, IDLE_TIMEOUT);
    }
  }, [screen]);

  useEffect(() => { resetIdleTimer(); }, [screen, resetIdleTimer]);

  // ── Load kiosk info ──
  useEffect(() => {
    async function loadKiosk() {
      try {
        const res = await fetch(`${getApiUrl()}/api/kiosks/${kioskId}`);
        const data = await res.json();
        if (data.success) setKioskInfo(data.data);
      } catch (e) { console.error('Failed to load kiosk info:', e); }
    }
    loadKiosk();
  }, [kioskId]);

  // ── WebSocket connection ──
  useEffect(() => {
    const apiUrl = getApiUrl();
    console.log(`🔌 Initializing Kiosk connection to backend: ${apiUrl}`);
    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`🔌 Kiosk connected to XPOS Cloud as Station ${kioskIdRef.current}`);
      setIsConnected(true);
      socket.emit('join_kiosk', { kioskId: kioskIdRef.current });
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Kiosk disconnected from XPOS Cloud:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Kiosk socket connect_error, retrying:', err.message);
      setIsConnected(false);
    });

    // ⚡ Instant Real-Time Print Event from Customer "Print Now"
    socket.on('kiosk_paired_print', (data: any) => {
      console.log('⚡ Real-Time Print Signal Received:', data);
      const currentStation = (kioskIdRef.current || '').replace(/[\s-_]/g, '').toUpperCase();
      const targetStation = (data.targetKioskId || data.kioskId || '').replace(/[\s-_]/g, '').toUpperCase();

      if (targetStation && currentStation && targetStation !== currentStation) {
        console.log(`⏭️ Ignoring print signal for station "${targetStation}" (this station is "${currentStation}")`);
        return; // Guard: Only print if this signal was targeted for this station!
      }

      playKeySound('success');
      const totalPgs = data.totalPages || 1;
      setJobData({
        jobId: data.jobId,
        displayId: data.displayId,
        downloadUrl: data.downloadUrl || `${getApiUrl()}/api/files/download/${data.jobId}`,
        totalPages: totalPgs,
        currentPage: 1,
        fileName: data.fileName || 'Document.pdf',
        colorMode: data.colorMode || 'BW',
        copies: data.copies || 1,
      });

      setCurrentCharmingLine(getRandomCharmingLine());
      setScreen('printing');
      rotatePairToken();
      startPageProgressSimulation(totalPgs);

      // Complete print simulation and notify backend
      setTimeout(() => {
        handleJobCompleted(data.jobId);
      }, Math.max(5000, totalPgs * 1200));
    });

    // Receive new print job
    socket.on('new_job', (data: any) => {
      console.log('📥 New print job received:', data);
      const currentStation = (kioskIdRef.current || '').replace(/[\s-_]/g, '').toUpperCase();
      const targetStation = (data.targetKioskId || data.kioskId || data.job?.kioskId || '').replace(/[\s-_]/g, '').toUpperCase();

      if (targetStation && currentStation && targetStation !== currentStation) {
        console.log(`⏭️ Ignoring new_job for station "${targetStation}" (this station is "${currentStation}")`);
        return;
      }

      const totalPgs = data.totalPages || data.job?.totalPages || 1;
      setJobData({
        jobId: data.jobId || data.job?.id,
        displayId: data.displayId || data.job?.displayId,
        downloadUrl: data.downloadUrl || `${getApiUrl()}/api/files/download/${data.job?.file?.storageKey}`,
        totalPages: totalPgs,
        currentPage: 1,
        fileName: data.fileName || data.job?.file?.originalName || 'Document.pdf',
        colorMode: data.colorMode || data.job?.colorMode || 'BW',
        copies: data.copies || data.job?.copies || 1,
      });

      setCurrentCharmingLine(getRandomCharmingLine());
      setScreen('printing');
      rotatePairToken();
      startPageProgressSimulation(totalPgs);

      setTimeout(() => {
        handleJobCompleted(data.jobId || data.job?.id);
      }, Math.max(5000, totalPgs * 1200));
    });

    // Receive print job progress
    socket.on('job_progress', (data: any) => {
      setJobData((prev) => prev ? { ...prev, currentPage: data.currentPage || prev.currentPage } : null);
    });

    // Receive job completion
    socket.on('job_completed', () => {
      handleJobCompleted();
    });

    // Receive job failure
    socket.on('job_failed', (data: any) => {
      setError(data.error || 'Printing encountered an issue. Please try again.');
      setScreen('error');
    });

    // Receive printer status update
    socket.on('printer_status', (data: any) => {
      setPrinterStatus(data.status || 'READY');
    });

    return () => {
      socket.disconnect();
    };
  }, [rotatePairToken]);

  // ── Page Progress Simulation for Multi-page Jobs ──
  const startPageProgressSimulation = (totalPages: number) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (totalPages <= 1) return;

    let cur = 1;
    const intervalMs = Math.max(800, Math.floor(4500 / totalPages));

    progressIntervalRef.current = setInterval(() => {
      cur += 1;
      if (cur <= totalPages) {
        setJobData((prev) => prev ? { ...prev, currentPage: cur } : null);
      } else {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
    }, intervalMs);
  };

  // ── Handle Job Completed (Auto-redirect in 7 Seconds & Sync with Backend) ──
  const handleJobCompleted = (completedJobId?: string) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    playKeySound('success');
    setCurrentCompletionLine(getRandomCompletionLine());
    setScreen('completed');
    setCountdown(7);

    const activeJobId = completedJobId || jobData?.jobId;
    if (activeJobId) {
      // Sync completion with cloud backend so customer screen instantly transitions to PRINT COMPLETED 🎉
      fetch(`${getApiUrl()}/api/jobs/${activeJobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      }).catch((e) => console.warn('Completion sync to backend:', e));
    }

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    let currentSeconds = 7;
    countdownTimerRef.current = setInterval(() => {
      currentSeconds -= 1;
      setCountdown(currentSeconds);

      if (currentSeconds <= 0) {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setScreen('idle');
        setJobData(null);
        setError('');
        rotatePairToken();
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col justify-between select-none overflow-hidden p-6 md:p-10 relative">
      {/* Background Soft Ambient Light Spheres */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* ════════════════════════════════════════════════ */}
      {/* TOP HEADER & BRANDING */}
      {/* ════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3.5">
          <img src="/printbro_logo.png" alt="PrintBro" className="h-12 md:h-14 object-contain" />
        </div>

        {/* Station & Status Badge with Interactive Station Switcher */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowStationPicker(prev => !prev)}
              className="flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 shadow-sm text-xs font-bold text-slate-700 transition-all hover:border-blue-400 active:scale-95"
              title="Click to switch kiosk station"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Station: <strong className="text-blue-700 font-black">{kioskId}</strong></span>
              <span className="text-[10px] text-slate-400 ml-1">▾</span>
            </button>

            {/* Station dropdown */}
            {showStationPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400">
                  Select Kiosk Station
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {allKiosks.length > 0 ? (
                    allKiosks.map((k: any) => (
                      <button
                        key={k.id || k.displayId}
                        onClick={() => handleSelectStation(k.displayId)}
                        className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-all flex items-center justify-between hover:bg-blue-50 ${
                          k.displayId.toUpperCase() === kioskId.toUpperCase()
                            ? 'text-blue-700 bg-blue-50/70 font-black'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate">{k.displayId} ({k.name || 'Station'})</span>
                        {k.displayId.toUpperCase() === kioskId.toUpperCase() && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3.5 py-2 text-xs text-slate-400">Loading stations...</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-2 rounded-2xl text-xs font-bold shadow-sm">
            {isConnected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-rose-500" />}
            <span>{isConnected ? 'Online' : 'Reconnecting'}</span>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════ */}
      {/* MAIN SCREEN BODY */}
      {/* ════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col items-center justify-center py-6 relative z-10 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* ──────────────────────────────────────── */}
          {/* 1. IDLE / DIRECT STATION PRINT QR SCREEN */}
          {/* ──────────────────────────────────────── */}
          {screen === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full flex flex-col items-center text-center space-y-6"
            >
              <div className="space-y-1.5">
                <span className="text-xs md:text-sm font-black text-blue-700 bg-blue-100 px-4 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  Station {kioskId} • Zero-Touch Real-Time Printing
                </span>
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
                  Scan QR with Your Phone
                </h2>
                <p className="text-slate-600 font-medium text-xs md:text-base max-w-lg mx-auto">
                  Upload your documents, pay securely, and tap <strong className="text-blue-700">"Print Now"</strong> on your phone.
                </p>
              </div>

              {/* Prominent Direct Station QR Card */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                className="bg-white p-7 md:p-8 rounded-[36px] border-2 border-blue-300 shadow-2xl shadow-blue-500/10 flex flex-col items-center text-center space-y-5 max-w-md w-full"
              >
                <div className="p-4 bg-white rounded-3xl border-2 border-blue-200 shadow-inner flex items-center justify-center">
                  <QRCodeSVG
                    value={`${getAppUrl()}/remote?kiosk=${kioskId}`}
                    size={220}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: '/logo.svg',
                      x: undefined,
                      y: undefined,
                      height: 34,
                      width: 34,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <p className="font-mono text-xs text-blue-600 font-bold bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 inline-block">
                    {getAppUrl()}/remote?kiosk={kioskId}
                  </p>
                  <p className="text-slate-500 text-xs font-semibold">
                    Station: {kioskInfo?.name || `XPOS Station ${kioskId}`} • {kioskInfo?.location || 'Main Campus'}
                  </p>
                </div>

                <div className="w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 rounded-2xl py-3 px-4 border border-blue-200 flex items-center justify-center gap-2 text-xs font-bold text-blue-900">
                  <Printer className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span>Ready for Print • Instant output on phone trigger</span>
                </div>
              </motion.div>

              {/* 3 Steps Guide Footer */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-xl w-full text-center">
                <div className="bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-black text-blue-600 uppercase block mb-0.5">Step 1</span>
                  <p className="text-xs font-bold text-slate-800">Scan QR Code</p>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-black text-blue-600 uppercase block mb-0.5">Step 2</span>
                  <p className="text-xs font-bold text-slate-800">Upload & Pay</p>
                </div>
                <div className="bg-white/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-black text-emerald-600 uppercase block mb-0.5">Step 3</span>
                  <p className="text-xs font-bold text-slate-800">Tap "Print Now"</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────── */}
          {/* 4. PRINTING IN PROGRESS SCREEN */}
          {/* ──────────────────────────────────────── */}
          {screen === 'printing' && (
            <motion.div
              key="printing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md flex flex-col items-center text-center space-y-6"
            >
              {/* 💖 Charming Flirty Line Card */}
              {currentCharmingLine && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border-2 border-blue-200 shadow-md text-center flex flex-col items-center gap-1.5"
                >
                  <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-700 bg-white px-3 py-0.5 rounded-full border border-blue-200">
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                    <span>A Note For You</span>
                    <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                  </div>
                  <p className="text-slate-900 font-black text-sm md:text-base leading-snug">
                    "{currentCharmingLine}"
                  </p>
                </motion.div>
              )}

              {/* 🖨️ High-Impact Animated Paper Ejection & Laser Feed Card */}
              <div className="w-full bg-white p-8 rounded-3xl border-2 border-blue-300 shadow-2xl shadow-blue-500/10 flex flex-col items-center relative overflow-hidden space-y-4">
                {/* Printer Top Slot */}
                <div className="w-48 h-4 bg-slate-800 rounded-full shadow-inner relative z-10" />

                {/* Animated Sliding Paper Sheet */}
                <div className="relative w-44 h-56 bg-gradient-to-b from-blue-50 to-white rounded-2xl border-2 border-slate-300 shadow-lg p-3 flex flex-col justify-between overflow-hidden">
                  {/* Laser Scanning Line */}
                  <motion.div
                    animate={{ y: [0, 180, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-sm shadow-blue-500"
                  />

                  <div className="space-y-1.5 opacity-60">
                    <div className="h-2 bg-blue-600 rounded-full w-3/4" />
                    <div className="h-1.5 bg-slate-300 rounded-full w-full" />
                    <div className="h-1.5 bg-slate-200 rounded-full w-5/6" />
                    <div className="h-1.5 bg-slate-200 rounded-full w-4/5" />
                  </div>

                  <div className="flex items-center justify-center my-auto">
                    <Printer className="w-9 h-9 text-blue-600 animate-bounce" />
                  </div>

                  <div className="h-1.5 bg-slate-300 rounded-full w-2/3 opacity-60" />
                </div>

                <div className="w-full space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    🖨️ PRINTING IN PROGRESS
                  </h3>

                  {/* 📊 REAL-TIME PAGE-BY-PAGE COUNTER: e.g. "1/10 pages printed" */}
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-black">
                      <span className="text-slate-700">Printing Progress</span>
                      <span className="text-blue-700">
                        {jobData?.currentPage || 1} / {jobData?.totalPages || 1} Pages Printed
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                        initial={{ width: '10%' }}
                        animate={{
                          width: `${Math.min(100, Math.round(((jobData?.currentPage || 1) / (jobData?.totalPages || 1)) * 100))}%`
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>

                  <p className="text-slate-500 text-xs font-medium">
                    Please collect your pages as they emerge from the printer tray.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────── */}
          {/* 5. ORDER COMPLETED SCREEN (5-SECOND AUTO REDIRECT) */}
          {/* ──────────────────────────────────────── */}
          {screen === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md flex flex-col items-center text-center space-y-6"
            >
              {/* Success Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-2xl shadow-emerald-500/20"
              >
                <Check className="w-12 h-12 stroke-[3]" />
              </motion.div>

              <div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                  Printing Completed!
                </h2>
                <p className="text-slate-600 text-sm font-medium mt-1">
                  Please collect your pages from the printer tray below.
                </p>
              </div>

              {/* 💖 Warm / Flirty Completion Quote Card */}
              {currentCompletionLine && (
                <div className="w-full p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 shadow-md text-center flex flex-col items-center gap-1.5">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-white px-3 py-0.5 rounded-full border border-emerald-200">
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                    <span>Thank You!</span>
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  </div>
                  <p className="text-emerald-950 font-black text-base md:text-lg leading-snug">
                    "{currentCompletionLine}"
                  </p>
                </div>
              )}

              {/* ⏱️ Auto-Redirect 5s Countdown Notice */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 bg-slate-100 px-5 py-2.5 rounded-full">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Returning to home screen in <strong className="text-slate-900 font-black">{countdown}s</strong>...</span>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────── */}
          {/* 6. ERROR SCREEN */}
          {/* ──────────────────────────────────────── */}
          {screen === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md flex flex-col items-center text-center space-y-5"
            >
              <div className="w-20 h-20 rounded-full bg-rose-50 border-4 border-rose-500 flex items-center justify-center text-rose-600 shadow-lg">
                <XCircle className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900">Printing Issue</h2>
                <p className="text-rose-600 font-bold text-sm mt-1">{error || 'Something went wrong.'}</p>
              </div>

              <button
                onClick={() => {
                  playKeySound('tap');
                  setScreen('idle');
                }}
                className="py-3.5 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                Back to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-between text-xs font-bold text-slate-500 relative z-10 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <span>Print Bro Cloud v2.0</span>
          <span>•</span>
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Printer {printerStatus}
          </span>
        </div>
        <p className="text-slate-400">Powered by Print Bro Self-Service</p>
      </footer>
    </div>
  );
}
