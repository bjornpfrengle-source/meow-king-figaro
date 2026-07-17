import { useState } from 'react';
import { ChevronLeft, Plus, Trash2, Loader2, CalendarClock, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { useThemes } from '../components/themes';

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmt(ms: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ThemeAdminScreen() {
  const navigate = useNavigate();
  const { userProfile, isAuthReady } = useFirebase();
  const { themes, loading } = useThemes();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'daily' | 'weekly' | 'surprise'>('daily');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = userProfile?.role === 'admin';

  const handleAdd = async () => {
    setError('');
    if (!title.trim() || !start || !end) {
      setError('Title, start and end are required.');
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) {
      setError('End must be after start.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'themes'), {
        title: title.trim(),
        slug: slugify(title),
        description: description.trim(),
        type,
        startAt: Timestamp.fromDate(startDate),
        endAt: Timestamp.fromDate(endDate),
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setDescription('');
      setStart('');
      setEnd('');
      setType('daily');
    } catch (e: any) {
      console.error('Error adding theme:', e);
      setError('Could not save. Check that you are an admin and rules are published.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this theme?')) return;
    try {
      await deleteDoc(doc(db, 'themes', id));
    } catch (e) {
      console.error('Error deleting theme:', e);
    }
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

  const now = Date.now();

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/90 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-teal-500" />
          <h1 className="text-xl font-black text-neutral-800">Themes Roster</h1>
        </div>
      </div>

      {/* Add form */}
      <div className="px-5">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-teal-50 space-y-3">
          <h2 className="font-black text-neutral-800">Add a theme</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Lazy Sundays)"
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-400"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description shown to users"
            rows={2}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-400 resize-none"
          />
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wide">Starts</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wide">Ends</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wide">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-teal-400">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="surprise">Surprise</option>
            </select>
          </div>
          {error && <p className="text-xs font-bold text-red-500">{error}</p>}
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full bg-teal-500 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} Add theme
          </button>
        </div>

        {/* Existing themes */}
        <h2 className="font-black text-neutral-800 mt-6 mb-3 px-1">Scheduled ({themes.length})</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
        ) : themes.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center py-6">No themes yet. Add your first above.</p>
        ) : (
          <div className="space-y-2">
            {themes.map((t) => {
              const isActive = t.startMs <= now && t.endMs > now;
              const isPast = t.endMs <= now;
              return (
                <div key={t.id} className={`flex items-center gap-3 p-3 rounded-2xl border shadow-sm ${isActive ? 'bg-teal-50 border-teal-200' : isPast ? 'bg-neutral-100 border-neutral-200 opacity-60' : 'bg-white border-neutral-100'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-neutral-800 truncate">{t.title}</p>
                      {isActive && <span className="text-[9px] font-black uppercase bg-teal-500 text-white px-1.5 py-0.5 rounded">Live</span>}
                      <span className="text-[9px] font-bold uppercase text-neutral-400">{t.type}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500">{fmt(t.startMs)} → {fmt(t.endMs)}</p>
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="p-2 text-neutral-400 hover:text-red-500 active:scale-90 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
