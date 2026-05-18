import { useEffect, useState } from "react";
import { MOBILE_MEDIA } from "../lib/mobileGrass.js";

/** Reliable mobile flag for layout classes (works with iOS Safari + deployed CSS) */
export function useMobileLayout() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_MEDIA).matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}
