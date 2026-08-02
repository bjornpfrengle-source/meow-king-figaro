import { Award, Star, Gift } from 'lucide-react';

export interface Reward {
  id: string;
  title: string;
  cost: number; // vote-points needed to unlock
  icon: any;
  color: string;
  bg: string;
}

// Cosmetic badges earned by hitting vote-point milestones. Unlocking is a
// permanent achievement (points are not spent), stored on the user profile.
export const DIGITAL_REWARDS: Reward[] = [
  { id: 'golden-crown', title: 'Golden Crown Badge', cost: 10, icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'neon-frame', title: 'Neon Laser Frame', cost: 50, icon: Star, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 'vip-yarn', title: 'VIP Yarn Ball Icon', cost: 100, icon: Gift, color: 'text-purple-500', bg: 'bg-purple-50' },
];

export function getReward(id?: string | null): Reward | null {
  if (!id) return null;
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
