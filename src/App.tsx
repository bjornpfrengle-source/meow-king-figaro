import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { FirebaseProvider } from './components/FirebaseProvider';
import { HomeScreen } from './screens/HomeScreen';
import { ThemeScreen } from './screens/ThemeScreen';
import { UploadScreen } from './screens/UploadScreen';
import { VoteScreen } from './screens/VoteScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { PrizesScreen } from './screens/PrizesScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ModerationScreen } from './screens/ModerationScreen';
import { TermsScreen } from './screens/TermsScreen';
import { HallOfFameScreen } from './screens/HallOfFameScreen';
import { ThemeAdminScreen } from './screens/ThemeAdminScreen';
import { ArenaPreviewScreen } from './screens/ArenaPreviewScreen';

export default function App() {
  return (
    <FirebaseProvider>
      <BrowserRouter>
        <div className="flex justify-center items-center min-h-screen bg-neutral-950 font-sans">
          {/* Mobile Container */}
          <div className="relative w-full max-w-[400px] h-[100dvh] sm:h-[850px] bg-[#FFF5F5] text-neutral-800 overflow-hidden sm:rounded-[3rem] sm:border-[8px] border-neutral-800 shadow-2xl flex flex-col">
            
            <Routes>
            <Route path="/" element={<Navigate to="/onboarding" replace />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/theme" element={<ThemeScreen />} />
            <Route path="/upload" element={<UploadScreen />} />
            <Route path="/vote" element={<VoteScreen />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/premium" element={<PremiumScreen />} />
            <Route path="/prizes" element={<PrizesScreen />} />
            <Route path="/notifications" element={<NotificationsScreen />} />
            <Route path="/chat" element={<ChatScreen />} />
            <Route path="/moderation" element={<ModerationScreen />} />
            <Route path="/terms" element={<TermsScreen />} />
            <Route path="/hall-of-fame" element={<HallOfFameScreen />} />
            <Route path="/admin/themes" element={<ThemeAdminScreen />} />
            <Route path="/arena-preview" element={<ArenaPreviewScreen />} />
          </Routes>

          <BottomNav />
        </div>
      </div>
    </BrowserRouter>
    </FirebaseProvider>
  );
}
