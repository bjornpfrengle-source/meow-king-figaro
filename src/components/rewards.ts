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
