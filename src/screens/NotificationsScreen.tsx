import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Flame, MessageCircle, Loader2, BellOff, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { useThemes } from '../components/themes';
import { WinnerCelebrationModal } from '../components/WinnerCelebrationModal';

interface CelebrationData {
  catName: string;
  videoUrl: string;
  themeName: string;
  votes: number;
}

interface NotifItem {
  id: string;
  kind: 'theme' | 'comment' | 'result' | 'winner';
  title: string;
  message: string;
  time: string;
  celebrationData?: CelebrationData;
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

function catLingoResult(rank: number, total: number, catName: string, votes: number, themeName: string): string {
  if (rank === 1) return `Purrfection achieved! 🏆 ${catName} dominated "${themeName}" with ${votes} votes. You're the reigning Meow King!`;
  if (rank === 2) return `So close, fur real! 🥈 ${catName} clawed to 2nd in "${themeName}" with ${votes} votes. Runner-up royalty!`;
  if (rank === 3) return `Pretty pawsome podium! 🥉 ${catName} landed 3rd in "${themeName}" with ${votes} votes. The fur was flying!`;
  if (rank <= Math.ceil(total / 2)) return `Not bad fur a kitty! 😸 ${catName} raked in ${votes} votes in "${themeName}". Top half of the pride — keep clawing!`;
  return `Don't paw-nder it! 🐾 ${catName} got ${votes} votes in "${themeName}". Every whisker counts — enter again next time!`;
}

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { active, themes } = useThemes();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  useEffect(() => {
    const build = async () => {
      const list: NotifItem[] = [];
      const now = Date.now();

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

      if (user) {
        // 2) Recently ended theme results (last 7 days)
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const recentlyEnded = themes.filter(t => t.endMs < now && t.endMs > sevenDaysAgo);

        for (const theme of recentlyEnded) {
          try {
            const userCatsSnap = await getDocs(
              query(collection(db, 'cats'), where('ownerId', '==', user.uid), where('theme', '==', theme.slug))
            );
            if (userCatsSnap.empty) continue;

            const allCatsSnap = await getDocs(
              query(collection(db, 'cats'), where('theme', '==', theme.slug))
            );
            const allCats = allCatsSnap.docs
              .map(d => ({ id: d.id, ...(d.data() as any) }))
              .sort((a, b) => (b.score || 0) - (a.score || 0));
            const total = allCats.length;

            const daysAgo = Math.round((now - theme.endMs) / (24 * 60 * 60 * 1000));
            const timeStr = daysAgo === 0 ? 'Just ended' : `${daysAgo}d ago`;

            userCatsSnap.forEach(d => {
              const myCat = { id: d.id, ...(d.data() as any) };
              const rank = allCats.findIndex(c => c.id === d.id) + 1;
              const votes = myCat.score || 0;
              const isWinner = rank === 1 && total > 1;

              if (isWinner && myCat.videoUrl) {
                const cd: CelebrationData = {
                  catName: myCat.name || 'Your cat',
                  videoUrl: myCat.videoUrl,
                  themeName: theme.title,
                  votes,
                };
                list.unshift({
                  id: `winner-${theme.id}-${d.id}`,
                  kind: 'winner',
                  title: `👑 ${myCat.name || 'Your cat'} WON "${theme.title}"!`,
                  message: `Tap to celebrate your Meow King moment 🏆`,
                  time: timeStr,
                  celebrationData: cd,
                  onClick: () => setCelebration(cd),
                });
              } else {
                list.push({
                  id: `result-${theme.id}-${d.id}`,
                  kind: 'result',
                  title: `Results: "${theme.title}"`,
                  message: catLingoResult(rank, total, myCat.name || 'Your cat', votes, theme.title),
                  time: timeStr,
                });
              }
            });
          } catch (e) {
            console.error('Error loading theme results:', e);
          }
        }

        // 3) Recent comments on user's cats
        try {
          const catsSnap = await getDocs(query(collection(db, 'cats'), where('ownerId', '==', user.uid)));
          const catNameById: Record<string, string> = {};
          const catIds: string[] = [];
          catsSnap.forEach(d => { catNameById[d.id] = d.data().name || 'your cat'; catIds.push(d.id); });

          if (catIds.length > 0) {
            const commentsSnap = await getDocs(
              query(collection(db, 'comments'), where('catId', 'in', catIds.slice(0, 10)))
            );
            commentsSnap.docs
              .map(d => ({ id: d.id, ...(d.data() as any) }))
              .filter(c => c.userId !== user.uid)
              .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
              .slice(0, 20)
              .forEach(c => {
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
          console.error('Error loading comments:', e);
        }
      }

      setItems(list);
      setLoading(false);
    };

    build();
  }, [user, active, themes, navigate]);

  if (celebration) {
    return (
      <WinnerCelebrationModal
        catName={celebration.catName}
        videoUrl={celebration.videoUrl}
        themeName={celebration.themeName}
        votes={celebration.votes}
        onClose={() => setCelebration(null)}
      />
    );
  }

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
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
            <p className="text-neutral-500 font-medium text-sm">Theme results and comments will show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((notif, index) => {
              const Icon = notif.kind === 'theme' ? Flame
                : notif.kind === 'winner' || notif.kind === 'result' ? Trophy
                : MessageCircle;
              const bg = notif.kind === 'theme' ? 'bg-orange-100'
                : notif.kind === 'winner' ? 'bg-yellow-100'
                : notif.kind === 'result' ? 'bg-blue-50'
                : 'bg-teal-100';
              const iconColor = notif.kind === 'theme' ? 'text-orange-500'
                : notif.kind === 'winner' ? 'text-yellow-500'
                : notif.kind === 'result' ? 'text-blue-400'
                : 'text-teal-500';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={notif.id}
                  onClick={notif.onClick}
                  className={`p-4 rounded-2xl flex gap-4 items-start border shadow-sm
                    ${notif.kind === 'winner'
                      ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
                      : 'bg-white border-pink-100'}
                    ${notif.onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-neutral-800">{notif.title}</h3>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-2 line-clamp-3">{notif.message}</p>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{notif.time}</span>
                  </div>
                  {notif.kind === 'winner' && <div className="text-2xl self-center">👑</div>}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
