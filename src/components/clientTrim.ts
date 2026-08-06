/**
 * Trims a video to [trimStart, trimEnd) entirely on-device before it ever
 * touches the network, instead of shipping the whole original recording to
 * the server just to have it cut down there.
 *
 * Why this matters: the previous flow sent the ENTIRE original file (phone
 * footage routinely 45-120MB) across the user's mobile upload connection —
 * often 1-2 Mbps — before the server ever trimmed it to the 15-30s that
 * actually gets published. That's the whole reason uploads were taking
 * 6-8+ minutes for what ends up being a short clip; raising the request
 * timeout (done earlier) stopped it from being misreported as "too long",
 * but did nothing about the actual transfer time. This cuts what crosses
 * the network by roughly the same ratio the clip gets trimmed by — a 70MB
 * original trimmed to 20% of its length becomes a ~15MB upload instead.
 *
 * Only targets Safari/WebKit, because that's the only engine this app ever
 * runs in (the WKWebView shell, or Safari itself) — captureStream() +
 * MediaRecorder's 'video/mp4' output is a WebKit-specific combination that
 * needs no extra libraries or WASM encoders. If either API is unavailable,
 * this returns null and the caller falls back to sending the original file
 * exactly as it did before — no regression for any case this doesn't cover.
 */
export async function trimClientSide(
  file: File,
  trimStart: number,
  trimEnd: number,
  onProgress?: (fraction: number) => void
): Promise<Blob | null> {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported?.('video/mp4')) {
    return null;
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  // Muted, not unmuted: play() here happens after several awaits, well
  // outside the tap that started the submit — Safari would likely block an
  // unmuted autoplay at that point. captureStream() still captures the real
  // decoded audio track regardless of this element's mute state (mute only
  // affects what comes out of the speaker), so the recorded clip keeps sound.
  video.muted = true;
  video.playsInline = true;
  // Off-screen via position, not display:none — some WebKit versions pause
  // decoding (and therefore captureStream) on a display:none video element.
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.top = '0';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);

  const cleanup = () => {
    try { video.pause(); } catch {}
    video.remove();
    URL.revokeObjectURL(url);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video metadata'));
    });

    // @ts-ignore - captureStream is real in WebKit but missing from this project's DOM lib target
    const stream: MediaStream | undefined = video.captureStream?.();
    if (!stream || stream.getVideoTracks().length === 0) {
      cleanup();
      return null;
    }

    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const clipSeconds = Math.max(trimEnd - trimStart, 0.5);
    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));
      // @ts-ignore - MediaRecorderErrorEvent isn't in this project's lib target
      recorder.onerror = (e) => reject(e.error || e);
    });

    video.currentTime = trimStart;
    await new Promise<void>((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
      video.addEventListener('seeked', onSeeked);
      // Some clips never fire seeked from time 0 — don't hang forever on it.
      setTimeout(resolve, 1500);
    });

    recorder.start();
    await video.play();

    await new Promise<void>((resolve) => {
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        video.removeEventListener('timeupdate', onTimeUpdate);
        resolve();
      };
      const onTimeUpdate = () => {
        onProgress?.(Math.min((video.currentTime - trimStart) / clipSeconds, 1));
        if (video.currentTime >= trimEnd) stop();
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      // Safety net a couple seconds past the expected length, in case
      // timeupdate stalls rather than trusting a single event to fire.
      setTimeout(stop, (clipSeconds + 3) * 1000);
    });

    video.pause();
    recorder.stop();
    const blob = await recorded;
    cleanup();
    return blob.size > 0 ? blob : null;
  } catch (e) {
    console.error('[trimClientSide] failed, falling back to full upload:', e);
    cleanup();
    return null;
  }
}
