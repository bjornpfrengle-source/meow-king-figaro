import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Cat, Video, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../components/FirebaseProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, signIn } = useFirebase();
  
  const [catName, setCatName] = useState('');
  const [catBreed, setCatBreed] = useState('');
  const [catAge, setCatAge] = useState('');
  const [catPhotoFile, setCatPhotoFile] = useState<File | null>(null);
  const [catPhotoPreview, setCatPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCatPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCatPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = async () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      if (!user) {
        alert("Please sign in to continue!");
        return;
      }
      
      if (isSaving) return;
      setIsSaving(true);

      try {
        let thumbnailUrl = '';
        if (catPhotoFile) {
          const storageRef = ref(storage, `thumbnails/${user.uid}_${Date.now()}`);
          await uploadBytes(storageRef, catPhotoFile);
          thumbnailUrl = await getDownloadURL(storageRef);
        }

        if (catName.trim()) {
          // Save the cat details onto the user's PROFILE only. Competition
          // entries (with video) are created later via the upload flow, so we
          // don't create a phantom video-less cat here.
          await updateDoc(doc(db, 'users', user.uid), {
            catName: catName.trim(),
            catBreed: catBreed.trim(),
            catAge: catAge,
            catThumbnailUrl: thumbnailUrl,
          });
        }

        navigate('/home');
      } catch (error) {
        console.error("Error saving cat:", error);
        alert("Failed to save cat data. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#FFF5F5] flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col items-center justify-end text-center"
            >
              {/* Full-bleed cat photo background */}
              <img
                src="/onboarding-cat.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Dark scrim so the text stays readable over the photo */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25" />

              <div className="relative z-10 px-8 pb-16">
                <h1 className="text-4xl font-black mb-4 leading-tight shimmer-text drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  Welcome to<br />Cat Chaos Arena
                </h1>
                <p className="text-lg font-bold shimmer-text drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                  Where your cat battles for cuteness glory!
                </p>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col p-8 pt-20"
            >
              <h2 className="text-2xl font-black text-neutral-800 mb-2">Pick your cats</h2>
              <p className="text-neutral-500 font-medium mb-8">Add your furry competitors.</p>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-50 space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 bg-neutral-100 rounded-full mx-auto flex items-center justify-center text-neutral-400 mb-4 cursor-pointer overflow-hidden relative"
                >
                  {catPhotoPreview ? (
                    <img src={catPhotoPreview} alt="Cat preview" className="w-full h-full object-cover" />
                  ) : (
                    <Cat className="w-8 h-8" />
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <input 
                  type="text" 
                  placeholder="Cat's Name" 
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-pink-400 font-medium" 
                />
                <input 
                  type="text" 
                  placeholder="Breed (Optional)" 
                  value={catBreed}
                  onChange={(e) => setCatBreed(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-pink-400 font-medium" 
                />
                <select
                  value={catAge}
                  onChange={(e) => setCatAge(e.target.value)}
                  className={`w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-pink-400 font-medium ${!catAge ? 'text-neutral-400' : 'text-neutral-800'}`}
                >
                  <option value="" disabled hidden>Approximate Age (Optional)</option>
                  <option value="Kitten (under 1 year)">Kitten (under 1 year)</option>
                  <option value="Young (1-5 years)">Young (1-5 years)</option>
                  <option value="Adult (6-10 years)">Adult (6-10 years)</option>
                  <option value="Senior (11+ years)">Senior (11+ years)</option>
                  <option value="Not sure">Not sure</option>
                </select>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-32 h-32 bg-teal-100 rounded-3xl rotate-12 flex items-center justify-center mb-8">
                <Video className="w-16 h-16 text-teal-500 -rotate-12" />
              </div>
              <h2 className="text-2xl font-black text-neutral-800 mb-4">Daily Themes</h2>
              <p className="text-neutral-500 font-medium text-lg mb-6">
                Upload short videos of your cat doing tasks like <span className="text-pink-500 font-bold">Zoomies</span> or <span className="text-orange-400 font-bold">Box Invasion</span>.
              </p>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 flex flex-col p-8 pt-20"
            >
              <h2 className="text-2xl font-black text-neutral-800 mb-8 text-center">Ready to play?</h2>
              
              <div className="space-y-3 mb-8">
                {!user ? (
                  <>
                    <button className="w-full bg-white border-2 border-neutral-200 text-neutral-700 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
                      Continue with Apple
                    </button>
                    <button onClick={signIn} className="w-full bg-white border-2 border-neutral-200 text-neutral-700 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
                      Continue with Google
                    </button>
                  </>
                ) : (
                  <div className="w-full bg-green-50 border-2 border-green-200 text-green-700 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> Signed in as {user.displayName}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-pink-50">
                <div className="w-6 h-6 rounded border-2 border-pink-500 flex items-center justify-center shrink-0 mt-0.5 bg-pink-500 text-white">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-neutral-600 leading-relaxed">
                  Allow us to repost your cat's best moments on our socials for exposure (you keep all rights).
                </p>
              </label>

              <p className="text-[11px] text-neutral-500 text-center leading-relaxed mt-4 px-2">
                By continuing you agree to our{' '}
                <button
                  onClick={() => navigate('/terms')}
                  className="font-bold text-pink-500 underline"
                >
                  Terms of Use
                </button>
                , including our zero-tolerance policy for objectionable content and abusive users.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Controls */}
      <div className="p-8 pt-0 flex flex-col items-center">
        <div className="flex gap-2 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-2 rounded-full transition-all ${step === i ? 'w-8 bg-pink-500' : 'w-2 bg-pink-200'}`} />
          ))}
        </div>
        
        <button 
          onClick={nextStep}
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-pink-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              {step === 3 ? "Let's Go!" : "Continue"} <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
