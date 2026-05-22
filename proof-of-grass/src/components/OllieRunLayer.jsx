import { ASSETS } from "../lib/assets.js";
import KeyedVideoCrossLayer from "./KeyedVideoCrossLayer.jsx";

export default function OllieRunLayer() {
  return (
    <KeyedVideoCrossLayer
      src={ASSETS.ollieRun}
      direction="ltr"
      wrapClassName="pog-ollie-run-wrap"
      canvasClassName="pog-ollie-run pog-touch-guard"
      sourceClassName="pog-ollie-run-source"
      schedule={{
        minGapMs: 18_000,
        maxGapMs: 52_000,
        firstRunMinMs: 6_000,
        firstRunMaxMs: 14_000,
      }}
    />
  );
}
