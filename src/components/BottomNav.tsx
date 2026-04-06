import { NavLink, useLocation } from 'react-router-dom';
import { Home, Trophy, Plus, ThumbsUp, BarChart2, Swords } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  
  // Hide nav on onboarding
  if (location.pathname === '/onboarding') return null;

  const isVotePage = location.pathname === '/vote';

  const navItems = [
    { path: '/home', icon: Home, label: 'Home' },
    { path: '/theme', icon: Trophy, label: 'Theme' },
    { path: isVotePage ? '/vote' : '/upload', icon: isVotePage ? Swords : Plus, label: isVotePage ? 'Battle' : 'Upload', isCenter: true },
    { path: '/vote', icon: ThumbsUp, label: 'Vote' },
    { path: '/leaderboard', icon: BarChart2, label: 'Arena' },
  ];

  return (
    <div className="relative z-50 bg-white border-t border-pink-100 px-6 py-3 pb-6 flex justify-between items-center shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        
        if (item.isCenter) {
          return (
            <NavLink 
              key="center-btn" 
              to={item.path} 
              onClick={(e) => {
                if (isVotePage) {
                  e.preventDefault(); // Prevent navigation if it's just the battle icon
                  window.dispatchEvent(new CustomEvent('next-battle'));
                }
              }}
              className="relative -top-6 flex justify-center items-center"
            >
              {isVotePage && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[106px] h-[106px] pointer-events-none">
                  <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                    <path id="battle-curve-bottom" d="M 10 45 A 40 40 0 0 0 90 45" fill="transparent" />
                    <text className="text-[15px] font-black uppercase tracking-[0.2em] fill-orange-500 drop-shadow-sm">
                      <textPath href="#battle-curve-bottom" startOffset="50%" textAnchor="middle" dominantBaseline="hanging">BATTLE</textPath>
                    </text>
                  </svg>
                </div>
              )}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg text-white transform transition-transform active:scale-95 border-4 border-white ${isVotePage ? 'bg-gradient-to-br from-orange-400 to-red-500 shadow-orange-500/30' : 'bg-red-400 shadow-red-400/30'}`}>
                <Icon className="w-7 h-7" strokeWidth={2.5} />
              </div>
            </NavLink>
          );
        }

        return (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${isActive ? 'text-red-400' : 'text-neutral-400 hover:text-red-300'}`}
          >
            <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide uppercase">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
