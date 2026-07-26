"use client";

import { sanitiseSvgMarkup } from "@/lib/image/svg-generator";

interface CircleVisualProps {
  svgMarkup: string;
  username: string;
}

export function CircleVisual({ svgMarkup, username }: CircleVisualProps) {
  const safe = sanitiseSvgMarkup(svgMarkup.replace(/^<\?xml[\s\S]*?\?>\s*/i, ""));

  return (
    <div className="card p-3 sm:p-4">
      <div
        className="circle-visual"
        role="img"
        aria-label={`Inner circle visualisation for @${username}`}
      >
        <div className="circle-visual__inner" dangerouslySetInnerHTML={{ __html: safe }} />
      </div>
    </div>
  );
}
