import { motion } from 'motion/react';
import { Sparkles, Crown, Zap, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PremiumScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-neutral-900 flex flex-col pb-24 relative">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-purple-900/50 to-transparent pointer-events-none"></div>
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-600/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-32 -left-24 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex-1 px-6 pt-4 pb-8 flex flex-col relative z-10">
        <div className="text-center mb-8">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 rounded-[2rem] mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(251,191,36,0.4)] border-2 border-yellow-200 rotate-12 relative"
          >
            <Crown className="w-12 h-12 text-white fill-white drop-shadow-md -rotate-12" />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-200" />
          </motion.div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-2 tracking-tight">
            Catnip Club
          </h1>
          <p className="text-purple-200 font-medium text-lg">VIP access for elite felines.</p>
        </div>

        {/* Perks */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-8 space-y-5 shadow-2xl">
          {[
            { icon: <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />, text: '3 Extra Daily Entries' },
            { icon: <Star className="w-5 h-5 text-fuchsia-400 fill-fuchsia-400" />, text: 'Glowing Video Borders' },
            { icon: <Sparkles className="w-5 h-5 text-teal-400 fill-teal-400" />, text: 'Custom Paw-Print Colors' },
            { icon: <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />, text: 'Priority Matchmaking' }
          ].map((perk, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                {perk.icon}
              </div>
              <span className="font-bold text-white text-lg">{perk.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-4">
          <div className="flex gap-3 opacity-60">
            <div className="flex-1 border border-white/10 bg-white/5 backdrop-blur-md rounded-2xl p-4 text-center">
              <p className="text-sm font-bold text-purple-300 mb-1 uppercase tracking-wider">Monthly</p>
              <p className="text-2xl font-black text-white">$4.99</p>
            </div>
            <div className="flex-1 border-2 border-amber-400 bg-amber-400/10 backdrop-blur-md rounded-2xl p-4 text-center relative shadow-[0_0_20px_rgba(251,191,36,0.2)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap shadow-lg">
                BEST VALUE
              </div>
              <p className="text-sm font-bold text-amber-400 mb-1 uppercase tracking-wider">Yearly</p>
              <p className="text-2xl font-black text-white">$39.00</p>
            </div>
          </div>

          <button disabled className="w-full bg-white/10 border border-white/20 text-white/80 py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-2 mt-2 cursor-default">
            <Crown className="w-6 h-6" /> Coming Soon
          </button>

          <p className="text-center text-xs font-medium text-white/40 mt-4">
            Catnip Club is launching soon — stay tuned! 🐱
          </p>
        </div>
      </div>
    </div>
  );
}
