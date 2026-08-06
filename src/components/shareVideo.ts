import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

/**
 * Renders and caches the packaged "share the win" video: server burns
 * confetti + MEOW KING text onto the winning clip, we upload the result to
 * Storage once, and stamp the URL on the cat doc so every future call (and
 * every other screen) just reads it back instead of re-rendering.
 *
 * Called from two places — NotificationsScreen the moment a win is
 * discovered (so it's usually ready before anyone taps Share), and
 * WinnerCelebrationModal itself as a fallback if it wasn't. Both go through
 * this same function, which short-circuits on an existing shareVideoUrl and
 * guards against two calls for the same cat racing each other.
 */
const inFlight = new Set<string>();

export async function ensureShareVideo(
  cat: { id: string; ownerId: string; videoUrl?: string; shareVideoUrl?: string; name?: string },
  themeName: string,
  votes: number
): Promise<string | null> {
  if (cat.shareVideoUrl) return cat.shareVideoUrl;
  if (!cat.videoUrl || !cat.ownerId) return null;
  if (inFlight.has(cat.id)) return null;
  inFlight.add(cat.id);

  try {
    const res = await fetch('/api/generate-share-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: cat.videoUrl,
        catName: cat.name || 'Champion',
        themeName,
        votes,
      }),
    });
    if (!res.ok) {
      console.error('[ensureShareVideo] generate-share-video failed:', await res.text().catch(() => ''));
      return null;
    }
    const blob = await res.blob();
    // Scoped by owner uid, same convention as the main clip path
    // (videos/{userId}/{fileName}) — keeps this writable under the same
    // storage.rules shape without needing a cross-service Firestore lookup.
    const storageRef = ref(storage, `shareVideos/${cat.ownerId}/${cat.id}.mp4`);
    await uploadBytes(storageRef, blob, {
      contentType: 'video/mp4',
      // Same reasoning as the main clip upload: this file never changes once
      // rendered, so let it cache forever instead of re-downloading it from
      // us-central1 on every share/re-open.
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const shareVideoUrl = await getDownloadURL(storageRef);
    await updateDoc(doc(db, 'cats', cat.id), { shareVideoUrl });
    return shareVideoUrl;
  } catch (e) {
    console.error('[ensureShareVideo] failed:', e);
    return null;
  } finally {
    inFlight.delete(cat.id);
  }
}
