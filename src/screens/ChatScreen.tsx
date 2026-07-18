import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Send, Image as ImageIcon, Smile, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: Timestamp | null;
}

export function ChatScreen() {
  const navigate = useNavigate();
  const { user, signIn } = useFirebase();
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
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(fetchedMessages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.error('Error fetching messages:', error);
    });

    return () => unsubscribe();
  }, [user]);

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
      setMessage(''); // Optimistic clear
      await addDoc(collection(db, 'messages'), {
        text,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous Cat',
        userAvatar: currentUser.photoURL || 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&w=100&q=80',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Just now';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 bg-[#FFF5F5] flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-red-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-neutral-800 leading-tight">Community Hub</h1>
            <p className="text-xs font-bold text-teal-500">Live Chat</p>
          </div>
        </div>
        <button className="p-2 text-neutral-400 active:scale-95 transition-transform">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        <div className="text-center mb-4">
          <span className="bg-red-50 text-red-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
        </div>

        {messages.map((msg) => {
          const isMe = user?.uid === msg.userId;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
            >
              {!isMe && (
                <img src={msg.userAvatar} alt={msg.userName} className="w-8 h-8 rounded-full object-cover border border-pink-100 shrink-0" referrerPolicy="no-referrer" />
              )}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && <span className="text-[10px] font-bold text-neutral-400 mb-1 ml-1">{msg.userName}</span>}
                <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMe ? 'bg-red-400 text-white rounded-tr-sm' : 'bg-white text-neutral-700 rounded-tl-sm border border-pink-50'}`}>
                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                </div>
                <span className="text-[9px] font-bold text-neutral-300 mt-1 mx-1">{formatTime(msg.createdAt)}</span>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-pink-100 p-4 pb-8">
        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-1.5 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all">
          <button className="p-2 text-neutral-400 hover:text-red-400 transition-colors">
            <ImageIcon className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={user ? "Meow something..." : "Sign in to chat..."} 
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-neutral-700 placeholder:text-neutral-400"
          />
          <button className="p-2 text-neutral-400 hover:text-red-400 transition-colors">
            <Smile className="w-5 h-5" />
          </button>
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
