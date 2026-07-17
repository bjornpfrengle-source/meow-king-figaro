import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TermsScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto bg-[#FFF5F5] flex flex-col pb-24">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-[#FFF5F5]/90 backdrop-blur-md sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-white rounded-full text-neutral-600 shadow-sm active:scale-95 transition-transform">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-neutral-800">Terms of Use</h1>
      </div>

      <div className="px-6 space-y-5 text-sm text-neutral-600 leading-relaxed">
        <p className="text-xs text-neutral-400">Last updated: 15 July 2026</p>

        <p>
          Welcome to Cat Chaos Arena ("the App"). By creating an account or using the App you agree to these Terms of Use.
          If you do not agree, please do not use the App.
        </p>

        {/* The zero-tolerance clause Apple requires for user-generated content */}
        <div className="bg-white rounded-2xl p-4 border border-red-100">
          <h2 className="font-black text-neutral-800 mb-2">1. Zero-Tolerance Policy</h2>
          <p>
            Cat Chaos Arena has <span className="font-bold">zero tolerance for objectionable content or abusive behaviour</span>.
            Content that violates these Terms will be removed, and users who post it may be suspended or permanently banned
            without notice. Reports are reviewed and acted on within 24 hours.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">2. Eligibility</h2>
          <p>You must be at least 13 years old to use the App. By using it you confirm that you meet this requirement.</p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">3. Your Content</h2>
          <p>
            You keep ownership of the videos and photos you upload ("Your Content"). By uploading, you grant us a licence to
            host, display, and distribute Your Content within the App so it can be shown to and voted on by other users.
            You are responsible for Your Content and confirm you have the right to share it.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">4. Prohibited Content &amp; Conduct</h2>
          <p className="mb-2">You agree that you will not upload, post, or share:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Explicit, violent, sexual, or otherwise inappropriate material;</li>
            <li>Hateful, harassing, abusive, or discriminatory content or language;</li>
            <li>Cruelty to animals or content that endangers any animal;</li>
            <li>AI-generated, fake, stolen, or viral videos you do not own;</li>
            <li>Content featuring people rather than cats, or private information about others;</li>
            <li>Spam, misleading entries, or attempts to manipulate votes.</li>
          </ul>
          <p className="mt-2">
            You also agree not to harass, threaten, or abuse other users.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">5. Reporting &amp; Moderation</h2>
          <p>
            Every video and comment can be reported using the flag icon. We review reports and may remove content, restrict
            features, or ban accounts at our discretion. Banned users are blocked from uploading and participating.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">6. Subscriptions</h2>
          <p>
            Optional paid features (such as Catnip Club) are billed through your Apple account in accordance with the App
            Store terms. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current
            period. You can manage or cancel in your Apple account settings.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">7. Termination</h2>
          <p>
            We may suspend or terminate your access at any time if you breach these Terms. You may stop using the App and
            request deletion of your account at any time.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">8. Disclaimer &amp; Liability</h2>
          <p>
            The App is provided "as is". To the extent permitted by law, we are not liable for any indirect or incidental
            damages arising from your use of the App.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">9. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of the App after changes take effect means you accept
            the updated Terms.
          </p>
        </div>

        <div>
          <h2 className="font-black text-neutral-800 mb-2">10. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{' '}
            <span className="font-bold text-pink-500">bjornpfrengle@gmail.com</span>.
          </p>
        </div>

        <p className="text-xs text-neutral-400 pt-2">
          By using Cat Chaos Arena you acknowledge that you have read and agree to these Terms of Use.
        </p>
      </div>
    </div>
  );
}
