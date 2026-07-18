import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Flame, MessageCircle, Loader2, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { useThemes } from '../components/themes';

interface NotifItem {
  id: string;
  kind: 'theme' | 'comment';
  title: string;
  message: string;
  time: string;
  onClick?: () => void;
}

function timeAgo(ts: any): string {
  if (!ts?.toDate) return '';
  const secs = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { active } = useThemes();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const build = async () => {
      const list: NotifItem[] = [];

      // 1) Active theme reminder
      if (active) {
        list.push({
          id: `theme-${active.id}`,
          kind: 'theme',
          title: `Today's theme: ${active.title}`,
          message: active.description || 'Enter now to compete!',
          time: 'Live now',
          onClick: () => navigate(`/upload?event=${encodeURIComponent(active.slug)}`),
        });
      }

      // 2) Recent comments on the user's cats
      if (user) {
        try {
          const catsSnap = await getDocs(query(collection(db, 'cats'), where('ownerId', '==', user.uid)));
          const catNameById: Record<string, string> = {};
          const catIds: string[] = [];
          catsSnap.forEach((d) => { catNameById[d.id] = d.data().name || 'your cat'; catIds.push(d.id); });

          if (catIds.length > 0) {
            // Firestore "in" supports up to 10 values; sort client-side to avoid a composite index
            const ids = catIds.slice(0, 10);
            const commentsSnap = await getDocs(
              query(collection(db, 'comments'), where('catId', 'in', ids))
            );
            const comments = commentsSnap.docs
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
              .filter((c) => c.userId !== user.uid)
              .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
              .slice(0, 20);
            comments.forEach((c) => {
              list.push({
                id: `comment-${c.id}`,
                kind: 'comment',
                title: `New comment on ${catNameById[c.catId] || 'your cat'}`,
                message: `"${c.text}" — ${c.userName || 'Someone'}`,
                time: timeAgo(c.createdAt),
              });
            });
          }
        } catch (e) {
          console.error('Error loading notifications:', e);
        }
      }

      setItems(list);
      setLoading(false);
    };

    build();
  }, [user, active, navigate]);

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-pink-100">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-pink-50 rounded-full text-pink-500 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Notifications</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-pink-500 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <BellOff className="w-14 h-14 text-neutral-300" />
            <p className="font-black text-neutral-800 text-lg">You're all caught up!</p>
            <p className="text-neutral-500 font-medium text-sm">Comments and theme updates will show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((notif, index) => {
              const Icon = notif.kind === 'theme' ? Flame : MessageCircle;
              const bg = notif.kind === 'theme' ? 'bg-orange-100' : 'bg-teal-100';
              const color = notif.kind === 'theme' ? 'text-orange-500' : 'text-teal-500';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={notif.id}
                  onClick={notif.onClick}
                  className={`p-4 rounded-2xl flex gap-4 items-start border bg-white border-pink-100 shadow-sm ${notif.onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-neutral-800">{notif.title}</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-2 line-clamp-2">{notif.message}</p>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{notif.time}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
