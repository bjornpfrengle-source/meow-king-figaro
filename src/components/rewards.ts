import { Award, Star, Gift, PawPrint, Flame, Crown, Sparkles, Rocket, Gem, Medal, Zap, Heart } from 'lucide-react';

export interface Reward {
  id: string;
  title: string;
  /** One line of flavour shown under the title on the Rewards screen. */
  blurb: string;
  cost: number; // vote-points needed to unlock
  icon: any;
  color: string;
  bg: string;
  /**
   * Optional avatar treatment. Cosmetic badges are fine as a corner pip, but
   * the headline rewards (frames, auras) are the ones people actually chase,
   * so they restyle the whole avatar ring instead.
   *
   * `ring` is applied to the avatar wrapper; `glow` is an outer box-shadow.
   */
  ring?: string;
  glow?: string;
}

/**
 * Cosmetic rewards earned by hitting vote-point milestones. Unlocking is a
 * permanent achievement (points are not spent), stored on the user profile.
 *
 * Ordered by cost — `topBadgeId` relies on cost to decide which single reward
 * represents a user, so a new tier slots in purely by its number.
 */
export const DIGITAL_REWARDS: Reward[] = [
  {
    id: 'first-paw', title: 'First Paw', blurb: 'You entered the arena.',
    cost: 1, icon: PawPrint, color: 'text-neutral-500', bg: 'bg-neutral-100',
  },
  {
    id: 'golden-crown', title: 'Golden Crown', blurb: 'Ten votes. People like your cat.',
    cost: 10, icon: Award, color: 'text-yellow-600', bg: 'bg-yellow-100',
    ring: 'ring-2 ring-yellow-400',
  },
  {
    id: 'hot-streak', title: 'Hot Streak', blurb: 'Twenty-five votes and climbing.',
    cost: 25, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100',
    ring: 'ring-2 ring-orange-400',
  },
  {
    id: 'neon-frame', title: 'Neon Laser Frame', blurb: 'Your avatar, but electric.',
    cost: 50, icon: Star, color: 'text-pink-600', bg: 'bg-pink-100',
    ring: 'ring-4 ring-pink-500',
    glow: '0 0 12px 2px rgba(236,72,153,0.75)',
  },
  {
    id: 'vip-yarn', title: 'VIP Yarn Ball', blurb: 'A hundred votes. Certified spoiled.',
    cost: 100, icon: Gift, color: 'text-purple-600', bg: 'bg-purple-100',
    ring: 'ring-4 ring-purple-500',
    glow: '0 0 14px 3px rgba(168,85,247,0.75)',
  },
  {
    id: 'crowd-favourite', title: 'Crowd Favourite', blurb: 'Two hundred and fifty votes.',
    cost: 250, icon: Heart, color: 'text-rose-600', bg: 'bg-rose-100',
    ring: 'ring-4 ring-rose-500',
    glow: '0 0 16px 3px rgba(244,63,94,0.8)',
  },
  {
    id: 'lightning', title: 'Lightning Aura', blurb: 'Five hundred votes. Unmissable.',
    cost: 500, icon: Zap, color: 'text-cyan-600', bg: 'bg-cyan-100',
    ring: 'ring-4 ring-cyan-400',
    glow: '0 0 18px 4px rgba(34,211,238,0.85)',
  },
  {
    id: 'diamond', title: 'Diamond Paw', blurb: 'A thousand votes. Rarefied air.',
    cost: 1000, icon: Gem, color: 'text-sky-600', bg: 'bg-sky-100',
    ring: 'ring-4 ring-sky-400',
    glow: '0 0 20px 5px rgba(56,189,248,0.85)',
  },
  {
    id: 'legend', title: 'Arena Legend', blurb: 'Twenty-five hundred. Genuinely rare.',
    cost: 2500, icon: Crown, color: 'text-amber-700', bg: 'bg-amber-100',
    ring: 'ring-4 ring-amber-400',
    glow: '0 0 24px 6px rgba(251,191,36,0.9)',
  },
  {
    id: 'mythic', title: 'Mythic Chaos', blurb: 'Five thousand votes. Hall of fame.',
    cost: 5000, icon: Sparkles, color: 'text-fuchsia-700', bg: 'bg-fuchsia-100',
    ring: 'ring-4 ring-fuchsia-500',
    glow: '0 0 28px 7px rgba(217,70,239,0.9)',
  },
  {
    id: 'ascended', title: 'Ascended', blurb: 'Ten thousand votes. Nobody has done this yet.',
    cost: 10000, icon: Rocket, color: 'text-violet-700', bg: 'bg-violet-100',
    ring: 'ring-4 ring-violet-500',
    glow: '0 0 32px 8px rgba(139,92,246,0.95)',
  },
];

/** Badge shown against a theme win rather than a vote total. */
export const CHAMPION_REWARD: Reward = {
  id: 'theme-champion', title: 'Theme Champion', blurb: 'Won a daily theme outright.',
  cost: 0, icon: Medal, color: 'text-yellow-600', bg: 'bg-yellow-100',
};

export function getReward(id?: string | null): Reward | null {
  if (!id) return null;
  if (id === CHAMPION_REWARD.id) return CHAMPION_REWARD;
  return DIGITAL_REWARDS.find((r) => r.id === id) ?? null;
}

/**
 * The single badge to show next to a user's avatar.
 *
 * A user keeps every badge they earn, but an avatar pip only has room for one,
 * so show the most expensive one they own — that's the most impressive and it
 * only ever moves up as they earn more. Returns null for users with no badges.
 */
export function topBadgeId(badges?: string[] | null): string | null {
  if (!badges || badges.length === 0) return null;
  const owned = DIGITAL_REWARDS.filter((r) => badges.includes(r.id));
  if (owned.length === 0) return null;
  return owned.reduce((best, r) => (r.cost > best.cost ? r : best)).id;
}

/** Everything earned at this point total, cheapest first. */
export function earnedRewards(points: number): Reward[] {
  return DIGITAL_REWARDS.filter((r) => points >= r.cost);
}

/** The next tier to chase, or null once everything is unlocked. */
export function nextReward(points: number): Reward | null {
  return DIGITAL_REWARDS.find((r) => points < r.cost) ?? null;
}
