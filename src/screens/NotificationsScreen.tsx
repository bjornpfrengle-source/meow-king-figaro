import { motion } from 'motion/react';
import { ChevronLeft, Star, Trophy, Users, Award, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationsScreen() {
  const navigate = useNavigate();

  const notifications = [
    {
      id: 1,
      icon: Handshake,
      color: 'text-purple-500',
      bg: 'bg-purple-100',
      title: 'Incoming Partnership!',
      message: 'MeowMagic Co. wants to sponsor your next video.',
      time: '2m ago',
      unread: true
    },
    {
      id: 2,
      icon: Trophy,
      color: 'text-yellow-500',
      bg: 'bg-yellow-100',
      title: 'Kitten League Coming Soon',
      message: 'Get ready! A new league for kittens under 1 year starts next week.',
      time: '1h ago',
      unread: true
    },
    {
      id: 3,
      icon: Users,
      color: 'text-teal-500',
      bg: 'bg-teal-100',
      title: 'Introduce your feline fighter to the pride',
      message: 'Complete your profile and let everyone meet your champion.',
      time: '3h ago',
      unread: false
    },
    {
      id: 4,
      icon: Star,
      color: 'text-orange-500',
      bg: 'bg-orange-100',
      title: 'Sir Pounce-a-lot Wins!',
      message: 'Your cat took 1st place in the "Box Destroyer" daily theme.',
      time: '1d ago',
      unread: false
    },
    {
      id: 5,
      icon: Award,
      color: 'text-red-500',
      bg: 'bg-red-100',
      title: 'Captain Cuddles you placed 3rd!',
      message: 'You placed 3rd in Lazy Sunday task. Collect your Points and special medal.',
      time: '2d ago',
      unread: false
    }
  ];

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-pink-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-pink-50 rounded-full text-pink-500 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Notifications</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="space-y-4">
          {notifications.map((notif, index) => {
            const Icon = notif.icon;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                key={notif.id}
                className={`p-4 rounded-2xl flex gap-4 items-start border ${notif.unread ? 'bg-white border-pink-200 shadow-sm' : 'bg-white/60 border-transparent'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${notif.bg}`}>
                  <Icon className={`w-6 h-6 ${notif.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-bold text-sm ${notif.unread ? 'text-neutral-800' : 'text-neutral-600'}`}>
                      {notif.title}
                    </h3>
                    {notif.unread && <span className="w-2 h-2 bg-red-400 rounded-full mt-1.5 shrink-0"></span>}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                    {notif.message}
                  </p>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    {notif.time}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
