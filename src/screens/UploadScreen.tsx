import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Upload, Sparkles, Info, Wand2, Sticker, Type, Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function UploadScreen() {
  const navigate = useNavigate();
  const { user, userProfile, signIn } = useFirebase();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [caption, setCaption] = useState('');
  const [catName, setCatName] = useState('');
  const [availableCats, setAvailableCats] = useState<{id: string, name: string}[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userProfile) {
      const catsList: {id: string, name: string}[] = [];
      if (userProfile.catName) {
        catsList.push({ id: 'cat1', name: userProfile.catName });
      }
      if (userProfile.catName2) {
        catsList.push({ id: 'cat2', name: userProfile.catName2 });
      }
      setAvailableCats(catsList);
      if (catsList.length > 0) {
        setSelectedCatId(catsList[0].id);
        setCatName(catsList[0].name);
      }
    }
  }, [userProfile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFile(file);
      setDuration(0);
      setTrimStart(0);
    }
  };

  const handleRetake = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setVideoFile(null);
    setDuration(0);
    setTrimStart(0);
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

    if (!videoFile || !caption.trim() || !catName.trim() || !selectedCatId) return;

    // Check file size (limit to 500MB)
    if (videoFile.size > 500 * 1024 * 1024) {
      setErrorMsg("Video is too large. Please upload a video smaller than 500MB.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    
    try {
      await new Promise<void>((resolve, reject) => {
        if (!currentUser) return reject(new Error("No user"));
        
        console.log("Starting Firebase Storage upload...");
        setUploadProgress(5);
        
        const fileId = Date.now().toString() + Math.random().toString(36).substring(7);
        const fileExtension = videoFile.name.split('.').pop() || 'mp4';
        const storageRef = ref(storage, `videos/${currentUser.uid}/${fileId}.${fileExtension}`);
        
        const uploadTask = uploadBytesResumable(storageRef, videoFile);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          }, 
          (error) => {
            console.error("Firebase Storage upload error:", error);
            reject(error);
          }, 
          async () => {
            try {
              console.log("Upload complete. Getting download URL...");
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              console.log("Download URL:", downloadUrl);

              // Add document to Firestore
              console.log("Adding document to Firestore...");
              await addDoc(collection(db, 'cats'), {
                ownerId: currentUser.uid,
                name: catName.trim(),
                cry: caption.trim(),
                videoUrl: downloadUrl,
                score: 0,
                selectedCatId: selectedCatId,
                trimStart: trimStart,
                trimEnd: duration > 15 ? trimStart + 15 : duration,
                createdAt: serverTimestamp()
              });
              console.log("Document added to Firestore.");
              resolve();
            } catch (error: any) {
              console.error("Error adding document to Firestore:", error);
              reject(error);
            }
          }
        );
      });

      setSuccessMsg('Entry submitted successfully! 🎉');
      setTimeout(() => {
        handleRetake();
        setCaption('');
        navigate('/home');
      }, 1500);
    } catch (error: any) {
      console.error('Error uploading cat:', error);
      setErrorMsg(error.message || 'Upload failed — please check your connection and try again.');
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
          <h3 className="text-2xl font-black text-white mb-1">Zoomies Champion</h3>
          <p className="text-teal-50 text-sm font-medium">
            Capture your cat's wildest, most chaotic burst of energy! The more blur, the better.
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
              ref={videoRef}
              src={videoUrl} 
              className="w-full h-full object-cover opacity-80"
              autoPlay loop muted playsInline
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                if (duration > 15) {
                  if (video.currentTime >= trimStart + 15) {
                    video.currentTime = trimStart;
                  } else if (video.currentTime < trimStart) {
                    video.currentTime = trimStart;
                  }
                }
              }}
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

        {/* Trimmer UI (only visible if duration > 15) */}
        {videoUrl && duration > 15 && (
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-black text-neutral-800 uppercase tracking-wide">Trim Clip (15s Max)</label>
              <div className="text-xs font-bold bg-teal-100 text-teal-800 px-2 py-1 rounded-md">
                {trimStart.toFixed(1)}s - {Math.min(duration, trimStart + 15).toFixed(1)}s
              </div>
            </div>
            <div className="relative h-12 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-300 shadow-inner">
              <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden flex items-center justify-center">
                 <video src={videoUrl} className="w-full object-cover" muted />
              </div>
              
              <div 
                className="absolute top-0 bottom-0 bg-white/20 border-x-4 border-teal-400 z-10"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${(15 / duration) * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'
                }}
              />
              
              <input 
                type="range"
                min={0}
                max={duration - 15}
                step={0.1}
                value={trimStart}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTrimStart(val);
                  if (videoRef.current) {
                    videoRef.current.currentTime = val;
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
              />
            </div>
            <p className="text-xs text-neutral-500 font-medium mt-2">
              Slide to select the best 15 seconds of chaos.
            </p>
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
              {availableCats.length > 0 ? (
                availableCats.map((cat) => (
                  <div 
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCatId(cat.id);
                      setCatName(cat.name);
                    }}
                    className={`border-2 rounded-2xl p-2 flex items-center gap-3 flex-1 cursor-pointer min-w-[140px] transition-all ${
                      selectedCatId === cat.id ? 'border-teal-500 bg-teal-50' : 'border-neutral-200 bg-white hover:border-teal-200'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
                      {cat.name.charAt(0)}
                    </div>
                    <span className={`font-bold ${selectedCatId === cat.id ? 'text-teal-800' : 'text-neutral-600'}`}>
                      {cat.name}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-neutral-500 italic p-2">
                  No cats found. You must have an existing cat profile to enter.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-orange-50 rounded-2xl p-4 flex gap-3 items-start mb-4 border border-orange-100">
          <Info className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800 font-medium leading-relaxed">
            <span className="font-bold">Pro Tip:</span> Videos with good lighting and clear action get 40% more votes! <br/>
            <span className="font-bold text-orange-900">Note:</span> Videos longer than 15 seconds will be automatically trimmed.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-red-50 rounded-2xl p-4 flex gap-3 items-start mb-8 border border-red-100">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-red-500 font-bold text-[10px]">!</span>
          </div>
          <p className="text-xs text-red-800 font-medium leading-relaxed">
            <span className="font-bold">Zero Tolerance Policy:</span> Uploading AI-generated cats, stolen viral videos, or cats you do not own will result in an immediate and permanent ban. Keep it real!
          </p>
        </div>

        <div className="mt-auto pb-24">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-xl mb-4 text-center border border-red-200">
              {errorMsg}
            </div>
          )}
          <button 
            disabled={!videoUrl || isSubmitting || !caption.trim() || !selectedCatId || !!successMsg}
            onClick={handleSubmit}
            className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${
              videoUrl && caption.trim() && selectedCatId && !isSubmitting && !successMsg
                ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-white shadow-teal-500/30' 
                : successMsg 
                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                : 'bg-neutral-200 text-neutral-400 shadow-none'
            }`}
          >
            {successMsg ? (
              successMsg
            ) : isSubmitting ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Uploading your chaos... (this may take a few seconds)</span>
                </div>
                <div className="w-full bg-teal-900/20 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div 
                    className="bg-white h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              'Enter the Arena'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
