'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Hash, Check, Loader2 } from 'lucide-react';
import { getJob } from '../../lib/api';
import { playKeySound } from '../../lib/sound';

export default function EnterCodePage() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDigit = (digit: string) => {
    if (activeIndex >= 6) return;
    playKeySound('tap');
    const newCode = [...code];
    newCode[activeIndex] = digit;
    setCode(newCode);
    setActiveIndex(Math.min(activeIndex + 1, 6));
    setError(null);

    // Auto submit when 6 digits are typed
    if (activeIndex === 5) {
      const fullCode = [...code.slice(0, 5), digit].join('');
      verifyAndRedirect(fullCode);
    }
  };

  const verifyAndRedirect = async (fullCode: string) => {
    playKeySound('success');
    setLoading(true);
    setError(null);
    try {
      // Find matching code locally or navigate directly
      router.push(`/code?displayId=${fullCode}`);
    } catch (e: any) {
      playKeySound('error');
      setError('Invalid code. Please try again.');
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (activeIndex > 0) {
      playKeySound('delete');
      const newCode = [...code];
      newCode[activeIndex - 1] = '';
      setCode(newCode);
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleClearAll = () => {
    playKeySound('delete');
    setCode(['', '', '', '', '', '']);
    setActiveIndex(0);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-lg mx-auto bg-[#f8fbff] text-slate-900 font-sans">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lookup Job</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center w-full max-w-sm space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto text-blue-600 shadow-md shadow-blue-500/10">
            <Hash className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Enter Print Code</h1>
            <p className="text-slate-600 text-xs md:text-sm font-medium mt-0.5">Enter your 6-digit code to view or track your print job</p>
          </div>

          {/* Code Display Box */}
          <div className="flex items-center justify-center gap-2.5 my-4">
            {code.map((digit, i) => (
              <motion.div
                key={i}
                animate={{ scale: i === activeIndex ? 1.05 : 1 }}
                className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl font-display font-black transition-all ${
                  digit
                    ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-sm'
                    : i === activeIndex
                    ? 'bg-white border-blue-500 ring-2 ring-blue-300'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {digit || ''}
              </motion.div>
            ))}
          </div>

          {error && <p className="text-rose-600 text-sm font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">{error}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleDigit(String(num))}
                className="h-15 rounded-2xl bg-white border-2 border-slate-200 text-slate-900 text-2xl font-black shadow-sm hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClearAll}
              className="h-15 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black hover:bg-rose-100 active:scale-95 transition-all"
            >
              CLEAR
            </button>
            <button
              onClick={() => handleDigit('0')}
              className="h-15 rounded-2xl bg-white border-2 border-slate-200 text-slate-900 text-2xl font-black shadow-sm hover:bg-blue-50 hover:border-blue-300 active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleClear}
              className="h-15 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-200 active:scale-95 transition-all"
            >
              ← DEL
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
