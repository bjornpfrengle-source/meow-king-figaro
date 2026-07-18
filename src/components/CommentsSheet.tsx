import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Send, Loader2, Flag } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { ReportModal } from './ReportModal';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  likes: number;
  createdAt: any;
}

export function CommentsSheet({ isOpen, onClose, catId }: { isOpen: boolean, onClose: () => void, catId: string | null }) {
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user, userProfile, signIn } = useFirebase();
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [reportCommentTarget, setReportCommentTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !catId) return;

    setLoading(true);
    const q = query(
      collection(db, 'comments'),
      where('catId', '==', catId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(fetchedComments);
      setLoading(false);
      
      // Scroll to bottom when new comments arrive
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error('Error fetching comments:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, catId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !catId) return;

    if (!user) {
      await signIn();
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        catId,
        userId: user.uid,
        userName: userProfile?.displayName || user.displayName || 'Anonymous',
        userAvatar: userProfile?.photoURL || user.photoURL || '',
        text: newComment.trim(),
        likes: 0,
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) {
      await signIn();
      return;
    }
    
    try {
      const commentRef = doc(db, 'comments', commentId);
      await updateDoc(commentRef, {
        likes: increment(1)
      });
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const seconds = Math.floor((new Date().getTime() - timestamp.toDate().getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 mx-auto max-w-[400px] h-[70%] bg-white rounded-t-3xl z-[70] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-pink-50 bg-white/80 backdrop-blur-md">
              <h3 className="font-black text-neutral-800 text-lg">Community Chat ({comments.length})</h3>
              <button onClick={onClose} className="p-2 bg-neutral-100 rounded-full text-neutral-600 active:scale-95 transition-transform">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FFF5F5]">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10 text-neutral-400 font-bold">
                  No comments yet. Be the first!
                </div>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <img src={comment.userAvatar || `https://ui-avatars.com/api/?name=${comment.userName}&background=random`} alt={comment.userName} className="w-10 h-10 rounded-full object-cover shadow-sm border border-white" referrerPolicy="no-referrer" />
                    <div className="flex-1 bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-pink-50">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-neutral-800 text-sm">{comment.userName}</span>
                        <span className="text-[10px] font-bold text-neutral-400">{formatTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-neutral-600 text-sm leading-relaxed">{comment.text}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-neutral-400 pt-2">
                      <button onClick={() => handleLike(comment.id)} className="active:scale-90 transition-transform hover:text-pink-500">
                        <Heart className="w-5 h-5" />
                      </button>
                      <span className="text-[10px] font-bold">{comment.likes}</span>
                      {comment.userId !== user?.uid && (
                        <button
                          onClick={() => setReportCommentTarget({ id: comment.id, name: comment.userName })}
                          className="mt-1 active:scale-90 transition-transform hover:text-red-500"
                          aria-label="Report comment"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-pink-100 bg-white flex gap-3 items-center pb-8">
              <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'Guest'}&background=random`} alt="Me" className="w-10 h-10 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={user ? "Say something nice..." : "Sign in to comment..."}
                  className="w-full bg-neutral-100 border border-transparent rounded-full px-4 py-3 pr-12 outline-none focus:bg-white focus:border-pink-300 focus:ring-4 focus:ring-pink-100 text-sm font-medium transition-all"
                />
                <button 
                  type="submit"
                  disabled={submitting || (!newComment.trim() && !!user)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-pink-500 rounded-full text-white active:scale-95 transition-transform shadow-md shadow-pink-500/30 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </motion.div>

          <ReportModal
            isOpen={!!reportCommentTarget}
            onClose={() => setReportCommentTarget(null)}
            targetType="comment"
            targetId={reportCommentTarget?.id ?? null}
            targetName={reportCommentTarget ? `Comment by ${reportCommentTarget.name}` : undefined}
          />
        </>
      )}
    </AnimatePresence>
  );
}
