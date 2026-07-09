import { useEffect } from "react";

const RAT_VIDEO = `${import.meta.env.BASE_URL}assets/ratrun2.MP4`;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function applyWhiteKey(
  imageData: ImageData,
  { threshold = 218, softness = 38, maxSaturation = 48 } = {},
) {
  const d = imageData.data;
  const soft = Math.max(1, softness);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const sat = max - min;

    if (min <= threshold - soft || sat > maxSaturation) continue;

    let alpha: number;
    if (min >= threshold) {
      alpha = 0;
    } else {
      alpha = Math.round(255 * ((min - (threshold - soft)) / soft));
    }

    d[i + 3] = Math.min(d[i + 3], alpha);
  }

  return imageData;
}

function darkenSilhouette(imageData: ImageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 12) continue;
    d[i] = Math.round(d[i] * 0.14);
    d[i + 1] = Math.round(d[i + 1] * 0.12);
    d[i + 2] = Math.round(d[i + 2] * 0.12);
    d[i + 3] = Math.min(255, Math.round(a * 0.88));
  }
  return imageData;
}

function canvasSizeForVideo(video: HTMLVideoElement, maxWidth = 440) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.min(1, maxWidth / vw);
  return {
    width: Math.max(1, Math.round(vw * scale)),
    height: Math.max(1, Math.round(vh * scale)),
  };
}

/** Silhouette rats crossing the tunnel floor (landing + infection pages). */
export function useTunnelRats() {
  useEffect(() => {
    const tunnelTrack = document.getElementById("rz2TunnelTrack");
    const ratVideo = document.getElementById("rz2RatVideo") as HTMLVideoElement | null;
    const ratSource = document.getElementById("rz2RatSource") as HTMLCanvasElement | null;

    if (!ratVideo || !ratSource || !tunnelTrack) return;

    const srcCtx = ratSource.getContext("2d", { willReadFrequently: true });
    if (!srcCtx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let ratRaf = 0;
    let ratCrossingTimer = 0;
    let ratFrameSize = { width: 1, height: 1 };
    let activeCount = 0;
    const RAT_MAX_ACTIVE = 4;

    function ratCanvasMaxWidth() {
      const trackW = tunnelTrack!.clientWidth || 1;
      return Math.max(80, Math.round(trackW * 0.52));
    }

    function drawSourceFrame() {
      if (ratVideo!.readyState < 2) return;
      ratFrameSize = canvasSizeForVideo(ratVideo!, ratCanvasMaxWidth());
      const { width, height } = ratFrameSize;
      if (ratSource!.width !== width || ratSource!.height !== height) {
        ratSource!.width = width;
        ratSource!.height = height;
      }
      srcCtx!.clearRect(0, 0, width, height);
      srcCtx!.drawImage(ratVideo!, 0, 0, width, height);
      try {
        const frame = srcCtx!.getImageData(0, 0, width, height);
        applyWhiteKey(frame, {
          threshold: 228,
          softness: 36,
          maxSaturation: 42,
        });
        darkenSilhouette(frame);
        srcCtx!.putImageData(frame, 0, 0);
      } catch {
        /* skip frame if canvas busy */
      }
    }

    function syncMoverCanvases() {
      tunnelTrack!.querySelectorAll(".rz2-rat-run__mover").forEach((mover) => {
        const canvas = mover.querySelector("canvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx || ratSource!.width < 1) return;
        if (canvas.width !== ratSource!.width) {
          canvas.width = ratSource!.width;
          canvas.height = ratSource!.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(ratSource!, 0, 0);
      });
    }

    function loop() {
      drawSourceFrame();
      syncMoverCanvases();
      ratRaf = requestAnimationFrame(loop);
    }

    function startLoop() {
      cancelAnimationFrame(ratRaf);
      ratRaf = requestAnimationFrame(loop);
    }

    function spawnCrossing() {
      if (activeCount >= RAT_MAX_ACTIVE) return;

      const ltr = Math.random() < 0.5;
      const duration = rand(3400, 4800);
      const offLeft = "-48%";
      const offRight = "148%";

      const mover = document.createElement("div");
      mover.className = `rz2-rat-run__mover ${ltr ? "is-ltr" : "is-rtl"}`;

      const canvas = document.createElement("canvas");
      canvas.className = "rz2-rat-run__canvas";
      canvas.width = ratFrameSize.width;
      canvas.height = ratFrameSize.height;
      mover.appendChild(canvas);
      tunnelTrack!.appendChild(mover);
      activeCount += 1;

      mover.style.transition = "none";
      mover.style.left = ltr ? offLeft : offRight;
      mover.style.opacity = "0";
      void mover.offsetWidth;

      mover.style.transition = `left ${duration}ms linear, opacity 0.32s ease`;
      requestAnimationFrame(() => {
        mover.style.left = ltr ? offRight : offLeft;
        mover.style.opacity = "1";
      });

      const fadeTimer = window.setTimeout(() => {
        mover.style.opacity = "0";
      }, duration * 0.92);

      window.setTimeout(() => {
        window.clearTimeout(fadeTimer);
        mover.remove();
        activeCount = Math.max(0, activeCount - 1);
      }, duration + 120);
    }

    function scheduleCrossing() {
      if (reducedMotion) return;
      window.clearTimeout(ratCrossingTimer);
      ratCrossingTimer = window.setTimeout(() => {
        let batch = 1;
        const roll = Math.random();
        if (roll < 0.42) batch = 2;
        else if (roll < 0.52) batch = 3;

        for (let i = 0; i < batch; i += 1) {
          window.setTimeout(() => spawnCrossing(), i * rand(180, 520));
        }
        scheduleCrossing();
      }, rand(350, 1200));
    }

    function startPlayback() {
      tunnelTrack!.classList.add("is-ready");
      drawSourceFrame();
      if (reducedMotion) return;
      ratVideo!.play().catch(() => {});
      startLoop();
      window.setTimeout(scheduleCrossing, rand(400, 900));
    }

    const onVideoLoaded = () => startPlayback();
    const onVideoError = () => {
      tunnelTrack!.classList.remove("is-ready");
    };

    ratVideo.addEventListener("loadeddata", onVideoLoaded, { once: true });
    ratVideo.addEventListener("error", onVideoError);

    const onVisibility = () => {
      if (document.hidden) {
        ratVideo!.pause();
        cancelAnimationFrame(ratRaf);
        ratRaf = 0;
        window.clearTimeout(ratCrossingTimer);
        tunnelTrack!
          .querySelectorAll(".rz2-rat-run__mover")
          .forEach((el) => el.remove());
        activeCount = 0;
      } else if (!reducedMotion && ratVideo!.readyState >= 2) {
        ratVideo!.play().catch(() => {});
        startLoop();
        scheduleCrossing();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    ratVideo.src = RAT_VIDEO;
    ratVideo.load();

    return () => {
      ratVideo.removeEventListener("loadeddata", onVideoLoaded);
      ratVideo.removeEventListener("error", onVideoError);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(ratRaf);
      window.clearTimeout(ratCrossingTimer);
      tunnelTrack.classList.remove("is-ready");
      tunnelTrack.querySelectorAll(".rz2-rat-run__mover").forEach((el) => el.remove());
    };
  }, []);
}
