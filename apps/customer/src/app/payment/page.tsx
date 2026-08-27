'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createPayment, verifyPayment } from '../../lib/api';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const displayId = searchParams.get('displayId');
  const amount = searchParams.get('amount');
  const method = searchParams.get('method') || 'CODE';

  const [status, setStatus] = useState<'loading' | 'waiting' | 'verifying' | 'success' | 'failed'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initPayment() {
      if (!jobId) return;

      const res = await createPayment(jobId);
      if (res.success) {
        setPaymentData(res.data);
        setStatus('waiting');

        // Auto-verify after 2 seconds
        setTimeout(async () => {
          setStatus('verifying');
          const verifyRes = await verifyPayment(res.data.paymentId, res.data.orderId);
          if (verifyRes.success && verifyRes.data.verified) {
            setStatus('success');
            setTimeout(() => {
              if (method === 'QR') {
                router.push(`/job/${jobId}?displayId=${displayId}`);
              } else {
                router.push(`/code?jobId=${jobId}&displayId=${displayId}`);
              }
            }, 1000);
          } else {
            setStatus('failed');
            setError('Payment verification failed');
          }
        }, 2000);
      } else {
        setStatus('failed');
        setError(res.error || 'Failed to create payment');
      }
    }

    initPayment();
  }, [jobId, displayId, method, router]);

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
            <p className="text-slate-900 font-bold text-lg">Preparing UPI payment...</p>
          </motion.div>
        )}

        {status === 'waiting' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
            <div className="bg-white p-8 mb-5 rounded-3xl border-2 border-blue-200 shadow-xl shadow-blue-500/5">
              <span className="text-xs font-black text-blue-700 bg-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">UPI Payment</span>
              <h2 className="text-3xl font-display font-black text-slate-900 mt-2 mb-1">PAY ₹{amount}</h2>
              <p className="text-slate-600 text-xs mb-6 font-medium">Scan with GPay, PhonePe, Paytm, or BHIM</p>

              {/* Dynamic Live UPI QR Code */}
              <div className="w-56 h-56 bg-white p-3 rounded-2xl mx-auto mb-4 border-2 border-blue-100 flex items-center justify-center shadow-inner">
                {paymentData?.qrData ? (
                  <QRCodeSVG
                    value={paymentData.qrData}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                ) : (
                  <QrCode className="w-36 h-36 text-blue-500 animate-pulse" />
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-blue-700 font-bold bg-blue-50 py-2 rounded-xl border border-blue-100">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for payment confirmation...</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium">Order: <span className="font-mono font-bold text-slate-700">{displayId}</span></p>
          </motion.div>
        )}

        {status === 'verifying' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 mb-1">Verifying Payment...</h3>
            <p className="text-slate-600 text-sm font-medium">Generating your 24-hour Print Code</p>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-1">Payment Verified! ✓</h3>
            <p className="text-slate-600 text-sm font-medium">Redirecting to your Print Code...</p>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="w-20 h-20 rounded-full bg-rose-100 border-2 border-rose-300 flex items-center justify-center mx-auto mb-4 text-rose-600">
              <XCircle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Payment Failed</h3>
            <p className="text-rose-600 text-sm font-bold mb-6">{error || 'Something went wrong'}</p>
            <button onClick={() => router.push('/remote')} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg">Try Again</button>
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
