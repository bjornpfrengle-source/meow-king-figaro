import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Send, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: Timestamp | null;
  likes?: number;
  likedBy?: string[];
}

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return 'now';
  const s = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function ChatScreen() {
  const navigate = useNavigate();
  const { user, userProfile, signIn } = useFirebase();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Message[];
      setMessages(fetched);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => console.error('Error fetching messages:', error));
    return () => unsubscribe();
  }, [user]);

  const handleLikeMessage = async (msg: Message) => {
    if (!user) return;
    const liked = (msg.likedBy || []).includes(user.uid);
    try {
      await updateDoc(doc(db, 'messages', msg.id), {
        likes: increment(liked ? -1 : 1),
        likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (e) {
      console.error('Error liking message:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    let currentUser = user;
    if (!currentUser) {
      await signIn();
      currentUser = auth.currentUser;
      if (!currentUser) return;
    }
    try {
      const text = message.trim();
      setMessage('');
      await addDoc(collection(db, 'messages'), {
        text,
        userId: currentUser.uid,
        // Prefer the up-to-date profile, fall back to the auth account
        userName: userProfile?.displayName || currentUser.displayName || 'Anonymous Cat',
        userAvatar: userProfile?.photoURL || currentUser.photoURL || '',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-3 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-black text-neutral-800 leading-tight">Community Hub</h1>
          <p className="text-xs font-bold text-teal-500">
            {messages.length} comments <span className="text-neutral-400 font-medium">· type @moderator for help</span>
          </p>
        </div>
      </div>

      {/* Comments (social feed style) */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {messages.filter((m) => !(userProfile?.blockedUserIds || []).includes(m.userId)).length === 0 ? (
          <div className="text-center py-16 text-neutral-400 font-bold">Be the first to say something! 🐱</div>
        ) : (
          messages
            .filter((m) => !(userProfile?.blockedUserIds || []).includes(m.userId))
            .map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className="flex gap-3 items-start"
              >
                <img
                  onClick={() => navigate(`/user/${msg.userId}`)}
                  src={msg.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.userName || 'Cat')}&background=random`}
                  alt={msg.userName}
                  className="w-9 h-9 rounded-full object-cover border border-pink-100 shrink-0 cursor-pointer"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span onClick={() => navigate(`/user/${msg.userId}`)} className="font-bold text-neutral-800 text-sm truncate cursor-pointer">{msg.userName}</span>
                    <span className="text-[10px] font-bold text-neutral-300 shrink-0">{timeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-neutral-700 leading-relaxed break-words">{msg.text}</p>
                </div>
                {(() => { const liked = !!user && (msg.likedBy || []).includes(user.uid); return (
                  <button onClick={() => handleLikeMessage(msg)} className={`flex flex-col items-center gap-0.5 shrink-0 mt-1 active:scale-90 transition-transform ${liked ? 'text-pink-500' : 'text-neutral-300 hover:text-pink-400'}`}>
                    <Heart className={`w-4 h-4 ${liked ? 'fill-pink-500' : ''}`} />
                    {(msg.likes ?? 0) > 0 && <span className="text-[9px] font-bold">{msg.likes}</span>}
                  </button>
                ); })()}
              </motion.div>
            ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-pink-100 p-4 pb-8">
        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-full px-4 py-1.5 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all">
          <img
            src={userProfile?.photoURL || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile?.displayName || 'Me')}&background=random`}
            alt="Me"
            className="w-7 h-7 rounded-full object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={user ? 'Add a comment…' : 'Sign in to comment…'}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-neutral-700 placeholder:text-neutral-400"
          />
          <button
            onClick={handleSendMessage}
            className={`p-2 rounded-full flex items-center justify-center transition-all ${message.trim() ? 'bg-red-400 text-white shadow-md shadow-red-400/30' : 'bg-neutral-200 text-neutral-400'}`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
