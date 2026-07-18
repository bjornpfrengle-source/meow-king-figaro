import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PrivacyScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      {/* Header */}
      <div className="pt-4 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/90 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Privacy Policy</h1>
      </div>

      <div className="px-6 space-y-5 text-sm text-neutral-600 leading-relaxed">
        <p className="text-xs text-neutral-400">Last updated: 19 July 2026</p>

        <p>
          This Privacy Policy explains how Cat Chaos Arena ("we", "us", "the App") collects, uses, and protects your
          information. By using the App you agree to this policy.
        </p>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="font-bold">Account details:</span> when you sign in (e.g. with Google or Apple), we receive your name, email address, and profile photo.</li>
            <li><span className="font-bold">Profile &amp; pet details:</span> information you add, such as your display name, social handle, and your cat's name, breed, and approximate age.</li>
            <li><span className="font-bold">Content you create:</span> the videos, photos, comments, chat messages, and votes you submit.</li>
            <li><span className="font-bold">Basic technical data:</span> standard information such as device type and app activity, used to keep the App running and secure.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and manage your account and profile;</li>
            <li>To run the competition — showing your cats, tallying votes, and building leaderboards;</li>
            <li>To enable community features (comments, chat, public profiles);</li>
            <li>To keep the App safe — reviewing reports, moderating content, and enforcing our rules;</li>
            <li>To improve and maintain the App.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">3. Public Information</h2>
          <p>
            Some information is public to other users by design: your display name, profile photo, optional social handle,
            your cats, and the videos, comments, and chat messages you post. Please don't share anything you want to keep
            private.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">4. Service Providers</h2>
          <p>
            We use trusted third-party services to run the App, including <span className="font-bold">Google Firebase</span>{' '}
            (authentication, database, and media storage) and our hosting provider. These providers process data on our
            behalf under their own security and privacy commitments.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">5. Sharing of Data</h2>
          <p>
            We do <span className="font-bold">not</span> sell your personal information. We may share aggregated, anonymised
            statistics (for example, general community trends) that do not identify you. We may disclose information if
            required by law or to protect the safety of our users.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">6. Children</h2>
          <p>
            The App is intended for users aged 13 and over. We do not knowingly collect information from children under 13.
            If you believe a child has provided us information, contact us and we will remove it.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">7. Your Choices &amp; Rights</h2>
          <p>
            You can edit your profile at any time, delete your own entries, and request deletion of your account and
            associated data by contacting us. You may also block other users within the App.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">8. Data Retention &amp; Security</h2>
          <p>
            We keep your information for as long as your account is active or as needed to provide the App. We use
            reasonable measures to protect your data, though no method of transmission or storage is completely secure.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">9. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Continued use of the App after changes take effect means you
            accept the updated policy.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">10. Contact</h2>
          <p>
            Questions about your privacy? Contact us at{' '}
            <span className="font-bold text-pink-500">bjornpfrengle@gmail.com</span>.
          </p>
        </div>

        <p className="text-xs text-neutral-400 pt-2">
          By using Cat Chaos Arena you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </div>
    </div>
  );
}
