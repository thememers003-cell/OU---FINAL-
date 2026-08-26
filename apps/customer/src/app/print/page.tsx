'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, CheckCircle2, Loader2 } from 'lucide-react';
import { createSession, getKiosk } from '@/lib/api';

function PrintConnectedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kioskId = searchParams.get('kiosk') || searchParams.get('kisok') || 'XPOS-001';

  const [kioskInfo, setKioskInfo] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!kioskId) {
        setError('No kiosk specified');
        setLoading(false);
        return;
      }

      // Get kiosk info
      const kioskRes = await getKiosk(kioskId);
      if (!kioskRes.success) {
        setError('Kiosk not found or unavailable');
        setLoading(false);
        return;
      }
      setKioskInfo(kioskRes.data);

      // Create session
      const sessionRes = await createSession(kioskId, 'QR');
      if (sessionRes.success) {
        setSessionId(sessionRes.data.id);
      }
      setLoading(false);
    }
    init();
  }, [kioskId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-xpos-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <h2 className="text-xl font-bold text-white mb-2">Kiosk Unavailable</h2>
        <p className="text-dark-400 mb-6">{error}</p>
        <button onClick={() => router.push('/')} className="btn-primary">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={() => router.push('/')} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-5 h-5" />
        <span>Home</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-sm"
        >
          <div className="w-16 h-16 rounded-full bg-accent-green/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-accent-green" />
          </div>

          <h1 className="text-2xl font-display font-bold text-white mb-2">Connected</h1>
          <p className="text-dark-400 mb-8">You're connected to a kiosk</p>

          {/* Kiosk Info */}
          <div className="glass-card p-6 mb-8 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-dark-400 text-sm">Kiosk</span>
              <span className="text-white font-semibold">{kioskInfo?.displayId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-dark-400 text-sm">Location</span>
              <span className="text-white">{kioskInfo?.location}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-dark-400 text-sm">Printer</span>
              <span className="status-online">
                <span className="w-2 h-2 rounded-full bg-accent-green" />
                {kioskInfo?.printerStatus || 'Ready'}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push(`/remote?kiosk=${kioskId}&method=QR&sessionId=${sessionId}`)}
            className="btn-primary w-full text-lg py-5 flex items-center justify-center gap-3"
          >
            <Printer className="w-5 h-5" />
            UPLOAD DOCUMENT
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-xpos-500 animate-spin" /></div>}>
      <PrintConnectedContent />
    </Suspense>
  );
}
