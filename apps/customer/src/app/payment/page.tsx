'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, QrCode, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createPayment, verifyPayment } from '../../lib/api';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const displayId = searchParams.get('displayId');
  const amount = searchParams.get('amount');
  const method = searchParams.get('method') || 'QR';
  const kioskParam = searchParams.get('kiosk') || '';
  const isCallback = searchParams.get('callback') === 'true';
  const paramOrderId = searchParams.get('orderId');

  const [status, setStatus] = useState<'loading' | 'waiting' | 'verifying' | 'success' | 'failed'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualChecking, setManualChecking] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Success redirect helper
  const handleSuccessRedirect = useCallback(() => {
    setStatus('success');
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setTimeout(() => {
      router.push(`/remote?jobId=${jobId}&displayId=${displayId}&kiosk=${kioskParam}&paid=true`);
    }, 1200);
  }, [jobId, displayId, kioskParam, router]);

  // Check payment status helper
  const checkStatus = useCallback(async (paymentId?: string, orderId?: string) => {
    if (!jobId && !paymentId && !orderId) return false;
    try {
      const verifyRes = await verifyPayment(paymentId, orderId, jobId || undefined);
      if (verifyRes.success && verifyRes.data?.verified) {
        handleSuccessRedirect();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [jobId, handleSuccessRedirect]);

  // Manual verify trigger
  const handleManualCheck = async () => {
    setManualChecking(true);
    const verified = await checkStatus(paymentData?.paymentId, paymentData?.orderId || paramOrderId || undefined);
    setManualChecking(false);
    if (!verified) {
      setError('Payment not detected yet. If you recently paid, please wait a few seconds and try again.');
    }
  };

  useEffect(() => {
    async function initPayment() {
      if (!jobId) {
        setError('Missing Job ID');
        setStatus('failed');
        return;
      }

      // If returning from PhonePe redirect callback
      if (isCallback) {
        setStatus('verifying');
        const verified = await checkStatus(undefined, paramOrderId || undefined);
        if (verified) return;

        // If not immediately settled, start polling
        setStatus('waiting');
      }

      // Create or fetch payment order
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await createPayment(jobId, `${currentOrigin}/payment`);
      if (res.success) {
        const orderInfo = res.data;
        setPaymentData(orderInfo);

        // If already paid
        if (orderInfo.status === 'PAID') {
          handleSuccessRedirect();
          return;
        }

        // Automatically redirect to PhonePe Payment Gateway
        if (!isCallback && orderInfo.redirectUrl) {
          window.location.href = orderInfo.redirectUrl;
          return;
        }

        setStatus('waiting');

        // Start active background polling every 3 seconds to auto-detect PhonePe completion
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(async () => {
          const paid = await checkStatus(orderInfo.paymentId, orderInfo.orderId);
          if (paid && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }, 3000);
      } else {
        setStatus('failed');
        setError(res.error || 'Failed to initialize PhonePe payment');
      }
    }

    initPayment();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, isCallback, paramOrderId, checkStatus, handleSuccessRedirect]);

  return (
    <div className="min-h-screen flex flex-col px-5 py-6 bg-[#f8fbff] text-slate-900">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 w-fit mb-6">
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        {status === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-900 font-bold text-lg">Connecting to PhonePe Payment Gateway...</p>
            <p className="text-slate-500 text-xs mt-1">Generating secure transaction session</p>
          </motion.div>
        )}

        {status === 'waiting' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
            <div className="bg-white p-7 mb-4 rounded-3xl border-2 border-blue-200 shadow-xl shadow-blue-500/5">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-purple-700 bg-purple-100 px-3 py-0.5 rounded-full uppercase tracking-wider">PhonePe PG</span>
              </div>
              <h2 className="text-3xl font-display font-black text-slate-900 mb-1">₹{amount || paymentData?.amount}</h2>
              <p className="text-slate-600 text-xs mb-5 font-medium">Scan QR or pay directly via PhonePe Gateway</p>

              {/* Dynamic QR Code for PhonePe Checkout URL */}
              <div className="w-52 h-52 bg-white p-2.5 rounded-2xl mx-auto mb-4 border-2 border-blue-100 flex items-center justify-center shadow-inner">
                {paymentData?.redirectUrl || paymentData?.qrData ? (
                  <QRCodeSVG
                    value={paymentData.redirectUrl || paymentData.qrData}
                    size={185}
                    level="M"
                    includeMargin={false}
                  />
                ) : (
                  <QrCode className="w-32 h-32 text-blue-500 animate-pulse" />
                )}
              </div>

              {/* Direct Link to PhonePe Checkout for mobile / single device users */}
              {paymentData?.redirectUrl && (
                <a
                  href={paymentData.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 mb-3 bg-[#5f259f] hover:bg-[#4b1d7d] text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-[0.98]"
                >
                  <span>Pay Now on PhonePe</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* Auto-polling indicator & Manual Check button */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 font-semibold bg-slate-50 py-2.5 px-3 rounded-xl border border-slate-200 mb-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                <span>Checking payment confirmation automatically...</span>
              </div>

              <button
                type="button"
                onClick={handleManualCheck}
                disabled={manualChecking}
                className="w-full py-2 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${manualChecking ? 'animate-spin' : ''}`} />
                <span>{manualChecking ? 'Checking status...' : "I've completed the payment"}</span>
              </button>

              {error && (
                <p className="text-xs text-rose-600 font-semibold mt-3 bg-rose-50 p-2 rounded-lg border border-rose-100">
                  {error}
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium">Order Reference: <span className="font-mono font-bold text-slate-700">{displayId || paymentData?.orderId}</span></p>
          </motion.div>
        )}

        {status === 'verifying' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Loader2 className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Verifying with PhonePe...</h3>
            <p className="text-slate-600 text-sm font-medium">Generating your secure 6-digit Print Code</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-1">Payment Confirmed! ✓</h3>
            <p className="text-slate-600 text-sm font-medium">Redirecting to your 6-digit Print Code...</p>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
            <div className="w-20 h-20 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center mx-auto mb-4 text-rose-600">
              <XCircle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Payment Failed</h3>
            <p className="text-rose-600 text-sm font-bold mb-6">{error || 'Unable to verify payment'}</p>
            <button onClick={() => router.push('/remote')} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg hover:bg-blue-700 transition-colors">Try Again</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f8fbff]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}

