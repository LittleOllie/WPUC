/** Strip near-white pixels from a canvas ImageData (white-screen video BG). */
export function applyWhiteKey(
  imageData,
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

    let alpha;
    if (min >= threshold) {
      alpha = 0;
    } else {
      alpha = Math.round(255 * ((min - (threshold - soft)) / soft));
    }

    d[i + 3] = Math.min(d[i + 3], alpha);
  }

  return imageData;
}

export function canvasSizeForVideo(video, maxWidth = 720) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.min(1, maxWidth / vw);
  return {
    width: Math.max(1, Math.round(vw * scale)),
    height: Math.max(1, Math.round(vh * scale)),
  };
}
