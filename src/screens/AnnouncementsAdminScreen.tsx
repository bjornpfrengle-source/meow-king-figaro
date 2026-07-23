import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Loader2, Megaphone, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { ConfirmModal } from '../components/ConfirmModal';

interface Announcement {
  id: string;
  title: string;
  body?: string;
  videoUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  isActive: boolean;
  createdAt?: any;
}

export function AnnouncementsAdminScreen() {
  const navigate = useNavigate();
  const { isAuthReady, isAdmin } = useFirebase();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'announcements'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Announcement[];
      list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setAnnouncements(list);
      setLoadingList(false);
    }, () => setLoadingList(false));
    return unsub;
  }, []);

  const handleAdd = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!body.trim() && !videoUrl.trim()) { setError('Add either a message or a video URL.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        body: body.trim(),
        videoUrl: videoUrl.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: ctaUrl.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
      });
      setTitle(''); setBody(''); setVideoUrl(''); setCtaLabel(''); setCtaUrl('');
    } catch (e: any) {
      console.error('Error saving announcement:', e);
      setError('Could not save. Check admin access.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'announcements', id), { isActive: !current });
    } catch (e) {
      console.error('Error toggling announcement:', e);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try { await deleteDoc(doc(db, 'announcements', toDelete)); }
    catch (e) { console.error('Error deleting announcement:', e); }
    finally { setToDelete(null); }
  };

  if (isAuthReady && !isAdmin) {
    return (
      <div className="flex-1 bg-[#FFF5F5] flex flex-col items-center justify-center px-8 text-center gap-4">
        <ShieldAlert className="w-16 h-16 text-neutral-300" />
        <h2 className="font-black text-xl text-neutral-800">Admins only</h2>
        <button onClick={() => navigate('/home')} className="mt-2 bg-red-400 text-white px-6 py-3 rounded-full font-bold shadow-md active:scale-95 transition-transform">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/90 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-black text-neutral-800">Announcements</h1>
        </div>
      </div>

      <div className="px-5 space-y-3">
        {/* Add form */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-purple-50 space-y-3">
          <h2 className="font-black text-neutral-800">New announcement</h2>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (e.g. Big News! 🐱)"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-purple-400"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Message / announcement text (optional if using a video)"
            rows={4}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-purple-400 resize-none"
          />
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wide">Video URL (optional)</label>
            <input
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://... paste a video link"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder="Button label (optional)"
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-purple-400"
            />
            <input
              value={ctaUrl}
              onChange={e => setCtaUrl(e.target.value)}
              placeholder="Button URL"
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-purple-400"
            />
          </div>
          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-purple-500 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Deploy announcement
          </button>
        </div>

        {/* List */}
        <h2 className="font-black text-neutral-800 mt-2 mb-1 px-1">All announcements ({announcements.length})</h2>
        <p className="text-xs text-neutral-400 px-1 mb-3">Active ones pop up to users when they open the app (once per session).</p>

        {loadingList ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">No announcements yet.</p>
        ) : (
          <div className="space-y-2 pb-4">
            {announcements.map(a => (
              <div key={a.id} className={`flex items-start gap-3 p-4 rounded-2xl border shadow-sm ${a.isActive ? 'bg-purple-50 border-purple-200' : 'bg-neutral-100 border-neutral-200 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-neutral-800 truncate">{a.title}</p>
                    {a.isActive && <span className="text-[9px] font-black uppercase bg-purple-500 text-white px-1.5 py-0.5 rounded shrink-0">Live</span>}
                  </div>
                  {a.body && <p className="text-xs text-neutral-500 line-clamp-2 mb-1">{a.body}</p>}
                  {a.videoUrl && <p className="text-[10px] text-purple-400 font-bold">📹 Has video</p>}
                  {a.ctaLabel && <p className="text-[10px] text-neutral-400">CTA: {a.ctaLabel}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(a.id, a.isActive)}
                    className="p-2 text-neutral-400 hover:text-purple-500 active:scale-90 transition-all"
                    aria-label={a.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {a.isActive
                      ? <ToggleRight className="w-5 h-5 text-purple-500" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>
                  <button
                    onClick={() => setToDelete(a.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 active:scale-90 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Delete this announcement?"
        message="This will remove it permanently."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
