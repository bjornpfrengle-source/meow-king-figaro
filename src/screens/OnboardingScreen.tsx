import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Cat, Video, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
    else navigate('/home');
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
              className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="w-40 h-40 bg-pink-100 rounded-full flex items-center justify-center mb-8">
                <Cat className="w-20 h-20 text-pink-500" />
              </div>
              <h1 className="text-3xl font-black text-neutral-800 mb-4">Welcome to<br/>Cat Chaos Arena</h1>
              <p className="text-neutral-500 font-medium text-lg">Where your cat battles for cuteness glory!</p>
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
                <div className="w-20 h-20 bg-neutral-100 rounded-full mx-auto flex items-center justify-center text-neutral-400 mb-4">
                  <Cat className="w-8 h-8" />
                </div>
                <input type="text" placeholder="Cat's Name" className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-pink-400 font-medium" />
                <input type="text" placeholder="Breed (Optional)" className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 outline-none focus:border-pink-400 font-medium" />
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
                <button className="w-full bg-white border-2 border-neutral-200 text-neutral-700 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
                  Continue with Apple
                </button>
                <button className="w-full bg-white border-2 border-neutral-200 text-neutral-700 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2">
                  Continue with Google
                </button>
              </div>

              <label className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-pink-50">
                <div className="w-6 h-6 rounded border-2 border-pink-500 flex items-center justify-center shrink-0 mt-0.5 bg-pink-500 text-white">
                  <Check className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-neutral-600 leading-relaxed">
                  Allow us to repost your cat's best moments on our socials for exposure (you keep all rights).
                </p>
              </label>
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
          className="w-full bg-gradient-to-r from-pink-500 to-orange-400 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-pink-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          {step === 3 ? "Let's Go!" : "Continue"} <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
