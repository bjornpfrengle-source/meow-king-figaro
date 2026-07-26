/**
 * Free-tier limits.
 *
 * The economics here: storing a clip is cheap, but every clip gets watched
 * hundreds of times in the voting deck, and egress bandwidth is what Firebase
 * actually bills for. So the cap exists to keep costs predictable, NOT to make
 * the free tier painful — a free user should still be able to compete regularly
 * enough to get hooked.
 *
 * Tune FREE_UPLOADS_PER_MONTH once real usage data exists.
 */
export const FREE_UPLOADS_PER_MONTH = 4;

/**
 * While this is true, every new account is flagged as a founding member and
 * keeps unlimited uploads for life. This is deliberate: the friends and family
 * seeding the arena at launch are the reason there's anything to vote on, and
 * grandfathering them costs almost nothing at this scale.
 *
 * Flip to false once there's enough organic content to stand on its own.
 */
export const FOUNDING_PERIOD_OPEN = true;

/** First millisecond of the current calendar month, used for the upload count. */
export function startOfMonthMs(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
}

/** Human label for when the free allowance resets. */
export function nextResetLabel(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  });
}
