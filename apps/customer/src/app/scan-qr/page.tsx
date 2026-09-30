'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, QrCode, Smartphone } from 'lucide-react';

export default function ScanQRPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col px-6 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-sm"
        >
          <div className="w-20 h-20 rounded-2xl bg-xpos-600/20 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-xpos-400" />
          </div>

          <h1 className="text-2xl font-display font-bold text-white mb-3">Scan the QR Code</h1>
          <p className="text-dark-400 mb-8">
            Use your phone camera to scan the QR code displayed on the Print Bro kiosk screen.
          </p>

          <div className="glass-card p-8 mb-8">
            <div className="w-40 h-40 mx-auto bg-white/5 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center">
              <QrCode className="w-16 h-16 text-dark-500" />
            </div>
            <p className="text-dark-500 text-sm mt-4">
              The QR code is on the kiosk screen
            </p>
          </div>

          <div className="space-y-3 text-left">
            {[
              { n: 1, t: 'Find a Print Bro kiosk' },
              { n: 2, t: 'Scan the QR code on screen' },
              { n: 3, t: 'Upload your document on your phone' },
              { n: 4, t: 'Pay & collect your printout' },
            ].map(({ n, t }) => (
              <div key={n} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-xpos-600/20 flex items-center justify-center text-xpos-400 font-bold text-sm flex-shrink-0">
                  {n}
                </div>
                <p className="text-dark-300 text-sm">{t}</p>
              </div>
            ))}
          </div>

          <button onClick={() => router.push('/print?kiosk=XPOS-001')} className="btn-primary w-full mt-8">
            Simulate Scan (Connect to Kiosk XPOS-001)
          </button>

          <button onClick={() => router.push('/remote')} className="btn-secondary w-full mt-3">
            Or print remotely instead
          </button>
        </motion.div>
      </div>
    </div>
  );
}
