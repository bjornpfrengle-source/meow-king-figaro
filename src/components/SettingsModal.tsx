import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Save, Loader2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  socialHandle?: string;
  catName?: string;
  battleCry?: string;
  catName2?: string;
  battleCry2?: string;
  role?: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentUser: User | null;
  onUpdate: (updatedProfile: UserProfile) => void;
}

export function SettingsModal({ isOpen, onClose, userProfile, currentUser, onUpdate }: SettingsModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [catName, setCatName] = useState('');
  const [battleCry, setBattleCry] = useState('');
  const [catThumbnailUrl, setCatThumbnailUrl] = useState('');
  const [catName2, setCatName2] = useState('');
  const [battleCry2, setBattleCry2] = useState('');
  const [catThumbnailUrl2, setCatThumbnailUrl2] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeThumbnailField, setActiveThumbnailField] = useState<'catThumbnailUrl' | 'catThumbnailUrl2' | null>(null);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setPhotoURL(userProfile.photoURL || '');
      setSocialHandle(userProfile.socialHandle || '');
      setCatName(userProfile.catName || '');
      setBattleCry(userProfile.battleCry || '');
      setCatThumbnailUrl(userProfile.catThumbnailUrl || '');
      setCatName2(userProfile.catName2 || '');
      setBattleCry2(userProfile.battleCry2 || '');
      setCatThumbnailUrl2(userProfile.catThumbnailUrl2 || '');
    } else if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
    }
  }, [userProfile, currentUser, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeThumbnailField) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        if (activeThumbnailField === 'photoURL') setPhotoURL(dataUrl);
        else if (activeThumbnailField === 'catThumbnailUrl') setCatThumbnailUrl(dataUrl);
        else if (activeThumbnailField === 'catThumbnailUrl2') setCatThumbnailUrl2(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updates = {
        uid: currentUser.uid,
        role: userProfile?.role || 'user',
        displayName,
        photoURL,
        socialHandle,
        catName,
        battleCry,
        catThumbnailUrl,
        catName2,
        battleCry2,
        catThumbnailUrl2
      };

      await setDoc(userRef, updates, { merge: true });
      onUpdate(updates as UserProfile);
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Failed to save profile: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-white z-50 flex flex-col h-full w-full"
          >
            <div className="flex justify-between items-center p-6 border-b border-pink-50 shrink-0 bg-white">
              <button onClick={onClose} className="text-neutral-500 font-bold active:scale-95 transition-transform">
                Cancel
              </button>
              <h2 className="text-xl font-black text-neutral-800">Profile Settings</h2>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="text-red-500 font-black active:scale-95 transition-transform disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 pb-24">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center mb-8">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                />
                <div 
                  onClick={() => { setActiveThumbnailField('photoURL'); fileInputRef.current?.click(); }}
                  className="relative mb-4 cursor-pointer group"
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-pink-100 bg-neutral-200 relative">
                    {photoURL ? (
                      <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tap to change avatar</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Your Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Owner Name"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                  />
                </div>

                <div className="bg-pink-50/50 p-4 rounded-2xl space-y-4 border border-pink-100">
                  <h3 className="font-black text-pink-800 text-sm">First Cat</h3>
                  <div className="flex items-center gap-4">
                    <div 
                      onClick={() => { setActiveThumbnailField('catThumbnailUrl'); fileInputRef.current?.click(); }}
                      className="w-16 h-16 rounded-xl overflow-hidden border-2 border-pink-100 bg-neutral-200 cursor-pointer relative group shrink-0"
                    >
                      {catThumbnailUrl ? (
                        <img src={catThumbnailUrl} alt="Cat 1" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Cat's Name</label>
                        <input
                          type="text"
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="e.g. Sir Pawsalot"
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Battle Cry</label>
                        <input
                          type="text"
                          value={battleCry}
                          onChange={(e) => setBattleCry(e.target.value)}
                          placeholder="e.g. Fear the fluff!"
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-pink-50/50 p-4 rounded-2xl space-y-4 border border-pink-100">
                  <h3 className="font-black text-pink-800 text-sm">Second Cat (Optional)</h3>
                  <div className="flex items-center gap-4">
                    <div 
                      onClick={() => { setActiveThumbnailField('catThumbnailUrl2'); fileInputRef.current?.click(); }}
                      className="w-16 h-16 rounded-xl overflow-hidden border-2 border-pink-100 bg-neutral-200 cursor-pointer relative group shrink-0"
                    >
                      {catThumbnailUrl2 ? (
                        <img src={catThumbnailUrl2} alt="Cat 2" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Cat's Name</label>
                        <input
                          type="text"
                          value={catName2}
                          onChange={(e) => setCatName2(e.target.value)}
                          placeholder="e.g. Madam Meow"
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Battle Cry</label>
                        <input
                          type="text"
                          value={battleCry2}
                          onChange={(e) => setBattleCry2(e.target.value)}
                          placeholder="e.g. Prepare for trouble!"
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Social Media Handle</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">@</span>
                    <input
                      type="text"
                      value={socialHandle}
                      onChange={(e) => setSocialHandle(e.target.value.replace('@', ''))}
                      placeholder="cat_chaos_king"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-4 py-3 text-sm font-medium focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5 font-medium">We'll tag this handle if your cat is featured on our socials!</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
