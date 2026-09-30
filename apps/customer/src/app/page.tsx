'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Printer,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  Sparkles,
  FileText,
  CheckCircle2,
  FileCheck,
  Smartphone,
  Layers,
  Radio,
  Download,
  Key,
  Copy,
  Check,
  ChevronDown,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Cpu,
  Flame,
  Award,
  Hash,
  QrCode,
  Laptop
} from 'lucide-react';
import { playKeySound } from '../lib/sound';

export default function XPOSShowcaseLandingPage() {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 3D Kiosk Simulator State
  const [simCode, setSimCode] = useState(['', '', '', '', '', '']);
  const [simScreen, setSimScreen] = useState<'idle' | 'printing' | 'completed'>('idle');
  const [simProgress, setSimProgress] = useState(0);
  const [simTotalPages, setSimTotalPages] = useState(4);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mouse Parallax for 3D Hero
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePos({
      x: (clientX / innerWidth - 0.5) * 20,
      y: (clientY / innerHeight - 0.5) * 20,
    });
  };

  // Sound trigger helper
  const triggerSound = (type: 'tap' | 'success' | 'delete' | 'error') => {
    if (soundEnabled) playKeySound(type);
  };

  // ── Simulator Handlers ──
  const handleSimKeyPress = (num: string) => {
    if (simScreen !== 'idle') return;
    triggerSound('tap');
    const emptyIndex = simCode.findIndex(d => d === '');
    if (emptyIndex !== -1) {
      const next = [...simCode];
      next[emptyIndex] = num;
      setSimCode(next);

      if (emptyIndex === 5) {
        // Auto trigger simulated print
        startSimulatedPrint();
      }
    }
  };

  const handleSimDelete = () => {
    if (simScreen !== 'idle') return;
    triggerSound('delete');
    const lastFilled = simCode.map(d => d !== '').lastIndexOf(true);
    if (lastFilled !== -1) {
      const next = [...simCode];
      next[lastFilled] = '';
      setSimCode(next);
    }
  };

  const startSimulatedPrint = () => {
    setSimScreen('printing');
    setSimProgress(1);
    triggerSound('success');

    let current = 1;
    const interval = setInterval(() => {
      current += 1;
      setSimProgress(current);
      triggerSound('tap');

      if (current >= 4) {
        clearInterval(interval);
        setTimeout(() => {
          setSimScreen('completed');
          triggerSound('success');
        }, 800);
      }
    }, 900);
  };

  const resetSimulator = () => {
    setSimScreen('idle');
    setSimCode(['', '', '', '', '', '']);
    setSimProgress(0);
    triggerSound('tap');
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-[#eef6ff] to-[#f4f9ff] text-slate-900 font-sans selection:bg-sky-500 selection:text-white overflow-x-hidden"
    >
      {/* ── TOP LUXURY NAVIGATION ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-sky-100/80 px-4 md:px-10 py-3.5 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <img src="/printbro_logo.png" alt="PrintBro" className="h-10 md:h-12 object-contain" />
          </div>

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
            <a href="#how-it-works" className="hover:text-sky-600 transition-colors">3D Print Journey</a>
            <a href="#kiosk-demo" className="hover:text-sky-600 transition-colors">Interactive Simulator</a>
            <a href="#features" className="hover:text-sky-600 transition-colors">Cloud Architecture</a>
            <a href="#formats" className="hover:text-sky-600 transition-colors">Supported Files</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 transition-all text-xs flex items-center gap-1"
              title={soundEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-sky-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Direct Print Button */}
            <button
              onClick={() => {
                triggerSound('tap');
                router.push('/remote');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs md:text-sm shadow-lg shadow-sky-500/25 active:scale-95 transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>START PRINTING</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION: 3D MECHANICAL SHOWCASE ── */}
      <section className="relative pt-12 md:pt-20 pb-20 md:pb-32 px-4 md:px-10 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Compelling Copy & Print CTAs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6 space-y-6 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 shadow-sm">
              <Sparkles className="w-4 h-4 text-sky-600 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-sky-800">
                The Next Generation of Cloud Printing
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08]">
              Upload from Phone. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600">
                Print at Any Kiosk.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
              No app downloads. No printer drivers. Upload any PDF, Word, or photo from your phone, get a 6-digit code, and collect your crisp prints in <strong>under 45 seconds</strong> at any Print Bro station.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => {
                  triggerSound('tap');
                  router.push('/remote');
                }}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-base shadow-xl shadow-sky-500/25 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <Zap className="w-5 h-5" />
                <span>UPLOAD & GET 6-DIGIT CODE</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  triggerSound('tap');
                  router.push('/enter-code');
                }}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-sky-50 text-slate-800 hover:text-sky-700 border-2 border-sky-200 font-bold text-base shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Key className="w-5 h-5 text-sky-600" />
                <span>Enter Code on Kiosk</span>
              </button>
            </div>

            {/* Live Reliability Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-sky-100/80 max-w-lg mx-auto lg:mx-0">
              <div className="text-center lg:text-left">
                <div className="text-2xl font-black text-slate-900">0.4s</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Release Speed</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl font-black text-sky-600">100%</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">App-Free Web</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl font-black text-emerald-600">24 Hours</div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Code Validity</div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: 3D Floating Isometric Printer & Laser Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-6 relative flex items-center justify-center"
            style={{
              transform: `perspective(1000px) rotateY(${mousePos.x}deg) rotateX(${-mousePos.y}deg)`,
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* Ambient Glowing Backlight */}
            <div className="absolute w-96 h-96 bg-gradient-to-tr from-sky-400/20 to-blue-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* 3D Isometric Kiosk Hardware Mockup */}
            <div className="relative w-full max-w-md bg-white border-2 border-sky-200 rounded-[36px] p-6 shadow-2xl shadow-sky-900/10 space-y-5">
              {/* Kiosk Header */}
              <div className="flex justify-between items-center pb-3 border-b border-sky-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                    XP
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">PRINT BRO TOUCH KIOSK</h3>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Laser Engine Ready
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs font-black bg-sky-50 text-sky-700 px-3 py-1 rounded-xl border border-sky-200">
                  STATION #01
                </span>
              </div>

              {/* 3D Mechanical Paper Tray & Laser Scanner */}
              <div className="relative h-56 bg-gradient-to-b from-slate-900 to-[#0a1124] rounded-3xl p-4 overflow-hidden flex flex-col items-center justify-center shadow-inner border border-slate-800">
                {/* Glowing Laser Scan Line */}
                <motion.div
                  animate={{ y: [-70, 70, -70] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute w-64 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#38bdf8] z-20"
                />

                {/* Animated Emerging 3D Paper */}
                <motion.div
                  animate={{ y: [15, -10, 15] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-44 h-48 bg-white rounded-2xl shadow-2xl border-2 border-sky-200 p-3 flex flex-col justify-between z-10"
                >
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-2 bg-sky-500 rounded-full" />
                    <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px]">
                      ✓
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full" />
                    <div className="w-4/5 h-1.5 bg-slate-100 rounded-full" />
                    <div className="w-full h-1.5 bg-slate-100 rounded-full" />
                    <div className="w-3/4 h-1.5 bg-sky-100 rounded-full" />
                  </div>
                  <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-center">
                    <span className="text-[9px] font-black text-sky-800 uppercase block">Sample Document</span>
                    <span className="text-[8px] text-slate-400 font-mono">CODE: 849201</span>
                  </div>
                </motion.div>

                {/* Printer Ejection Slot */}
                <div className="absolute bottom-2 w-52 h-4 bg-slate-950 rounded-full border border-slate-800 shadow-lg" />
              </div>

              {/* Holographic 6-Digit Code Materializer */}
              <div className="bg-sky-50/80 border border-sky-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sample Live Code</span>
                  <span className="font-mono text-xl font-black text-slate-900 tracking-wider">8 4 9 2 0 1</span>
                </div>
                <button
                  onClick={() => {
                    triggerSound('tap');
                    router.push('/remote');
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  Generate Yours
                </button>
              </div>
            </div>

            {/* Orbiting Floating 3D File Badges */}
            <motion.div
              animate={{ y: [-8, 8, -8] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -left-6 bg-white border border-sky-200 p-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black text-slate-800"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-mono">
                PDF
              </div>
              <span>Multi-Page Ready</span>
            </motion.div>

            <motion.div
              animate={{ y: [8, -8, 8] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-4 -right-4 bg-white border border-sky-200 p-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black text-slate-800"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-mono">
                DOCX
              </div>
              <span>Auto Page Counter</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: 3D SCROLL PRINT JOURNEY (HOW IT WORKS) ── */}
      <section id="how-it-works" className="py-20 md:py-32 px-4 md:px-10 bg-white border-y border-sky-100">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              The 5-Step Mechanical Journey
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
              How Print Bro Cloud Printing Works
            </h2>
            <p className="text-slate-500 font-medium text-sm md:text-base">
              From phone upload to physical warm paper in your hands in less than a minute.
            </p>
          </div>

          {/* 5-Step Animated Sequence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-slate-50/80 border border-slate-200 p-8 rounded-3xl space-y-5 hover:border-sky-300 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-sky-500/25 group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-xl font-black text-slate-900">Upload Any Document</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Open Print Bro on your mobile phone or laptop. Upload PDF, Word DOCX, or images with automated page counting and duplex options.
              </p>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-700">
                <Smartphone className="w-4 h-4 text-sky-500" />
                <span>Zero app installation required</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50/80 border border-slate-200 p-8 rounded-3xl space-y-5 hover:border-sky-300 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-blue-600/25 group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-xl font-black text-slate-900">Instant 6-Digit Code</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                The cloud generates a secure 6-digit release code instantly valid for <strong>24 Hours</strong>. Take a quick screenshot or save the code.
              </p>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="font-mono text-amber-600 font-black">PIN: 749201</span>
                <span className="text-slate-400 text-[10px]">Valid 24h</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50/80 border border-slate-200 p-8 rounded-3xl space-y-5 hover:border-sky-300 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-600/25 group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-xl font-black text-slate-900">Walk to Any Kiosk</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Visit any Print Bro kiosk on campus, in your library, or store lobby. No Bluetooth pairing or WiFi network configuration needed.
              </p>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-700">
                <Radio className="w-4 h-4 text-indigo-500" />
                <span>Connected across all kiosks</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50/80 border border-slate-200 p-8 rounded-3xl space-y-5 hover:border-sky-300 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-purple-600/25 group-hover:scale-110 transition-transform">
                04
              </div>
              <h3 className="text-xl font-black text-slate-900">Type 6-Digit Code</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Type the 6-digit code on the touchscreen. The kiosk verifies with the cloud database and starts printing immediately with haptic sound.
              </p>
              <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-700">
                <Key className="w-4 h-4 text-purple-500" />
                <span>Instant 0.4s verification</span>
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-50/80 border border-slate-200 p-8 rounded-3xl space-y-5 hover:border-sky-300 hover:shadow-xl transition-all group lg:col-span-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-emerald-600/25 group-hover:scale-110 transition-transform">
                05
              </div>
              <h3 className="text-xl font-black text-slate-900">Physical Print Out & Live Status</h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Watch the paper feed live. The kiosk screen counts pages, and your phone screen instantly transitions to <strong>"PRINT COMPLETED! 🎉"</strong> in real time.
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>🎉 Physical Paper Released into Tray</span>
                <span>Phone Screen Synced</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: INTERACTIVE 3D KIOSK PLAYGROUND DEMO ── */}
      <section id="kiosk-demo" className="py-20 md:py-32 px-4 md:px-10 bg-[#0a1020] text-white relative overflow-hidden">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto space-y-12 relative z-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
              Interactive Test Drive
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              Try the Virtual Kiosk Right Now
            </h2>
            <p className="text-slate-400 font-medium text-xs md:text-sm">
              Type any 6 digits below (or click <strong>Sample Code: 7 4 8 2 9 1</strong>) and watch the simulated mechanical release in real time!
            </p>
          </div>

          {/* Virtual Kiosk Interactive Device Mockup */}
          <div className="max-w-md mx-auto bg-slate-900 border-2 border-slate-700 rounded-[36px] p-6 shadow-2xl shadow-sky-950 space-y-6">
            {/* Screen State: Idle, Printing, or Completed */}
            {simScreen === 'idle' && (
              <div className="space-y-5 text-center">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-sky-400">ENTER 6-DIGIT CODE</span>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    {simCode.map((digit, i) => (
                      <div
                        key={i}
                        className={`w-11 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-2xl border-2 transition-all ${
                          digit
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-800/80 border-slate-700 text-slate-500'
                        }`}
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Code Fill Helper */}
                <button
                  onClick={() => {
                    triggerSound('tap');
                    setSimCode(['7', '4', '8', '2', '9', '1']);
                    setTimeout(startSimulatedPrint, 300);
                  }}
                  className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-4"
                >
                  Quick Fill Sample Code (748291)
                </button>
              </div>
            )}

            {simScreen === 'printing' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mx-auto animate-pulse">
                  <Printer className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white">PRINTING DOCUMENT...</h4>
                  <p className="text-xs text-sky-400 mt-1 font-mono">
                    Page {simProgress} of {simTotalPages} printed
                  </p>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
                    style={{ width: `${(simProgress / simTotalPages) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {simScreen === 'completed' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-emerald-400">PRINT COMPLETED! 🎉</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    "Your print is ready, my dear! ✨"
                  </p>
                </div>
                <button
                  onClick={resetSimulator}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Test Another Code
                </button>
              </div>
            )}

            {/* Simulated Touchscreen Keypad */}
            {simScreen === 'idle' && (
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleSimKeyPress(num)}
                    className="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-sky-600 text-white font-black text-lg border border-slate-700/80 transition-all active:scale-95 shadow-sm"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={resetSimulator}
                  className="py-3.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 font-bold text-xs border border-slate-700/50 transition-all"
                >
                  CLEAR
                </button>
                <button
                  onClick={() => handleSimKeyPress('0')}
                  className="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-sky-600 text-white font-black text-lg border border-slate-700/80 transition-all active:scale-95 shadow-sm"
                >
                  0
                </button>
                <button
                  onClick={handleSimDelete}
                  className="py-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-xs border border-rose-500/30 transition-all"
                >
                  DELETE
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: SUPPORTED FORMATS & FEATURES ── */}
      <section id="formats" className="py-20 md:py-32 px-4 md:px-10 bg-white">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              Universal File Compatibility
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
              Print Any Document Effortlessly
            </h2>
            <p className="text-slate-500 font-medium text-sm md:text-base">
              Automatic zero-loss serverless PDF conversion and automatic page counting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                ext: 'PDF',
                title: 'Adobe PDF Documents',
                desc: 'Full multi-page parsing, vector graphics preservation, and crisp typography.',
                color: 'bg-rose-500',
              },
              {
                ext: 'DOCX',
                title: 'Microsoft Word Files',
                desc: 'Automatic page count detection, layout formatting, and bullet alignment.',
                color: 'bg-blue-600',
              },
              {
                ext: 'PNG',
                title: 'High-Res Images',
                desc: 'Photos, IDs, certificates, and diagrams scaled perfectly to A4 dimensions.',
                color: 'bg-emerald-600',
              },
              {
                ext: 'JPG',
                title: 'Color Photos & Scans',
                desc: 'Vibrant color reproduction and sharp monochrome document reproduction.',
                color: 'bg-amber-600',
              },
            ].map(f => (
              <div key={f.ext} className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4 hover:border-sky-300 hover:shadow-xl transition-all">
                <div className={`w-12 h-12 rounded-2xl ${f.color} text-white flex items-center justify-center font-mono font-black text-sm shadow-md`}>
                  {f.ext}
                </div>
                <h3 className="font-black text-lg text-slate-900">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER & FINAL PRINT CTA ── */}
      <footer className="bg-[#0e1628] text-white pt-16 pb-12 px-4 md:px-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Giant Call to Action */}
          <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-8 md:p-14 rounded-[36px] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-sky-950">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Ready to Print Your Document?
              </h3>
              <p className="text-sky-100 text-sm font-medium">
                No app installation required. Upload now and get your 6-digit code in seconds.
              </p>
            </div>
            <button
              onClick={() => {
                triggerSound('tap');
                router.push('/remote');
              }}
              className="px-8 py-4 bg-white hover:bg-sky-50 text-slate-900 font-black text-base rounded-2xl shadow-xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
            >
              <Zap className="w-5 h-5 text-sky-600" />
              <span>START PRINTING NOW</span>
              <ArrowRight className="w-5 h-5 text-slate-900" />
            </button>
          </div>

          {/* Bottom Copyright & Branding */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-800/80 pt-8">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-slate-300">Print Bro Cloud Printing Ecosystem</span>
            </div>
            <div>
              Powered by Neon Cloud PostgreSQL & Render Node.js WebSockets
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
