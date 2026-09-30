'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QrCode, Globe, ArrowLeft, ArrowRight, Printer } from 'lucide-react';

export default function StartPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto bg-[#f8fbff] text-slate-900 font-sans">
      {/* Back button */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-all font-bold text-sm bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-100 shadow-sm active:scale-95"
          id="btn-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Method Selection</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col justify-center space-y-6"
      >
        <div>
          <span className="text-xs font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">Printing Options</span>
          <h1 className="text-3xl font-black text-slate-900 mt-2 mb-1 tracking-tight">Where are you?</h1>
          <p className="text-slate-600 text-sm font-medium">Choose how you want to print today:</p>
        </div>

        <div className="space-y-4">
          {/* Remote */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => router.push('/remote')}
            className="w-full p-5 rounded-3xl bg-white border-2 border-blue-200 hover:border-blue-600 shadow-lg shadow-blue-500/5 text-left flex items-start gap-4 transition-all"
            id="btn-remote"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 text-blue-600">
              <Globe className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 mb-0.5">Upload & Print Remotely</h3>
                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">Recommended</span>
              </div>
              <p className="text-slate-600 text-xs font-medium">Upload up to 10 files/photos now, pay securely & collect with code from any kiosk</p>
            </div>
          </motion.button>

          {/* At kiosk */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => router.push('/scan-qr')}
            className="w-full p-5 rounded-3xl bg-white border-2 border-slate-200 hover:border-blue-400 shadow-sm text-left flex items-start gap-4 transition-all"
            id="btn-at-kiosk"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700">
              <QrCode className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 mb-0.5">I am at a Print Bro Kiosk</h3>
              <p className="text-slate-600 text-xs font-medium">Scan the QR code on the kiosk screen to print immediately</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
