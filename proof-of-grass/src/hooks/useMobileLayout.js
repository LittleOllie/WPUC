import { useDisplayMode } from "./useDisplayMode.js";

/** @deprecated Use useDisplayMode().portrait — portrait is default on all devices */
export function useMobileLayout() {
  const { portrait } = useDisplayMode();
  return portrait;
}
