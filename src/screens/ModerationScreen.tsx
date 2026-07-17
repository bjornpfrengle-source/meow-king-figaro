import { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, ShieldAlert, Trash2, Ban, Check, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Report {
  id: string;
  reporterId: string;
  targetType: 'cat' | 'comment';
  targetId: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: any;
}

interface TargetInfo {
  loading: boolean;
  exists: boolean;
  ownerId?: string;
  // cat
  name?: string;
  videoUrl?: string;
  // comment
  text?: string;
  userName?: string;
}

export function ModerationScreen() {
  const navigate = useNavigate();
  const { user, isAuthReady, isAdmin } = useFirebase();
  const [reports, setReports] = useState<Report[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetInfo>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      setReports(fetched);
      setLoading(false);
    }, (error) => {
      console.error('Error loading reports:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Load the reported content for each report
  useEffect(() => {
    reports.forEach(async (report) => {
      if (targets[report.id]) return;
      setTargets(prev => ({ ...prev, [report.id]: { loading: true, exists: false } }));

      try {
        const collectionName = report.targetType === 'comment' ? 'comments' : 'cats';
        const snap = await getDoc(doc(db, collectionName, report.targetId));
        if (!snap.exists()) {
          setTargets(prev => ({ ...prev, [report.id]: { loading: false, exists: false } }));
          return;
        }
        const data = snap.data();
        setTargets(prev => ({
          ...prev,
          [report.id]: {
            loading: false,
            exists: true,
            ownerId: data.ownerId || data.userId,
            name: data.name,
            videoUrl: data.videoUrl,
            text: data.text,
            userName: data.userName,
          },
        }));
      } catch (e) {
        console.error('Error loading target:', e);
        setTargets(prev => ({ ...prev, [report.id]: { loading: false, exists: false } }));
      }
    });
  }, [reports]);

  const resolveReport = async (reportId: string, status: string) => {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      resolvedBy: user?.uid,
      resolvedAt: serverTimestamp(),
    });
  };

  const handleRemove = async (report: Report) => {
    setBusyId(report.id);
    try {
      const collectionName = report.targetType === 'comment' ? 'comments' : 'cats';
      await deleteDoc(doc(db, collectionName, report.targetId));
      await resolveReport(report.id, 'removed');
    } catch (e) {
      console.error('Error removing content:', e);
      alert('Failed to remove content.');
    } finally {
      setBusyId(null);
    }
  };

  const handleBan = async (report: Report) => {
    const ownerId = targets[report.id]?.ownerId;
    if (!ownerId) {
      alert('Could not determine the owner of this content.');
      return;
    }
    if (!window.confirm('Ban this user? They will be blocked from uploading and their content should be removed.')) return;

    setBusyId(report.id);
    try {
      await updateDoc(doc(db, 'users', ownerId), {
        banned: true,
        bannedAt: serverTimestamp(),
        bannedBy: user?.uid,
      });
      await resolveReport(report.id, 'banned');
    } catch (e) {
      console.error('Error banning user:', e);
      alert('Failed to ban user.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (report: Report) => {
    setBusyId(report.id);
    try {
      await resolveReport(report.id, 'dismissed');
    } catch (e) {
      console.error('Error dismissing report:', e);
    } finally {
      setBusyId(null);
    }
  };

  // Access control
  if (isAuthReady && !isAdmin) {
    return (
      <div className="flex-1 bg-[#FFF5F5] flex flex-col items-center justify-center px-8 text-center gap-4">
        <ShieldAlert className="w-16 h-16 text-neutral-300" />
        <h2 className="font-black text-xl text-neutral-800">Admins only</h2>
        <p className="text-neutral-500 font-medium text-sm">You don't have access to the moderation panel.</p>
        <button onClick={() => navigate('/home')} className="mt-2 bg-red-400 text-white px-6 py-3 rounded-full font-bold shadow-md active:scale-95 transition-transform">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/80 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-black text-neutral-800">Moderation</h1>
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider">{reports.length} pending</p>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Check className="w-14 h-14 text-emerald-400" />
            <p className="font-black text-neutral-800 text-lg">All clear!</p>
            <p className="text-neutral-500 font-medium text-sm">No pending reports to review.</p>
          </div>
        ) : (
          reports.map((report) => {
            const target = targets[report.id];
            return (
              <div key={report.id} className="bg-white rounded-3xl p-4 shadow-sm border border-pink-50">
                {/* Reason */}
                <div className="flex items-start gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <Flag className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-neutral-800 text-sm">{report.reason}</p>
                    {report.details && <p className="text-xs text-neutral-500 mt-0.5">{report.details}</p>}
                    <span className="inline-block mt-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      {report.targetType === 'comment' ? 'Comment' : 'Video'}
                    </span>
                  </div>
                </div>

                {/* Reported content preview */}
                <div className="bg-neutral-50 rounded-2xl p-3 mb-3">
                  {!target || target.loading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
                    </div>
                  ) : !target.exists ? (
                    <p className="text-xs font-bold text-neutral-400 italic text-center py-2">Content already removed</p>
                  ) : report.targetType === 'comment' ? (
                    <div>
                      <p className="text-xs font-bold text-neutral-500 mb-1">{target.userName}</p>
                      <p className="text-sm text-neutral-800">"{target.text}"</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {target.videoUrl && (
                        <video src={target.videoUrl} className="w-16 h-16 rounded-xl object-cover bg-black" muted playsInline autoPlay loop />
                      )}
                      <p className="font-bold text-neutral-800 text-sm">{target.name}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    disabled={busyId === report.id || !target?.exists}
                    onClick={() => handleRemove(report)}
                    className="flex-1 bg-red-500 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                  <button
                    disabled={busyId === report.id || !target?.ownerId}
                    onClick={() => handleBan(report)}
                    className="flex-1 bg-neutral-800 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Ban className="w-4 h-4" /> Ban user
                  </button>
                  <button
                    disabled={busyId === report.id}
                    onClick={() => handleDismiss(report)}
                    className="flex-1 bg-neutral-100 text-neutral-600 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" /> Dismiss
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
