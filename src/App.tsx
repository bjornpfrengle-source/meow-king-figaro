import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
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
import { AnnouncementsAdminScreen } from './screens/AnnouncementsAdminScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';

/**
 * Decides where a cold start lands.
 *
 * This used to be a bare `<Navigate to="/onboarding" replace />`, with nothing
 * anywhere recording that a user had already been through it. The iOS shell
 * loads the bare site root on every launch, so every launch replayed the whole
 * onboarding flow — for existing users, forever. Testers reported swiping
 * through it every single time they opened the app.
 *
 * Both waits below matter. `isAuthReady` guards the moment before Firebase has
 * restored the session, when `user` is briefly null and a signed-in user would
 * be wrongly sent to onboarding. The `!userProfile` wait guards the moment
 * after that, when auth has resolved but the profile snapshot carrying
 * hasOnboarded hasn't arrived yet — deciding then would flash onboarding at
 * someone who has already completed it.
 */
function RootRoute() {
  const { isAuthReady, user, userProfile } = useFirebase();

  if (!isAuthReady || (user && !userProfile)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF5F5]">
        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
      </div>
    );
  }

  // Signed out: onboarding is also the sign-in screen, so it's the right place.
  if (!user) return <Navigate to="/onboarding" replace />;

  // The allowRepost fallback backfills accounts that finished onboarding before
  // hasOnboarded existed — that field has only ever been written at the end of
  // this flow. Without it, every current user would be sent through onboarding
  // one more time. Safe to delete once the existing accounts have re-completed.
  const onboarded = userProfile?.hasOnboarded === true || userProfile?.allowRepost !== undefined;

  return <Navigate to={onboarded ? '/home' : '/onboarding'} replace />;
}

export default function App() {
  return (
    <FirebaseProvider>
      <BrowserRouter>
        <div className="flex justify-center items-center min-h-screen bg-neutral-950 font-sans">
          {/* Mobile Container */}
          <div className="relative w-full max-w-[400px] h-[100dvh] sm:h-[850px] bg-[#FFF5F5] text-neutral-800 overflow-hidden sm:rounded-[3rem] sm:border-[8px] border-neutral-800 shadow-2xl flex flex-col">
            
            <Routes>
            <Route path="/" element={<RootRoute />} />
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
            <Route path="/admin/announcements" element={<AnnouncementsAdminScreen />} />
            <Route path="/user/:uid" element={<PublicProfileScreen />} />
            <Route path="/privacy" element={<PrivacyScreen />} />
          </Routes>

          <BottomNav />
        </div>
      </div>
    </BrowserRouter>
    </FirebaseProvider>
  );
}
