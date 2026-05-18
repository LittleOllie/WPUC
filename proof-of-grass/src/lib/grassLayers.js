import grassBack from "../../assets/grssback.png";
import grassMiddle from "../../assets/Untitled_Artwork-1.png";
import grassFront from "../../assets/grassfront.png";

export const GRASS_IMAGES = {
  back: grassBack,
  middle: grassMiddle,
  front: grassFront,
};

/**
 * Vertical depth (bottom anchor, offsetY):
 *   front  = lowest  (page bottom)
 *   middle = stepped up
 *   back   = highest, behind
 *
 * offsetY: negative ↑  positive ↓
 */
export const GRASS_LAYER_CONFIG = [
  {
    id: "back",
    src: grassBack,
    zIndex: 10,
    /** Desktop: one row; mobile: two overlapped rows (see mobileRows) */
    rows: 4,
    mobileRows: 2,
    scale: 1.555,
    offsetY: -36,
    opacity: 0.9,
    parallax: 0.28,
    windAmp1: 0.55,
    windAmp2: 0.3,
    windSpeed1: 0.00052,
    windSpeed2: 0.00035,
    phaseStep: 0.28,
    phaseOffset: 0,
    maxBend: 2.5,
    maxAngle: 4,
    pointerRadius: 0.2,
    interactGain: 0.75,
    stiffnessIdle: 0.032,
    stiffnessActive: 0.052,
    damping: 0.89,
    translateGain: 0.65,
    layerSway: 0.5,
  },
  {
    id: "middle",
    src: grassMiddle,
    zIndex: 20,
    scale: 1.336,
    offsetY: -18,
    opacity: 0.96,
    parallax: 0.62,
    windAmp1: 0.9,
    windAmp2: 0.48,
    windSpeed1: 0.00062,
    windSpeed2: 0.00042,
    phaseStep: 0.32,
    phaseOffset: 1.4,
    maxBend: 4.5,
    maxAngle: 6.5,
    pointerRadius: 0.24,
    interactGain: 0.95,
    stiffnessIdle: 0.036,
    stiffnessActive: 0.058,
    damping: 0.87,
    translateGain: 1.2,
    layerSway: 0.8,
  },
  {
    id: "front",
    src: grassFront,
    zIndex: 30,
    scale: 1.402,
    offsetY: 0,
    opacity: 1,
    parallax: 1,
    windAmp1: 1.15,
    windAmp2: 0.62,
    windSpeed1: 0.00072,
    windSpeed2: 0.00048,
    phaseStep: 0.36,
    phaseOffset: 2.6,
    maxBend: 6,
    maxAngle: 8,
    pointerRadius: 0.26,
    interactGain: 1.1,
    stiffnessIdle: 0.038,
    stiffnessActive: 0.062,
    damping: 0.86,
    translateGain: 1.55,
    layerSway: 1,
  },
];
