import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Upload, Sparkles, Info, Wand2, Sticker, Type, Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

export function UploadScreen() {
  const navigate = useNavigate();
  const { user, signIn } = useFirebase();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [catName, setCatName] = useState('');
  const [availableCats, setAvailableCats] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const cats = [];
          if (data.catName) cats.push(data.catName);
          if (data.catName2) cats.push(data.catName2);
          
          if (cats.length > 0) {
            setAvailableCats(cats);
            setCatName(cats[0]);
            // Set default caption to the first cat's battle cry
            if (data.battleCry) setCaption(data.battleCry);
          } else {
            setAvailableCats(['Luna']);
            setCatName('Luna');
          }
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFile(file);
    }
  };

  const handleRetake = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    let currentUser = user;
    if (!currentUser) {
      await signIn();
      currentUser = auth.currentUser;
      if (!currentUser) return;
    }

    if (!videoFile || !caption.trim() || !catName.trim()) return;

    setIsSubmitting(true);
    try {
      // Upload video to Firebase Storage
      const fileExtension = videoFile.name.split('.').pop() || 'mp4';
      const storageRef = ref(storage, `cats/${currentUser.uid}_${Date.now()}.${fileExtension}`);
      
      await uploadBytes(storageRef, videoFile);
      const downloadUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'cats'), {
        ownerId: currentUser.uid,
        name: catName.trim(),
        cry: caption.trim(),
        videoUrl: downloadUrl,
        score: 0,
        createdAt: serverTimestamp()
      });

      navigate('/home'); // Go back to home after upload
    } catch (error) {
      console.error('Error uploading cat:', error);
      alert('Failed to upload. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-50 relative flex flex-col">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-neutral-50 sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Entry Studio</h1>
      </div>

      <div className="px-6 py-4 flex-1 flex flex-col">
        {/* Theme Info */}
        <div className="bg-gradient-to-r from-teal-400 to-emerald-400 rounded-3xl p-6 mb-6 relative overflow-hidden shadow-lg shadow-teal-500/20">
          <Sparkles className="absolute top-4 right-4 w-6 h-6 text-white/50" />
          <h2 className="text-teal-50 font-bold text-xs mb-1 uppercase tracking-wider">Today's Theme</h2>
          <h3 className="text-2xl font-black text-white mb-1">Box Conqueror</h3>
          <p className="text-teal-50 text-sm font-medium">
            Turn a cardboard box into your cat's kingdom!
          </p>
        </div>

        {/* Preview / Upload Area */}
        {!videoUrl ? (
          <>
            <input 
              type="file" 
              accept="video/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            <motion.div 
              whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-teal-200 rounded-3xl bg-white aspect-[3/4] flex flex-col items-center justify-center gap-4 mb-6 cursor-pointer hover:border-teal-300 hover:bg-teal-50/50 transition-all shadow-sm"
            >
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center text-teal-500">
                <Upload className="w-10 h-10" strokeWidth={2.5} />
              </div>
              <div className="text-center px-6">
                <p className="font-black text-xl text-neutral-800 mb-1">Upload Video</p>
                <p className="text-sm font-medium text-neutral-500">5-15 seconds of pure chaos</p>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="relative aspect-[3/4] rounded-3xl overflow-hidden mb-6 shadow-lg bg-black">
            <video 
              src={videoUrl} 
              className="w-full h-full object-cover opacity-80"
              autoPlay loop muted playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 cursor-pointer">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            </div>
            
            {/* Studio Tools Overlay */}
            <div className="absolute right-4 top-4 flex flex-col gap-3">
              <button className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                <Wand2 className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                <Sticker className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20">
                <Type className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={handleRetake}
              className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20"
            >
              Retake
            </button>
          </div>
        )}

        {/* Form */}
        <div className="space-y-5 mb-8">
          <div>
            <label className="block text-sm font-black text-neutral-800 mb-2 uppercase tracking-wide">Battle Cry (Caption)</label>
            <input 
              type="text" 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. The Great Box Escape!" 
              className="w-full bg-white border-2 border-neutral-200 rounded-2xl px-4 py-3.5 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all font-bold text-neutral-800 placeholder:text-neutral-400 placeholder:font-medium"
            />
          </div>
          <div>
            <label className="block text-sm font-black text-neutral-800 mb-2 uppercase tracking-wide">Select Fighter</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {availableCats.map((cat) => (
                <div 
                  key={cat}
                  onClick={() => setCatName(cat)}
                  className={`border-2 rounded-2xl p-2 flex items-center gap-3 flex-1 cursor-pointer min-w-[140px] transition-all ${
                    catName === cat ? 'border-teal-500 bg-teal-50' : 'border-neutral-200 bg-white hover:border-teal-200'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
                    {cat.charAt(0)}
                  </div>
                  <span className={`font-bold ${catName === cat ? 'text-teal-800' : 'text-neutral-600'}`}>
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-orange-50 rounded-2xl p-4 flex gap-3 items-start mb-8 border border-orange-100">
          <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800 font-medium leading-relaxed">
            <span className="font-bold">Pro Tip:</span> Videos with good lighting and clear action get 40% more votes!
          </p>
        </div>

        <div className="mt-auto pb-24">
          <button 
            disabled={!videoUrl || isSubmitting || !caption.trim()}
            onClick={handleSubmit}
            className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
              videoUrl && caption.trim() && !isSubmitting
                ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-white shadow-teal-500/30' 
                : 'bg-neutral-200 text-neutral-400 shadow-none'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Enter the Arena'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
