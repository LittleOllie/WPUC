import { ASSETS } from "../lib/assets.js";
import KeyedVideoCrossLayer from "./KeyedVideoCrossLayer.jsx";

export default function CoachSkateLayer() {
  return (
    <KeyedVideoCrossLayer
      src={ASSETS.coachSkate}
      direction="rtl"
      wrapClassName="pog-coach-skate-wrap"
      canvasClassName="pog-coach-skate pog-touch-guard"
      sourceClassName="pog-coach-skate-source"
      trimStartSec={1}
      trimTailSec={0.85}
      centerAtVideoSec={4}
      schedule={{
        minGapMs: 22_000,
        maxGapMs: 58_000,
        firstRunMinMs: 12_000,
        firstRunMaxMs: 24_000,
      }}
    />
  );
}
