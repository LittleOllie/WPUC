import { useEffect, useRef, type ReactNode } from "react";

interface RzAmbientStageProps {
  children: ReactNode;
  className?: string;
  live?: boolean;
}

export default function RzAmbientStage({
  children,
  className = "",
  live = true,
}: RzAmbientStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("rz2-page-scroll");
    document.body.classList.add("rz2-page-scroll");
    return () => {
      document.documentElement.classList.remove("rz2-page-scroll");
      document.body.classList.remove("rz2-page-scroll");
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let parallaxRaf = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(parallaxRaf);
      parallaxRaf = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        stage.style.setProperty("--rz2-px", String(x));
        stage.style.setProperty("--rz2-py", String(y));
        stage.setAttribute("data-parallax", "1");
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  return (
    <div className={`rz2-body rz2-body--scroll ${className}`.trim()}>
      <div
        ref={stageRef}
        className={`rz2-stage rz2-stage--page ${live ? "is-live" : ""}`.trim()}
      >
        <div className="rz2-scene" aria-hidden="true">
          <div className="rz2-scene__frame">
            <img
              className="rz2-scene__img"
              src={`${import.meta.env.BASE_URL}assets/RatzillaTunelBG.png`}
              alt=""
              draggable={false}
            />
            <div className="rz2-scene__depth" />
            <div className="rz2-scene__tunnel-glow" />
            <div className="rz2-lights" aria-hidden="true">
              <div className="rz2-lights__red rz2-lights__red--a" />
              <div className="rz2-lights__red rz2-lights__red--b" />
              <div className="rz2-lights__red rz2-lights__red--r1" />
              <div className="rz2-lights__red rz2-lights__red--r2" />
              <div className="rz2-lights__red rz2-lights__red--r3" />
              <div className="rz2-lights__dim rz2-lights__dim--a" />
              <div className="rz2-lights__dim rz2-lights__dim--b" />
              <div className="rz2-lights__tunnel" />
            </div>
          </div>
        </div>

        <div className="rz2-fog rz2-fog--1" aria-hidden="true" />
        <div className="rz2-fog rz2-fog--2" aria-hidden="true" />
        <div className="rz2-fog rz2-fog--3" aria-hidden="true" />
        <div className="rz2-smoke" aria-hidden="true" />
        <div className="rz-spores" aria-hidden="true" />
        <div className="rz-steam" aria-hidden="true" />

        <div className="rz-page-content">{children}</div>

        <div className="rz2-fx" aria-hidden="true">
          <div className="rz2-fx__vignette" />
          <div className="rz2-fx__grain" />
          <div className="rz2-fx__scan" />
          <div className="rz2-fx__chroma" />
          <div className="rz2-fx__flicker" />
        </div>
      </div>
    </div>
  );
}
