'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Loader2, Printer, Send, FileText, XCircle } from 'lucide-react';
import { getJob } from '@/lib/api';
import { connectSocket, joinSession } from '@/lib/socket';

function JobStatusContent({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const [jobId, setJobId] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const displayIdParam = searchParams.get('displayId');

  useEffect(() => {
    if (params) {
      if (typeof (params as any).then === 'function') {
        (params as Promise<{ id: string }>).then(p => setJobId(p.id));
      } else {
        setJobId((params as { id: string }).id);
      }
    }
  }, [params]);

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    async function fetchJob() {
      const res = await getJob(jobId);
      if (res.success) {
        setJob(res.data);
        setLoading(false);

        // Set up WebSocket for real-time updates
        if (res.data.sessionId) {
          const socket = connectSocket();
          joinSession(res.data.sessionId);

          socket.on('job_update', (data: any) => {
            if (data.jobId === jobId) {
              setJob((prev: any) => ({
                ...prev,
                status: data.status,
                currentPage: data.currentPage,
                totalPages: data.totalPages,
              }));
            }
          });
        }
      }
    }
    fetchJob();

    // Also poll every 3 seconds as fallback
    const interval = setInterval(async () => {
      const res = await getJob(jobId);
      if (res.success) setJob(res.data);
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  const getStatusInfo = (status: string) => {
    const map: Record<string, { icon: any; label: string; color: string; animate: boolean }> = {
      CREATED: { icon: FileText, label: 'Job Created', color: 'text-dark-400', animate: false },
      PAYMENT_PENDING: { icon: Loader2, label: 'Waiting for Payment', color: 'text-accent-amber', animate: true },
      PAYMENT_SUCCESS: { icon: CheckCircle2, label: 'Payment Verified', color: 'text-accent-green', animate: false },
      QUEUED: { icon: Loader2, label: 'Waiting for Kiosk', color: 'text-xpos-400', animate: true },
      SENDING: { icon: Send, label: 'Sending to Kiosk', color: 'text-accent-cyan', animate: true },
      PRINTING: { icon: Printer, label: 'Printing...', color: 'text-accent-amber', animate: true },
      COMPLETED: { icon: CheckCircle2, label: 'Print Completed', color: 'text-accent-green', animate: false },
      FAILED: { icon: XCircle, label: 'Print Failed', color: 'text-accent-rose', animate: false },
      CANCELLED: { icon: XCircle, label: 'Cancelled', color: 'text-dark-400', animate: false },
    };
    return map[status] || map.CREATED;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-xpos-500 animate-spin" />
      </div>
    );
  }

  const statusInfo = getStatusInfo(job?.status);
  const StatusIcon = statusInfo.icon;
  const isComplete = job?.status === 'COMPLETED';
  const isPrinting = job?.status === 'PRINTING';

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={() => router.push('/')} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-5 h-5" />
        <span>Home</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center w-full max-w-sm"
        >
          {/* Status Icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${isComplete ? 'bg-accent-green/20' : 'bg-xpos-600/20'}`}>
            <StatusIcon className={`w-14 h-14 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`} />
          </div>

          <h1 className={`text-2xl font-display font-bold mb-2 ${isComplete ? 'text-accent-green' : 'text-white'}`}>
            {isComplete ? '✓ PRINT COMPLETED' : statusInfo.label}
          </h1>

          {isComplete && (
            <p className="text-dark-300 mb-8">Please collect your document.</p>
          )}

          {/* Progress bar for printing */}
          {isPrinting && job.currentPage > 0 && (
            <div className="mb-8">
              <div className="progress-bar mb-2">
                <div className="progress-bar-fill" style={{ width: `${(job.currentPage / job.totalPages) * 100}%` }} />
              </div>
              <p className="text-dark-400 text-sm">
                Page {job.currentPage} of {job.totalPages}
              </p>
            </div>
          )}

          {/* Job Details */}
          <div className="glass-card p-6 text-left space-y-3 text-sm mt-6">
            <div className="flex justify-between">
              <span className="text-dark-400">Job</span>
              <span className="text-white font-mono">{job.displayId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Method</span>
              <span className="text-white">{job.printMethod === 'QR' ? '📱 QR' : '🔢 Code'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Document</span>
              <span className="text-white truncate ml-4 max-w-[180px]">{job.file?.originalName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Pages</span>
              <span className="text-white">{job.totalPages}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-400">Payment</span>
              <span className={job.payment?.status === 'SUCCESS' ? 'text-accent-green' : 'text-accent-amber'}>
                {job.payment?.status === 'SUCCESS' ? '✓ Paid' : 'Pending'} — ₹{job.totalPrice}
              </span>
            </div>
            {job.kiosk && (
              <>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between">
                  <span className="text-dark-400">Kiosk</span>
                  <span className="text-white">{job.kiosk.displayId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Location</span>
                  <span className="text-white">{job.kiosk.location}</span>
                </div>
              </>
            )}
            <div className="h-px bg-white/5" />
            <div className="flex justify-between">
              <span className="text-dark-400">Status</span>
              <span className={statusInfo.color}>{statusInfo.label}</span>
            </div>
          </div>

          {isComplete && (
            <button onClick={() => router.push('/')} className="btn-primary w-full mt-6">
              Print Another Document
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function JobStatusPage(props: { params: { id: string } | Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-dark-900">
          <Loader2 className="w-10 h-10 text-xpos-500 animate-spin mb-3" />
        </div>
      }
    >
      <JobStatusContent {...props} />
    </Suspense>
  );
}
