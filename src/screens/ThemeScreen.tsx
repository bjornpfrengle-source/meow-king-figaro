import { Clock, Sparkles, AlertCircle, Camera, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThemes, Countdown } from '../components/themes';

export function ThemeScreen() {
  const navigate = useNavigate();
  const { active, upcoming, loading } = useThemes();

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col overflow-y-auto pb-24 relative">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100">
        <h1 className="text-xl font-black text-neutral-800">Daily Theme</h1>
        {active && (
          <div className="flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-full">
            <Clock className="w-4 h-4 text-red-400" />
            <Countdown toMs={active.endMs} className="text-sm font-bold text-red-400" />
          </div>
        )}
      </div>

      <div className="px-6 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-red-400 animate-spin" /></div>
        ) : (
          <>
            {/* Active challenge */}
            {active ? (
              <div className="bg-gradient-to-br from-red-400 to-orange-400 rounded-[2rem] p-6 text-white shadow-lg shadow-red-400/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    <span className="font-bold text-yellow-300 tracking-wide uppercase text-sm">Today's Challenge</span>
                  </div>
                  <h2 className="text-4xl font-black mb-2 leading-tight">{active.title}</h2>
                  <p className="text-white/90 font-medium mb-4 text-sm">{active.description}</p>
                  <div className="flex items-center gap-1.5 text-white/90 mb-6">
                    <Clock className="w-4 h-4" />
                    <Countdown toMs={active.endMs} className="text-sm font-bold" />
                    <span className="text-sm font-bold">left</span>
                  </div>
                  <button
                    onClick={() => navigate(`/upload?event=${encodeURIComponent(active.slug)}`)}
                    className="w-full bg-white text-red-500 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    ENTER NOW
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-neutral-100 rounded-[2rem] p-6 text-center">
                <h2 className="text-xl font-black text-neutral-800 mb-1">No active theme right now</h2>
                <p className="text-neutral-500 text-sm">Check back soon — a new challenge is on the way!</p>
              </div>
            )}

            {/* Upcoming challenges */}
            {upcoming.map((t) => (
              <div key={t.id} className="bg-white border-2 border-neutral-100 rounded-[2rem] p-6 text-neutral-800 shadow-sm relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-neutral-400" />
                    <span className="font-bold text-neutral-400 tracking-wide uppercase text-sm">Upcoming Challenge</span>
                  </div>
                  <h2 className="text-2xl font-black mb-2 leading-tight text-neutral-800">{t.title}</h2>
                  <p className="text-neutral-500 font-medium mb-4 text-sm">{t.description}</p>
                  <div className="w-full bg-neutral-100 text-neutral-500 font-black py-3 rounded-2xl flex items-center justify-center gap-2">
                    <Clock className="w-5 h-5" />
                    Starts in <Countdown toMs={t.startMs} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Rules Section */}
      <div className="px-6 mb-8">
        <h3 className="font-black text-lg text-neutral-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-teal-400" />
          Rules &amp; Tips
        </h3>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-red-50 space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 text-teal-500 font-black">1</div>
            <p className="text-sm font-medium text-neutral-600 pt-1">Video must be under 15 seconds.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 text-teal-500 font-black">2</div>
            <p className="text-sm font-medium text-neutral-600 pt-1">Original audio or trending sounds allowed.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 text-teal-500 font-black">3</div>
            <p className="text-sm font-medium text-neutral-600 pt-1">No humans in the frame, just pure cat chaos!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
