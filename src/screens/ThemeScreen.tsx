import { motion } from 'motion/react';
import { Clock, Play, ChevronRight, Sparkles, AlertCircle, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ThemeScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col overflow-y-auto pb-24 relative">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100">
        <h1 className="text-xl font-black text-neutral-800">Daily Theme</h1>
        <div className="flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-full">
          <Clock className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-red-400">23h 45m</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="px-6 py-6">
        <div className="bg-gradient-to-br from-red-400 to-orange-400 rounded-[2rem] p-6 text-white shadow-lg shadow-red-400/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-10 -mb-10"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="font-bold text-yellow-300 tracking-wide uppercase text-sm">Today's Challenge</span>
            </div>
            <h2 className="text-4xl font-black mb-2 leading-tight">Zoomies<br/>Champion</h2>
            <p className="text-white/90 font-medium mb-6 text-sm">
              Capture your cat's wildest, most chaotic burst of energy! The more blur, the better.
            </p>
            
            <button 
              onClick={() => navigate('/upload')}
              className="w-full bg-white text-red-500 font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              ENTER NOW
            </button>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div className="px-6 mb-8">
        <h3 className="font-black text-lg text-neutral-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-teal-400" />
          Rules & Tips
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

      {/* Inspiration */}
      <div className="px-6 mb-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-black text-lg text-neutral-800">Inspiration</h3>
          <button className="text-red-400 font-bold text-sm flex items-center">
            See All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            { id: 1, image: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', title: 'Midnight Madness' },
            { id: 2, image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80', title: 'Hallway Sprint' }
          ].map((item) => (
            <div key={item.id} className="relative rounded-2xl overflow-hidden aspect-[3/4] shadow-sm">
              <img src={item.image} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white font-bold text-sm truncate">{item.title}</p>
              </div>
              <div className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
