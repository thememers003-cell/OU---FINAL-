'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Printer, QrCode, Hash, Zap, Shield, Clock, ArrowRight, Sparkles, FileText } from 'lucide-react';

import { playKeySound } from '@/lib/sound';

export default function HomePage() {
  const router = useRouter();
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto bg-[#f8fbff] text-slate-900 font-sans">
      {/* 🌟 Top Animated XPOS Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
            <Printer className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl font-display font-black tracking-tight text-slate-900 leading-none">
              XPOS
            </h1>
            <span className="text-xs font-black tracking-widest text-blue-600 uppercase bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 mt-1 inline-block">
              PRINT ON SCREEN
            </span>
          </div>
        </div>
      </motion.div>

      {/* Hero Tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-center mb-8 relative z-10 space-y-1.5"
      >
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          Print from anywhere.
        </h2>
        <p className="text-slate-600 font-medium text-base">
          Collect your prints instantly from any XPOS kiosk.
        </p>
      </motion.div>

      {/* Main Action Cards */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="w-full space-y-3.5 relative z-10"
      >
        {/* START PRINTING BUTTON */}
        <button
          onClick={() => {
            playKeySound('tap');
            router.push('/remote');
          }}
          onMouseEnter={() => setHoveredBtn('start')}
          onMouseLeave={() => setHoveredBtn(null)}
          className="w-full py-4 px-6 rounded-[20px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-500/25 active:scale-[0.98] transition-all"
          id="btn-start-printing"
        >
          <Zap className={`w-5 h-5 transition-transform duration-300 ${hoveredBtn === 'start' ? 'scale-110' : ''}`} />
          <span>START PRINTING</span>
          <ArrowRight className="w-5 h-5 ml-auto" />
        </button>
      </motion.div>

      {/* Feature Badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="mt-10 grid grid-cols-3 gap-3 w-full relative z-10"
      >
        {[
          { icon: Zap, label: 'Fast Upload', desc: 'Ready in 3s', color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { icon: Shield, label: '100% Private', desc: 'Auto-deleted', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { icon: Clock, label: '24H Code', desc: 'Valid 24 hours', color: 'text-blue-600 bg-blue-50 border-blue-200' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="text-center p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center">
            <div className={`p-2.5 rounded-xl border ${color} mb-1.5`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-slate-900 text-xs font-black">{label}</p>
            <p className="text-slate-500 text-[10px] font-medium">{desc}</p>
          </div>
        ))}
      </motion.div>

      {/* Supported formats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-8 text-center relative z-10"
      >
        <p className="text-slate-500 text-xs font-bold mb-2 uppercase tracking-wider">Supported Formats</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {['PDF Documents', 'Word DOCX', 'Photos JPG/PNG', 'Up to 10 Files'].map((format) => (
            <span
              key={format}
              className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs"
            >
              {format}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
