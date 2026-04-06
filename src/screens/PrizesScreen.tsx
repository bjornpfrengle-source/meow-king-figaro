import { motion } from 'motion/react';
import { ChevronLeft, Gift, Star, ShoppingBag, Award, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrizesScreen() {
  const navigate = useNavigate();

  const prizes = [
    {
      id: 1,
      title: '1 Year Supply of Premium Catnip',
      sponsor: 'MeowMagic Co.',
      value: '$120 Value',
      image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      type: 'Weekly Grand Prize'
    },
    {
      id: 2,
      title: 'Smart Laser Toy 3000',
      sponsor: 'FelineFine Tech',
      value: '$45 Value',
      image: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      type: 'Daily Runner-Up'
    },
    {
      id: 3,
      title: 'Luxury Velvet Cat Bed',
      sponsor: 'Pawsome Living',
      value: '$85 Value',
      image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      type: 'Monthly Legend'
    }
  ];

  const partners = [
    { name: 'MeowMagic Co.', icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { name: 'FelineFine Tech', icon: Award, color: 'text-teal-500', bg: 'bg-teal-50' },
    { name: 'Pawsome Living', icon: ShoppingBag, color: 'text-red-400', bg: 'bg-red-50' },
    { name: 'Happy Whiskers', icon: Gift, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-red-50 rounded-full text-red-400 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Prizes & Partners</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-12">
        {/* Hero Section */}
        <div className="text-center mt-6 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-neutral-800 mb-2">Win Purr-fect<br/>Rewards!</h2>
          <p className="text-neutral-500 font-medium text-sm px-4 mb-3">
            Top the leaderboards to win real prizes sponsored by our amazing partners.
          </p>
          <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-orange-100">
            🇦🇺 AU-only shipping for now
          </div>
        </div>

        {/* Prizes List */}
        <div className="space-y-6 mb-10">
          <h3 className="font-black text-xl text-neutral-800 flex items-center gap-2">
            <Award className="w-6 h-6 text-red-400" /> Featured Prizes
          </h3>
          
          {prizes.map((prize, index) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={prize.id} 
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-red-100"
            >
              <div className="h-40 relative">
                <img src={prize.image} alt={prize.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black text-neutral-800 shadow-sm">
                  {prize.type}
                </div>
                <div className="absolute bottom-3 right-3 bg-red-400 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
                  {prize.value}
                </div>
              </div>
              <div className="p-5">
                <h4 className="font-black text-lg text-neutral-800 mb-1 leading-tight">{prize.title}</h4>
                <p className="text-sm font-medium text-neutral-500 flex items-center gap-1">
                  Sponsored by <span className="text-red-400 font-bold">{prize.sponsor}</span>
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Partners Grid */}
        <div>
          <h3 className="font-black text-xl text-neutral-800 flex items-center gap-2 mb-4">
            <Star className="w-6 h-6 text-yellow-500" /> Our Partners
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {partners.map((partner, index) => {
              const Icon = partner.icon;
              return (
                <div key={index} className="bg-white p-4 rounded-2xl border border-red-50 shadow-sm flex flex-col items-center text-center gap-2 active:scale-95 transition-transform cursor-pointer">
                  <div className={`w-12 h-12 rounded-full ${partner.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${partner.color}`} />
                  </div>
                  <span className="font-bold text-neutral-700 text-sm">{partner.name}</span>
                  <ExternalLink className="w-3 h-3 text-neutral-300" />
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
