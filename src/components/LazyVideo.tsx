import { useEffect, useRef, useState } from 'react';

/**
 * A video that doesn't touch the network until it's actually on screen.
 *
 * Every `<video>` in the app used to render with `autoPlay` and no `preload`,
 * which defaults to eager. The Home screen alone kicked off four full 720p
 * downloads at once — the Trending hero plus three Recent Winners, the latter
 * displayed inside ~80px circles. They compete for bandwidth, and more
 * importantly for iOS's limited number of simultaneous video decode pipelines;
 * once those are exhausted videos simply never start, with no error. That's
 * what "struggling to load and doesn't play" looks like.
 *
 * This keeps `src` unset until the element scrolls into view, so off-screen
 * clips cost nothing, and pauses again on the way out to free the decoder.
 */
export function LazyVideo({
  src,
  className,
  trimStart,
  trimEnd,
  onClick,
  poster,
  rootMargin = '200px',
}: {
  src: string;
  className?: string;
  trimStart?: number;
  trimEnd?: number;
  onClick?: (el: HTMLVideoElement) => void;
  poster?: string;
  /** Start loading slightly before it's visible so it isn't blank on arrival. */
  rootMargin?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          el.play?.().catch(() => {});
        } else {
          el.pause?.();
        }
      },
      { rootMargin, threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <video
      ref={ref}
      // src is only attached once visible — setting it earlier is what starts
      // the download, regardless of preload.
      src={visible ? src : undefined}
      poster={poster}
      className={className}
      preload="none"
      loop
      muted
      playsInline
      onClick={onClick ? (e) => onClick(e.currentTarget) : undefined}
      onLoadedMetadata={(e) => {
        if (trimStart) e.currentTarget.currentTime = trimStart;
        e.currentTarget.play().catch(() => {});
      }}
      onTimeUpdate={(e) => {
        if (trimStart !== undefined && trimEnd !== undefined) {
          if (e.currentTarget.currentTime >= trimEnd || e.currentTarget.currentTime < trimStart) {
            e.currentTarget.currentTime = trimStart;
          }
        }
      }}
    />
  );
}
