import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { applyWhiteKey, canvasSizeForVideo } from "../lib/whiteKeyFrame.js";

const FALLBACK_RUN_S = 4.2;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function playbackLength(duration, trimStartSec, trimEndSec, trimTailSec) {
  const end =
    trimEndSec != null ? trimEndSec : Math.max(trimStartSec, duration - trimTailSec);
  return Math.max(0.25, end - trimStartSec);
}

/**
 * White-keyed video character that crosses the scene on a random schedule.
 * @param {"ltr" | "rtl"} direction
 */
export default function KeyedVideoCrossLayer({
  src,
  direction = "ltr",
  wrapClassName,
  canvasClassName,
  sourceClassName,
  trimStartSec = 0,
  trimEndSec = null,
  trimTailSec = 0,
  /** Absolute video timestamp that should align with horizontal screen center */
  centerAtVideoSec = null,
  schedule: {
    minGapMs = 18_000,
    maxGapMs = 52_000,
    firstRunMinMs = 6_000,
    firstRunMaxMs = 14_000,
  } = {},
}) {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const gapTimerRef = useRef(0);
  const runDurationRef = useRef(FALLBACK_RUN_S);
  const [runId, setRunId] = useState(0);
  const [crossDuration, setCrossDuration] = useState(null);

  const offRight = "115vw";
  const offLeft = "-115vw";
  const fromX = direction === "rtl" ? offRight : offLeft;
  const toX = direction === "rtl" ? offLeft : offRight;
  const centerX = "calc(50vw - 50%)";
  const xKeyframes =
    direction === "rtl"
      ? [offRight, centerX, offLeft]
      : [offLeft, centerX, offRight];
  const centerProgress =
    centerAtVideoSec != null && crossDuration != null
      ? Math.min(
          0.92,
          Math.max(0.08, (centerAtVideoSec - trimStartSec) / crossDuration),
        )
      : null;

  const scheduleNextRun = useCallback(() => {
    window.clearTimeout(gapTimerRef.current);
    gapTimerRef.current = window.setTimeout(() => {
      setRunId((id) => id + 1);
      setCrossDuration(null);
    }, randomBetween(minGapMs, maxGapMs));
  }, [minGapMs, maxGapMs]);

  const finishRun = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = trimStartSec;
    }
    setRunId(0);
    setCrossDuration(null);
    scheduleNextRun();
  }, [scheduleNextRun, trimStartSec]);

  const applyDurationFromVideo = useCallback(
    (video) => {
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0.5) return;
      const len = playbackLength(d, trimStartSec, trimEndSec, trimTailSec);
      runDurationRef.current = len;
      setCrossDuration(len);
    },
    [trimStartSec, trimEndSec, trimTailSec],
  );

  useEffect(() => {
    if (reducedMotion) return undefined;

    gapTimerRef.current = window.setTimeout(() => {
      setRunId((id) => id + 1);
      setCrossDuration(null);
    }, randomBetween(firstRunMinMs, firstRunMaxMs));

    return () => window.clearTimeout(gapTimerRef.current);
  }, [reducedMotion, firstRunMinMs, firstRunMaxMs]);

  useEffect(() => {
    if (!runId || reducedMotion || crossDuration == null) return undefined;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return undefined;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;

    let rafId = 0;
    const playbackEnd = trimStartSec + crossDuration;

    const fitCanvas = () => {
      const { width, height } = canvasSizeForVideo(video);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const paintFrame = () => {
      if (video.readyState < 2) return;
      try {
        fitCanvas();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyWhiteKey(frame);
        ctx.putImageData(frame, 0, 0);
      } catch {
        /* skip frame if canvas read fails (memory / taint) */
      }
    };

    const tick = () => {
      if (!video.paused && !video.ended) paintFrame();
      rafId = requestAnimationFrame(tick);
    };

    const onTimeUpdate = () => {
      if (video.currentTime >= playbackEnd - 0.03) {
        video.pause();
      }
    };

    const play = () => {
      fitCanvas();
      video.currentTime = trimStartSec;
      video.play().catch(() => {});
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    };

    video.addEventListener("timeupdate", onTimeUpdate);

    if (video.readyState >= 1) play();
    else video.addEventListener("loadeddata", play, { once: true });

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [runId, reducedMotion, crossDuration, trimStartSec]);

  if (reducedMotion || !runId) return null;

  if (crossDuration == null) {
    return (
      <video
        ref={videoRef}
        className={sourceClassName}
        src={src}
        muted
        playsInline
        preload="auto"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => applyDurationFromVideo(e.currentTarget)}
      />
    );
  }

  return (
    <motion.div
      key={runId}
      className={wrapClassName}
      aria-hidden
      initial={{ x: fromX, opacity: 0 }}
      animate={{
        x: centerProgress != null ? xKeyframes : toX,
        opacity: 1,
      }}
      transition={{
        duration: crossDuration,
        ease: "linear",
        ...(centerProgress != null && {
          x: { times: [0, centerProgress, 1] },
        }),
        opacity: { duration: 0.15, ease: "easeOut" },
      }}
      onAnimationComplete={finishRun}
    >
      <video
        ref={videoRef}
        className={sourceClassName}
        src={src}
        muted
        playsInline
        preload="auto"
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => applyDurationFromVideo(e.currentTarget)}
      />
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        onContextMenu={(e) => e.preventDefault()}
      />
    </motion.div>
  );
}
