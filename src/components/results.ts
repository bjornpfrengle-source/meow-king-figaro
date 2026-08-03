/**
 * Who actually won a theme.
 *
 * This lived twice — once in ProfileScreen's trophy cabinet, once in
 * PublicProfileScreen's win counter — and both copies had the same bug:
 *
 *     let topScore = -1;
 *     if ((x.score || 0) > topScore) { topScore = ...; topOwner = ...; }
 *
 * Seeding at -1 means a cat with zero votes clears the bar (0 > -1) and gets
 * crowned. Enter a theme nobody else entered, receive no votes whatsoever, and
 * the app calls you champion. Ties were resolved by whichever document
 * Firestore happened to return first, so two cats on equal votes produced an
 * arbitrary — and unstable — winner.
 *
 * Rules now:
 *   - zero votes is never a win. You cannot win a competition nobody voted in.
 *   - a tie at the top has no single winner, so nobody is champion. Better to
 *     award nothing than to hand it to whoever sorted first.
 */
export interface ScoredEntry {
  ownerId?: string;
  score?: number;
}

export function themeWinnerId(entries: ScoredEntry[]): string | null {
  let topScore = 0; // not -1: a zero-vote entry must not qualify
  let topOwner: string | null = null;
  let tied = false;

  for (const e of entries) {
    const score = e.score || 0;
    if (score > topScore) {
      topScore = score;
      topOwner = e.ownerId ?? null;
      tied = false;
    } else if (score === topScore && topOwner !== null && (e.ownerId ?? null) !== topOwner) {
      // Someone else matched the current best — contested, no clean winner.
      tied = true;
    }
  }

  if (tied) return null;
  return topOwner;
}

/** Did this user win the theme these entries belong to? */
export function isThemeWinner(entries: ScoredEntry[], uid: string): boolean {
  return themeWinnerId(entries) === uid;
}
