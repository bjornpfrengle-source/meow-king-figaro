import { useEffect, useRef, useState } from 'react';

/**
 * A video that doesn't hit the network until it's on screen.
 *
 * Why this exists: the Home screen rendered four autoplaying <video> elements
 * at once — the Trending hero plus three Recent Winners inside ~80px circles.
 * iOS allows only a small number of simultaneous video decode pipelines, and
 * once they're exhausted a video silently never starts.
 *
 * Implementation note, learned the hard way: the first version set
 * preload="none" and no autoPlay, and only called play() from onLoadedMetadata.
 * With preload="none" nothing ever requests the file, so loadedmetadata never
 * fired and play() was never reached — the videos deadlocked and none of them
 * played at all. Do not reintroduce that combination.
 *
 * The working shape is: render a cheap placeholder until visible, then mount a
 * completely ordinary autoplaying video. Mounting it is what starts the load,
 * so no preload games are needed.
 */
export function LazyVideo({
  src,
  className,
  wrapperClassName,
  trimStart,
  trimEnd,
  onClick,
  poster,
  rootMargin = '400px',
}: {
  src: string;
  className?: string;
  wrapperClassName?: string;
  trimStart?: number;
  trimEnd?: number;
  onClick?: (el: HTMLVideoElement) => void;
  poster?: string;
  rootMargin?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // No IntersectionObserver (or an odd webview): show the video rather than
    // leaving a permanent black box. Degrading to the old eager behaviour is
    // far better than degrading to nothing.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    // Tracks whether the observer reported at all. It fires once per observed
    // element immediately, including for off-screen ones, so "never reported"
    // is a genuinely broken observer rather than "not visible yet".
    let reported = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        reported = true;
        // Latch on. Unmounting a video that scrolls off screen would restart
        // it from black every time it comes back, which reads as broken.
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    io.observe(el);

    // Safety net for a genuinely dead observer (element inside a clipped or
    // zero-height ancestor at mount, which can happen during route
    // transitions). Guarded on `reported`: without that check this fired for
    // every element regardless, which would load all 50 Hall of Fame videos
    // 1.5s after opening the screen and undo the whole point.
    const failsafe = setTimeout(() => {
      if (!reported) setVisible(true);
    }, 1500);

    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, [rootMargin]);

  return (
    <div ref={wrapRef} className={wrapperClassName ?? className}>
      {visible ? (
        <video
          src={src}
          poster={poster}
          className={className}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
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
      ) : (
        <div className={`${className ?? ''} bg-neutral-200 animate-pulse`} />
      )}
    </div>
  );
}
