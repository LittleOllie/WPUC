import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_INFECTION_STATS,
  infectionProgressPercent,
  isOutbreakComplete,
  subscribeInfectionStats,
  type InfectionStats,
} from "../lib/infectionStats";

export interface UseInfectionStatsResult {
  stats: InfectionStats;
  progress: number;
  complete: boolean;
  available: boolean;
  /** True briefly when count increases (for pulse animation). */
  pulsing: boolean;
}

/**
 * Shared realtime hook for outbreak counter UI on landing + infection pages.
 */
export function useInfectionStats(): UseInfectionStatsResult {
  const [stats, setStats] = useState<InfectionStats>(DEFAULT_INFECTION_STATS);
  const [available, setAvailable] = useState(true);
  const [pulsing, setPulsing] = useState(false);
  const previousCount = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeInfectionStats(
        (next) => {
          setAvailable(true);

          if (
            previousCount.current !== null &&
            next.count > previousCount.current
          ) {
            setPulsing(true);
            if (pulseTimer.current !== null) {
              window.clearTimeout(pulseTimer.current);
            }
            pulseTimer.current = window.setTimeout(() => {
              setPulsing(false);
              pulseTimer.current = null;
            }, 700);
          }

          previousCount.current = next.count;
          setStats(next);
        },
        (error) => {
          console.error("[ratzilla] infection counter unavailable:", error);
          setAvailable(false);
        },
      );
    } catch (error) {
      console.error("[ratzilla] failed to subscribe to infection stats:", error);
      setAvailable(false);
    }

    return () => {
      unsubscribe?.();
      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
      }
    };
  }, []);

  return {
    stats,
    progress: infectionProgressPercent(stats),
    complete: isOutbreakComplete(stats),
    available,
    pulsing,
  };
}
