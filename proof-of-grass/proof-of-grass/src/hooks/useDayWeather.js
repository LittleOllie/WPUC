import { useEffect, useState } from "react";
import { WEATHER_CYCLE_MS } from "../lib/constants.js";

const WEATHERS = ["sunny", "cloudy", "sunset", "night", "rain", "fog"];

function weatherFromHour(h) {
  if (h >= 6 && h < 10) return "sunny";
  if (h >= 10 && h < 16) return "cloudy";
  if (h >= 16 && h < 19) return "sunset";
  if (h >= 19 || h < 6) return "night";
  return "sunny";
}

export function useDayWeather() {
  const [phase, setPhase] = useState(() => weatherFromHour(new Date().getHours()));
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const tick = () => {
      const h = new Date().getHours();
      setPhase((prev) => {
        const natural = weatherFromHour(h);
        if (Math.random() < 0.15) {
          const alt = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
          return alt;
        }
        return natural;
      });
    };
    const id = setInterval(tick, WEATHER_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCycleIndex((i) => i + 1), WEATHER_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return { weather: phase, cycleIndex };
}

export function skyGradient(weather) {
  switch (weather) {
    case "sunset":
      return "linear-gradient(180deg, #6b9fd4 0%, #f4a261 42%, #f9dcc4 68%, #87c4f8 100%)";
    case "night":
      return "linear-gradient(180deg, #0f1a2e 0%, #1a2d4a 38%, #2a3f5f 72%, #1e3348 100%)";
    case "rain":
      return "linear-gradient(180deg, #6a8fa8 0%, #8aa8bc 45%, #9eb0b8 100%)";
    case "fog":
      return "linear-gradient(180deg, #b8c9d4 0%, #d4dde4 55%, #e8eef2 100%)";
    case "cloudy":
      return "linear-gradient(180deg, #7eb8e8 0%, #a8d4f5 50%, #c5e4fa 100%)";
    default:
      return "linear-gradient(180deg, #5eb8f5 0%, #8fd4ff 48%, #b8e6ff 100%)";
  }
}
