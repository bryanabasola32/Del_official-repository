import { useEffect, useRef } from "react";

export interface AuroraBackgroundProps {
  /** URL of the seamless (palindrome-encoded) loop video. */
  videoSrc: string;
  /** Still frame shown before playback / when autoplay is blocked. */
  posterSrc?: string;
  /** Disable the pointer-tracking spotlight and parallax. */
  interactive?: boolean;
  className?: string;
}

/**
 * Layer 0 — living gradient background.
 *
 * - the clip should be encoded as a palindrome (forward + reverse) so playback
 *   returns to its exact first frame and `loop` is visually seamless
 * - a cursor spotlight lifts the artwork's colours where the pointer is
 * - the field parallaxes gently with pointer movement
 *
 * All motion is transform/opacity only. Under `prefers-reduced-motion` the
 * video is paused on its poster frame and animations are disabled in CSS.
 */
export function AuroraBackground({
  videoSrc,
  posterSrc,
  interactive = true,
  className,
}: AuroraBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      /* autoplay blocked — poster remains visible */
    });
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const el = rootRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      el.style.setProperty("--cursor-opacity", "1");
    };
    const onLeave = () => el.style.setProperty("--cursor-opacity", "0");

    const tick = () => {
      x += (targetX - x) * 0.1;
      y += (targetY - y) * 0.1;
      el.style.setProperty("--cursor-x", `${x}px`);
      el.style.setProperty("--cursor-y", `${y}px`);
      el.style.setProperty("--px", `${(x / window.innerWidth - 0.5) * 4}%`);
      el.style.setProperty("--py", `${(y / window.innerHeight - 0.5) * 4}%`);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  return (
    <div
      aria-hidden="true"
      ref={rootRef}
      className={["aurora-bg", className].filter(Boolean).join(" ")}
    >
      <div className="aurora-parallax">
        <video
          ref={videoRef}
          className="aurora-video"
          src={videoSrc}
          poster={posterSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
        />
      </div>
      <div className="aurora-cursor-light" />
      <div className="aurora-vignette" />
    </div>
  );
}
