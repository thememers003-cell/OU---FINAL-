'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Copy, ArrowLeft, Loader2, Camera, ShieldCheck, Check, Printer, Sparkles, Heart, MessageCircleHeart } from 'lucide-react';
import { generatePrintCode, getJob } from '../../lib/api';
import { getRandomCharmingLine, getRandomCompletionLine } from '../../lib/charming-lines';
import { playKeySound } from '../../lib/sound';

function CodeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const displayId = searchParams.get('displayId');

  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [jobStatus, setJobStatus] = useState<string>('QUEUED');
  const [printedKiosk, setPrintedKiosk] = useState<string | null>(null);

  // Random charming line for active code screen
  const [charmingLine, setCharmingLine] = useState<string>('');
  // Random celebration line for completed screen
  const [completionLine, setCompletionLine] = useState<string>('');

  useEffect(() => {
    setCharmingLine(getRandomCharmingLine());
    setCompletionLine(getRandomCompletionLine());
  }, []);

  const [resolvedJobId, setResolvedJobId] = useState<string | null>(jobId || null);

  // ── Load directly from API (Zero cross-job caching bugs) ──
  useEffect(() => {
    if (!jobId && !displayId) {
      setLoading(false);
      return;
    }

    const cacheKey = jobId || displayId || 'active';
    try {
      const cached = localStorage.getItem(`xpos_code_${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.code) {
          setCode(parsed.code);
          if (parsed.expiresAt) setExpiresAt(new Date(parsed.expiresAt));
          if (parsed.jobInfo) setJobInfo(parsed.jobInfo);
          if (parsed.jobId) setResolvedJobId(parsed.jobId);
          setLoading(false);
        }
      }
    } catch {}

    async function loadCode() {
      try {
        let activeJobId = jobId;

        if (!activeJobId && displayId) {
          const jobLookup = await getJob(displayId);
          if (jobLookup.success && jobLookup.data?.id) {
            activeJobId = jobLookup.data.id;
            setResolvedJobId(activeJobId);
            setJobInfo(jobLookup.data);
            setJobStatus(jobLookup.data.status);
          }
        }

        if (!activeJobId) {
          setError('Job not found for this code.');
          setLoading(false);
          return;
        }

        setResolvedJobId(activeJobId);

        const res = await generatePrintCode(activeJobId);
        if (res.success && res.data) {
          const verifiedCode = res.data.code;
          const verifiedExpires = new Date(res.data.expiresAt);

          if (verifiedCode) setCode(verifiedCode);
          setExpiresAt(verifiedExpires);
          if (res.data.status) setJobStatus(res.data.status);

          const jobRes = await getJob(activeJobId);
          const freshJobInfo = jobRes.success ? jobRes.data : null;
          if (freshJobInfo) {
            setJobInfo(freshJobInfo);
            setJobStatus(freshJobInfo.status);
            if (freshJobInfo.kiosk?.displayId) setPrintedKiosk(freshJobInfo.kiosk.displayId);
          }

          if (verifiedCode) {
            localStorage.setItem(`xpos_code_${cacheKey}`, JSON.stringify({
              code: verifiedCode,
              expiresAt: verifiedExpires.toISOString(),
              jobId: activeJobId,
              displayId: res.data.displayId || displayId,
              jobInfo: freshJobInfo,
              savedAt: new Date().toISOString(),
            }));
          }
        } else {
          const cached = localStorage.getItem(`xpos_code_${cacheKey}`);
          if (!cached) setError(res.error || 'Failed to fetch code');
        }
      } catch (err: any) {
        const cached = localStorage.getItem(`xpos_code_${cacheKey}`);
        if (!cached) setError(err?.message || 'Network error');
      } finally {
        setLoading(false);
      }
    }

    loadCode();
  }, [jobId, displayId]);

  // ── Real-time Job Status Polling & WebSocket Live Push ──
  useEffect(() => {
    const targetJobId = resolvedJobId || jobId || displayId;
    if (!targetJobId) return;

    let isSubscribed = true;
    const checkStatus = async () => {
      try {
        const res = await getJob(targetJobId);
        if (res.success && res.data && isSubscribed) {
          const currentStatus = res.data.status;
          setJobStatus(currentStatus);
          if (res.data.kiosk?.displayId) {
            setPrintedKiosk(res.data.kiosk.displayId);
          }
          if (res.data.file) {
            setJobInfo(res.data);
          }
          if (currentStatus === 'COMPLETED') {
            try {
              localStorage.removeItem(`xpos_code_${targetJobId}`);
            } catch {}
          }
        }
      } catch {}
    };

    // Polling every 1 second for ultra-fast customer screen updates
    const interval = setInterval(checkStatus, 1000);
    checkStatus();

    // WebSocket listener for instant zero-latency push
    let socket: any = null;
    try {
      const { connectSocket } = require('../../lib/socket');
      socket = connectSocket();
      socket.on('job_update', (data: any) => {
        if (
          data &&
          isSubscribed &&
          (data.jobId === targetJobId || data.displayId === targetJobId || data.jobId === resolvedJobId)
        ) {
          if (data.status) {
            setJobStatus(data.status);
            if (data.status === 'COMPLETED') {
              playKeySound('success');
            }
          }
          if (data.kiosk?.displayId) {
            setPrintedKiosk(data.kiosk.displayId);
          }
        }
      });
    } catch {}

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (socket) {
        socket.off('job_update');
      }
    };
  }, [resolvedJobId, jobId, displayId]);

  // ── Countdown Timer (24-Hour Handler) ──
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Copy Code Function ──
  const copyCode = useCallback(async () => {
    if (!code) return;
    playKeySound('success');
    let copiedSuccess = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(code);
        copiedSuccess = true;
      } catch {}
    }

    if (!copiedSuccess) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copiedSuccess = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {}
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fbff]">
        <Loader2 className="w-14 h-14 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-900 font-extrabold text-lg">Verifying Print Code...</p>
      </div>
    );
  }

  if (error && !code && jobStatus !== 'COMPLETED') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#f8fbff]">
        <p className="text-rose-600 font-bold text-lg mb-4">{error}</p>
        <button onClick={() => {
          playKeySound('tap');
          router.push('/');
        }} className="bg-blue-600 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg md:max-w-xl mx-auto bg-[#f8fbff] text-slate-900 font-sans">
      {/* Header & Back Button */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => {
          playKeySound('tap');
          router.push('/');
        }} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 active:scale-95 transition-transform shadow-sm">
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>
        <span className="text-xs font-bold text-slate-500 font-mono">Job: {displayId || jobInfo?.displayId || 'Active'}</span>
      </div>

      {/* 🌟 Top XPOS Branding (XPOS on top, PRINT ON SCREEN below, clean & premium) */}
      <motion.div
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center justify-center text-center mt-1 mb-3"
      >
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Printer className="w-5 h-5" />
          </div>
          <span className="font-display font-black text-3xl tracking-tight text-slate-900">
            XPOS
          </span>
        </div>
        <span className="text-[11px] font-black tracking-widest text-blue-600 uppercase bg-blue-50 px-3 py-0.5 rounded-full border border-blue-100">
          PRINT ON SCREEN
        </span>
      </motion.div>

      {/* 💖 ENLARGED, HIGH-IMPACT CHARMING & FLIRTY QUOTE BOX */}
      {charmingLine && jobStatus !== 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="mb-4 p-4 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 border-2 border-blue-200/90 shadow-md shadow-blue-500/5 text-center flex flex-col items-center justify-center gap-1.5"
        >
          <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-700 bg-white/90 px-3 py-0.5 rounded-full border border-blue-200">
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>A Note For You</span>
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
          </div>
          <p className="text-sm md:text-base font-black text-slate-900 leading-snug">
            "{charmingLine}"
          </p>
        </motion.div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* ════════════════════════════════════════════════ */}
        {/* CASE 1: PRINT COMPLETED (CELEBRATORY PAPER OUT ANIMATION) */}
        {/* ════════════════════════════════════════════════ */}
        {jobStatus === 'COMPLETED' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            className="text-center w-full"
          >
            {/* Animated Paper Coming Out of Printer Slot */}
            <div className="relative w-40 h-40 mx-auto mb-3 flex items-center justify-center">
              {/* Printer Base Slot */}
              <div className="absolute bottom-2 w-36 h-9 bg-slate-800 rounded-xl shadow-xl border-2 border-slate-700 flex items-center justify-center">
                <div className="w-28 h-1.5 bg-slate-950 rounded-full" />
              </div>

              {/* Emerging Paper Sheet with Smooth Upward Spring */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: -15, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 140, damping: 12 }}
                className="w-26 h-32 bg-white border-2 border-blue-200 rounded-xl shadow-2xl flex flex-col items-center justify-between p-2.5 z-10"
              >
                <div className="w-full h-2 bg-blue-600 rounded-full" />
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="w-3/4 h-1.5 bg-slate-200 rounded-full" />
              </motion.div>

              {/* Celebratory Sparkles */}
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="absolute -top-1 -right-1 text-amber-500">
                <Sparkles className="w-7 h-7" />
              </motion.div>
            </div>

            <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 mb-1 tracking-tight">PRINT COMPLETED! 🎉</h1>

            {/* 🎉 High-Impact Celebratory Quote Box on Completion */}
            <div className="my-3 p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center flex items-center justify-center gap-2 shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse flex-shrink-0" />
              <p className="text-sm md:text-base font-black text-emerald-950">
                "{completionLine || 'Your print is ready, my dear! ✨'}"
              </p>
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse flex-shrink-0" />
            </div>

            <p className="text-slate-600 text-sm mb-4">
              Your document is ready in the tray at <strong className="text-blue-700 font-bold">{printedKiosk || 'XPOS Kiosk'}</strong>.
            </p>

            <div className="bg-white border border-blue-100 p-5 rounded-3xl mb-5 text-left space-y-3 shadow-md shadow-blue-500/5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Job ID</span>
                <span className="text-slate-900 font-mono font-black">{displayId || jobInfo?.displayId}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Document</span>
                <span className="text-slate-900 font-black truncate max-w-[220px]">{jobInfo?.file?.originalName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-bold">Total Pages</span>
                <span className="text-slate-900 font-black">{jobInfo?.totalPages || 1} pages</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/remote')}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              🖨️ Print Another Document
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center w-full space-y-4"
          >
            {/* ════════════════════════════════════════════════ */}
            {/* DYNAMIC CENTERED BANNER: SCREENSHOT ALERT -> PRINTING IN PROGRESS */}
            {/* ════════════════════════════════════════════════ */}
            {jobStatus === 'PRINTING' ? (
              /* Replaces Screenshot Banner with Printing In-Progress Banner */
              <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-400 text-center shadow-sm flex flex-col items-center justify-center gap-1.5 animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 mb-0.5">
                  <Printer className="w-6 h-6" />
                </div>
                <p className="font-black text-slate-900 text-sm uppercase tracking-wider">🖨️ PRINTING IN PROGRESS</p>
                <p className="text-slate-600 text-xs font-medium leading-tight">
                  Your document is printing at the kiosk. Please collect it from the printer tray.
                </p>
              </div>
            ) : (
              /* Centered, Sleek Highlighted Screenshot Alert */
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border-2 border-amber-300 text-center shadow-sm flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-amber-900 bg-amber-200/90 px-3 py-0.5 rounded-md">
                    ⚠️ IMPORTANT NOTICE
                  </span>
                </div>
                <p className="font-black text-amber-950 text-sm leading-snug">
                  📸 Take a screenshot of this code now
                </p>
                <p className="text-amber-900/90 text-xs mt-0.5 font-medium leading-tight max-w-sm mx-auto">
                  Save this 6-digit code or take a screenshot before leaving. Valid for <strong className="font-black text-amber-950">24 Hours</strong> at any XPOS kiosk.
                </p>
              </div>
            )}

            {/* 6-Digit Code Box */}
            <div className="bg-white p-6 rounded-3xl border-2 border-blue-200 shadow-xl shadow-blue-500/5">
              <p className="text-xs md:text-sm text-blue-700 font-black uppercase tracking-wider mb-4">6-Digit Kiosk Release Code</p>

              <div className="flex items-center justify-center gap-2.5 mb-5">
                {code?.split('').map((digit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="w-12 md:w-14 h-16 rounded-2xl bg-blue-50 border-2 border-blue-500 flex items-center justify-center text-3xl md:text-4xl font-display font-black text-blue-900 shadow-sm"
                  >
                    {digit}
                  </motion.div>
                ))}
              </div>

              {/* Copy Button */}
              <button
                type="button"
                onClick={copyCode}
                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-md active:scale-98 ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>COPIED TO CLIPBOARD ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>COPY 6-DIGIT CODE</span>
                  </>
                )}
              </button>
            </div>

            {/* 24-Hour Expiry Timer */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs md:text-sm font-bold">Valid For (24 Hours)</span>
              </div>
              <span className="font-mono font-black text-base text-blue-700">
                {formatTime(remaining)}
              </span>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-100 text-xs md:text-sm text-slate-700 text-center leading-relaxed">
              Go to any XPOS Kiosk, tap <strong className="text-slate-900 font-extrabold">"ENTER CODE"</strong>, type <strong className="text-blue-700 font-mono font-bold">{code}</strong>, and your document will print immediately.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function CodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8fbff]">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    }>
      <CodeContent />
    </Suspense>
  );
}
