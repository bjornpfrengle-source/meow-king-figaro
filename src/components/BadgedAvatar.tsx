import { getReward } from './rewards';

/**
 * An avatar with the user's top earned badge pinned to its corner.
 *
 * Badges were only visible on your own profile screen, which meant the thing
 * you earn them for — other people seeing them — never happened. This is the
 * shared piece so the pip looks identical everywhere it appears: chat, public
 * profiles, and your own profile.
 *
 * `badgeId` is passed in rather than looked up here on purpose. In lists (the
 * chat feed especially) fetching each author's profile to read their badges
 * would be one Firestore read per row, so callers pass a value that was
 * already denormalised onto the record they're rendering.
 */
export function BadgedAvatar({
  src,
  name,
  badgeId,
  size = 40,
  className = '',
}: {
  src?: string | null;
  name?: string | null;
  badgeId?: string | null;
  size?: number;
  className?: string;
}) {
  const reward = getReward(badgeId);
  const Icon = reward?.icon;

  // The pip scales with the avatar so this works at 32px in a chat row and at
  // 128px on a profile header without separate hand-tuned sizes.
  const pip = Math.max(16, Math.round(size * 0.38));
  const initials = (name || '?').trim().charAt(0).toUpperCase();

  // Higher tiers restyle the whole avatar ring rather than just adding a pip —
  // a frame you can spot across a chat feed is the part people actually chase.
  const ring = reward?.ring ?? '';
  const glow = reward?.glow;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size, boxShadow: glow, borderRadius: '9999px' }}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Profile'}
          className={`w-full h-full rounded-full object-cover border-2 border-white shadow-sm ${ring}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`w-full h-full rounded-full bg-red-400 text-white font-black flex items-center justify-center border-2 border-white shadow-sm ${ring}`}
             style={{ fontSize: Math.round(size * 0.4) }}>
          {initials}
        </div>
      )}

      {reward && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ${reward.bg} border-2 border-white shadow flex items-center justify-center`}
          style={{ width: pip, height: pip }}
          title={reward.title}
          aria-label={reward.title}
        >
          {reward.emoji ? (
            <span style={{ fontSize: pip * 0.62, lineHeight: 1 }}>{reward.emoji}</span>
          ) : (
            Icon && <Icon className={reward.color} style={{ width: pip * 0.6, height: pip * 0.6 }} />
          )}
        </div>
      )}
    </div>
  );
}
