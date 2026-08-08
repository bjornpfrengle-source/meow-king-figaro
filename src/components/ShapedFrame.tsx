/**
 * Non-rectangular photo frames (heart, paw) with an optional glowing pulse.
 *
 * Why CSS masks rather than SVG clipPath: a clipPath referenced by id has to
 * live in the DOM exactly once and be addressed by a global id, which gets
 * fragile the moment two cards render at different sizes. A mask-image data
 * URI is self-contained per element and scales with `mask-size: contain`, so
 * the same component works at 64px and 200px with no shared state.
 *
 * The glow is a `drop-shadow` filter on a WRAPPER around the masked element,
 * not on the masked element itself. drop-shadow traces the alpha channel, so
 * it follows the heart/paw outline instead of drawing a rectangle — but only
 * if it is applied to an ancestor, since a filter and a mask on the same
 * element composite in the wrong order and the glow gets clipped away.
 *
 * -webkit- prefixes are kept deliberately. WKWebView still wants them for
 * mask-image, and this app ships inside a WKWebView.
 */

import type { CSSProperties, ReactNode } from 'react';

/** Heart, drawn in a 100x100 box so `mask-size: contain` can scale it freely. */
const HEART =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 92C22 72 4 55 4 34 4 18 16 6 31 6c10 0 16 5 19 10 3-5 9-10 19-10 15 0 27 12 27 28 0 21-18 38-46 58z' fill='%23000'/></svg>";

/**
 * Paw: four toes and a pad. Deliberately drawn a bit squat — a tall paw reads
 * as a random blob at thumbnail size, where only the silhouette survives.
 */
const PAW =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><ellipse cx='22' cy='30' rx='13' ry='17'/><ellipse cx='42' cy='17' rx='13' ry='17'/><ellipse cx='64' cy='17' rx='13' ry='17'/><ellipse cx='83' cy='32' rx='13' ry='17'/><path d='M52 44c16 0 30 12 30 26 0 11-9 18-21 18-6 0-9-2-13-2s-7 2-13 2c-12 0-21-7-21-18 0-14 14-26 30-26z'/></svg>";

const SHAPES = { heart: HEART, paw: PAW } as const;

export type FrameShape = keyof typeof SHAPES;

function maskStyle(shape: FrameShape): CSSProperties {
  const url = `url("data:image/svg+xml;utf8,${SHAPES[shape]}")`;
  return {
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as CSSProperties;
}

export function ShapedFrame({
  shape,
  children,
  className = '',
  borderColor = '#f9a8d4',
  glowColor = 'rgba(244,114,182,0.85)',
  pulse = false,
  borderWidth = 3,
}: {
  shape: FrameShape;
  children: ReactNode;
  className?: string;
  /** Fill of the shape sitting behind the content, which reads as the border. */
  borderColor?: string;
  glowColor?: string;
  pulse?: boolean;
  borderWidth?: number;
}) {
  return (
    // Outer wrapper carries the glow only. Keeping the filter off the masked
    // layers is what lets the shadow take the shape of the heart/paw.
    <div
      className={`${pulse ? 'shaped-frame-pulse' : ''} ${className}`}
      style={{ ['--frame-glow' as any]: glowColor }}
    >
      {/* Coloured shape — the visible border is just this one peeking out. */}
      <div className="w-full h-full" style={{ ...maskStyle(shape), backgroundColor: borderColor }}>
        {/* Content, masked again and inset so the border shows evenly. */}
        <div
          className="w-full h-full overflow-hidden"
          style={{ ...maskStyle(shape), padding: borderWidth }}
        >
          <div className="w-full h-full" style={maskStyle(shape)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
