import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Loader2, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from './FirebaseProvider';

export type ReportTargetType = 'cat' | 'comment';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string | null;
  targetName?: string;
}

const REASONS = [
  'Explicit or inappropriate content',
  'Hate speech or bad language',
  'AI-generated or fake cat',
  'Stolen video / not their cat',
  'Spam or misleading',
  'Other',
];

export function ReportModal({ isOpen, onClose, targetType, targetId, targetName }: ReportModalProps) {
  const { user, signIn } = useFirebase();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setSelectedReason(null);
    setDetails('');
    setSubmitting(false);
    setSubmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason || !targetId) return;

    if (!user) {
      await signIn();
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        targetType,
        targetId,
        // keep legacy field so older tooling still works
        catId: targetType === 'cat' ? targetId : null,
        reason: selectedReason,
        details: details.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(handleClose, 1800);
    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 z-[80] backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[90] flex flex-col overflow-hidden shadow-2xl max-h-[85%]"
          >
            {submitted ? (
              <div className="flex flex-col items-center justify-center gap-4 p-10 pb-16 text-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                <h3 className="font-black text-neutral-800 text-xl">Report received</h3>
                <p className="text-neutral-500 font-medium text-sm max-w-xs">
                  Thanks for keeping the arena clean. Our team reviews every report within 24 hours.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                      <Flag className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-neutral-800 text-lg leading-tight">Report {targetType === 'comment' ? 'comment' : 'video'}</h3>
                      {targetName && <p className="text-xs font-bold text-neutral-400 truncate max-w-[200px]">{targetName}</p>}
                    </div>
                  </div>
                  <button onClick={handleClose} className="p-2 bg-neutral-100 rounded-full text-neutral-600 active:scale-95 transition-transform">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Reasons */}
                <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                  {REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full text-left px-4 py-3.5 rounded-2xl font-bold text-sm border-2 transition-all ${
                        selectedReason === reason
                          ? 'border-red-400 bg-red-50 text-red-600'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-red-200'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}

                  {selectedReason === 'Other' && (
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="Tell us what's wrong..."
                      rows={3}
                      className="w-full mt-1 bg-neutral-100 border-2 border-transparent rounded-2xl px-4 py-3 outline-none focus:bg-white focus:border-red-300 text-sm font-medium transition-all resize-none"
                    />
                  )}
                </div>

                {/* Submit */}
                <div className="p-5 border-t border-neutral-100 pb-8">
                  <button
                    disabled={!selectedReason || submitting || (selectedReason === 'Other' && !details.trim())}
                    onClick={handleSubmit}
                    className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all ${
                      selectedReason && !(selectedReason === 'Other' && !details.trim())
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-neutral-200 text-neutral-400'
                    }`}
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Flag className="w-5 h-5" />}
                    {user ? 'Submit report' : 'Sign in to report'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
