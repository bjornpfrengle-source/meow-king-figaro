import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, getDoc, doc, addDoc, serverTimestamp, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { useThemes } from '../components/themes';

/**
 * PROTOTYPE — WWDC "Book Club" inspired Arena look. Reachable only at
 * /arena-preview. Does not touch the real Arena/Leaderboard screen.
 */

interface Row {
  id: string;
  name: string;
  owner: string;
  score: number;
  img?: string;
  trend: 'up' | 'down' | 'same';
}

interface Msg {
  id: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: any;
}

function timeAgo(ts: any): string {
  if (!ts?.toDate) return '';
  const s = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ArenaPreviewScreen() {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { active } = useThemes();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  // Leaderboard (active theme, falls back to all-time if no active theme)
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cats')));
        let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((c: any) => !!c.videoUrl);
        if (active) list = list.filter((c: any) => c.theme === active.slug);
        list.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
        list = list.slice(0, 8);
        const enriched = await Promise.all(list.map(async (c: any) => {
          let owner = 'Anonymous';
          let img = c.thumbnailUrl || c.catThumbnailUrl;
          if (c.ownerId) {
            try {
              const u = await getDoc(doc(db, 'users', c.ownerId));
              if (u.exists()) {
                owner = u.data().displayName || 'Anonymous';
                if (!img) img = c.selectedCatId === 'cat2' ? u.data().catThumbnailUrl2 : u.data().catThumbnailUrl;
              }
            } catch (e) { /* ignore */ }
          }
          // trend is illustrative in the prototype
          const trend: Row['trend'] = (c.score || 0) > 0 ? 'up' : 'same';
          return { id: c.id, name: c.name, owner, score: c.score || 0, img, trend };
        }));
        setRows(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, active]);

  // Discussion (community chat)
  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).reverse());
    }, () => {});
    return () => unsub();
  }, []);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        text: newComment.trim(),
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || '',
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const shownMessages = showAll ? messages : messages.slice(-3);

  const trendIcon = (t: Row['trend']) =>
    t === 'up' ? <ChevronUp className="w-4 h-4 text-emerald-500" />
    : t === 'down' ? <ChevronDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-3.5 h-3.5 text-neutral-300" />;

  return (
    <div className="flex-1 overflow-y-auto bg-white flex flex-col pb-28">
      {/* Header */}
      <div className="pt-4 pb-3 px-5 flex items-center gap-3 bg-white/80 backdrop-blur-xl sticky top-0 z-20 border-b border-neutral-100">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 text-neutral-500 active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider leading-none">
            {active ? active.title : 'All-Time'}
          </p>
          <h1 className="text-lg font-bold text-neutral-900 leading-tight">Leaderboard</h1>
        </div>
      </div>

      {/* Ranking list */}
      <div className="px-5 pt-2">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-neutral-300 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-neutral-400 text-sm text-center py-12">No entries yet — be the first!</p>
        ) : (
          <div>
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 py-3 border-b border-neutral-100 last:border-0">
                <span className="w-5 text-sm font-semibold text-neutral-400 text-center">{i + 1}</span>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 shrink-0">
                  {r.img ? (
                    <img src={r.img} alt={r.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs font-bold">{r.name.charAt(0)}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900 text-[15px] truncate leading-tight">{r.name}</p>
                  <p className="text-xs text-neutral-400 truncate">{r.owner}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-neutral-500 tabular-nums">{r.score}pts</span>
                  {trendIcon(r.trend)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discussion */}
      <div className="mt-4 px-5">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Discussion</p>
        <div className="bg-neutral-50 rounded-2xl p-2">
          {messages.length === 0 ? (
            <p className="text-neutral-400 text-sm text-center py-6">No messages yet. Start the conversation!</p>
          ) : (
            <>
              {shownMessages.map((m) => (
                <div key={m.id} className="flex gap-3 p-2.5">
                  <img
                    src={m.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.userName)}&background=random`}
                    alt={m.userName}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-neutral-900 text-sm truncate">{m.userName}</span>
                      <span className="text-[11px] text-neutral-400 shrink-0">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-neutral-600 leading-snug">{m.text}</p>
                  </div>
                </div>
              ))}
              {messages.length > 3 && (
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="w-full text-center text-xs font-semibold text-neutral-500 py-2 flex items-center justify-center gap-1"
                >
                  {showAll ? 'Show less' : 'Show all'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add a comment */}
      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-[400px] bg-white/90 backdrop-blur-xl border-t border-neutral-100 px-4 py-3 pb-6 z-30">
        <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-4 py-2.5">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder={user ? 'Add a comment' : 'Sign in to comment'}
            disabled={!user}
            className="flex-1 bg-transparent outline-none text-sm text-neutral-800 placeholder:text-neutral-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newComment.trim()}
            className="text-sm font-semibold text-neutral-900 disabled:text-neutral-300"
          >
            {sending ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
