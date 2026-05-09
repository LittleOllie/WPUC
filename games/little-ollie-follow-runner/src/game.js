import { nowSec, clamp, prefersReducedMotion } from "./utils.js";
import { Renderer } from "./renderer.js";
import { Character } from "./character.js";
import { AudioBus } from "./audio.js";
import { Obstacle, obstaclePrompt } from "./obstacles.js";

const TRAVEL_TIME = 1.5;
const PROMPT_LEAD = 0.8;
const WORLD_SPEED = 1 / TRAVEL_TIME; // depth units per second (unifies all forward motion)

function createScriptedSchedule(timeline) {
  const events = timeline.events || [];
  return events.map((ev, idx) => {
    const impactTime = ev.time;
    const spawnTime = impactTime - TRAVEL_TIME;
    const cueTime = impactTime - PROMPT_LEAD;
    return {
      id: `ev_${idx}`,
      impactTime,
      spawnTime,
      cueTime,
      action: ev.action,
      obstacle: ev.obstacle,
      lane: ev.lane,
    };
  });
}

export function createRunnerGame({
  canvas,
  timeline,
  speed = 1,
  reducedMotion = false,
  onPrompt,
  onPromptHide,
  onDistance,
  onCountdown,
  onFinish,
}) {
  const renderer = new Renderer(canvas);
  const character = new Character();
  const audio = new AudioBus();

  const schedule = createScriptedSchedule(timeline);
  const obstacles = [];

  let raf = 0;
  let running = false;
  let paused = false;
  let muteWanted = false;

  let runStartWall = 0;
  let simTime = 0;
  let lastFrameWall = 0;

  let nextSpawnIdx = 0;
  let nextCueIdx = 0;
  let nextImpactIdx = 0;
  let promptActiveForId = null;

  let finished = false;
  let distanceMeters = 0;

  const effectiveReducedMotion = !!reducedMotion || prefersReducedMotion();

  function setCountdown(text, visible) {
    if (typeof onCountdown === "function") onCountdown(text, visible);
  }

  function showPromptFor(ev) {
    promptActiveForId = ev.id;
    if (typeof onPrompt === "function") onPrompt(obstaclePrompt(ev.action));
    audio.playPromptCue(ev.action);
  }

  function hidePrompt() {
    promptActiveForId = null;
    if (typeof onPromptHide === "function") onPromptHide();
  }

  function updateDistance(dt) {
    const metersPerSec = 4.6 * clamp(speed, 0.85, 1.25);
    distanceMeters += metersPerSec * dt;
    if (typeof onDistance === "function") onDistance(distanceMeters);
  }

  function spawnObstacle(ev) {
    const o = new Obstacle({
      id: ev.id,
      type: ev.obstacle,
      action: ev.action,
      lane: ev.lane,
      spawnTime: ev.spawnTime,
      impactTime: ev.impactTime,
      travelTime: TRAVEL_TIME,
    });
    obstacles.push(o);
    audio.playWhoosh();
  }

  function impact(ev) {
    audio.playImpact(ev.action);
    audio.playSuccess();
  }

  function updateTimeline(t) {
    while (nextSpawnIdx < schedule.length && t >= schedule[nextSpawnIdx].spawnTime) {
      spawnObstacle(schedule[nextSpawnIdx]);
      nextSpawnIdx++;
    }

    while (nextCueIdx < schedule.length && t >= schedule[nextCueIdx].cueTime) {
      const ev = schedule[nextCueIdx];
      character.trigger(ev.action, t);
      showPromptFor(ev);
      nextCueIdx++;
    }

    while (nextImpactIdx < schedule.length && t >= schedule[nextImpactIdx].impactTime) {
      const ev = schedule[nextImpactIdx];
      if (promptActiveForId === ev.id) hidePrompt();
      impact(ev);
      nextImpactIdx++;
    }

    // Clear prompt if we somehow ran past it (tab switch).
    if (promptActiveForId) {
      const idx = schedule.findIndex((x) => x.id === promptActiveForId);
      if (idx >= 0 && t > schedule[idx].impactTime + 0.08) hidePrompt();
    }
  }

  function pruneObstacles(t) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (t > obstacles[i].aliveUntil) obstacles.splice(i, 1);
    }
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    renderer.resize();
    const wall = nowSec();
    const dtWall = clamp(wall - lastFrameWall, 0, 0.05);
    lastFrameWall = wall;

    if (paused) {
      renderer.render({
        t: simTime,
        speed,
        worldSpeed: WORLD_SPEED * speed,
        reducedMotion: effectiveReducedMotion,
        characterSample: character.sample(simTime),
        obstacles,
        distanceMeters,
      });
      return;
    }

    simTime += dtWall;
    updateDistance(dtWall);
    audio.updateFootsteps(simTime, speed);

    updateTimeline(simTime);
    pruneObstacles(simTime);

    renderer.render({
      t: simTime,
      speed,
      worldSpeed: WORLD_SPEED * speed,
      reducedMotion: effectiveReducedMotion,
      characterSample: character.sample(simTime),
      obstacles,
      distanceMeters,
    });

    const endAt = timeline.endAt ?? (schedule.length ? schedule[schedule.length - 1].impactTime + 3 : 20);
    if (!finished && simTime >= endAt) {
      finished = true;
      hidePrompt();
      onFinish?.({ message: "You made it! Perfect moves the whole way." });
    }
  }

  async function start() {
    running = true;
    finished = false;
    paused = false;
    distanceMeters = 0;
    nextSpawnIdx = 0;
    nextCueIdx = 0;
    nextImpactIdx = 0;
    promptActiveForId = null;
    obstacles.length = 0;

    await audio.init();
    audio.setMuted(muteWanted);
    audio.resume();

    // Countdown
    setCountdown(3, true);
    audio.playCountdownTick(3);
    await wait(0.85);
    setCountdown(2, true);
    audio.playCountdownTick(2);
    await wait(0.85);
    setCountdown(1, true);
    audio.playCountdownTick(1);
    await wait(0.85);
    setCountdown("GO!", true);
    audio.playPromptCue("punch");
    await wait(0.55);
    setCountdown("", false);

    runStartWall = nowSec();
    lastFrameWall = runStartWall;
    simTime = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    audio.stopAll();
    hidePrompt();
  }

  function pause() {
    paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    lastFrameWall = nowSec();
    audio.resume();
  }

  function toggleMute() {
    muteWanted = audio.toggleMute();
    return muteWanted;
  }

  return { start, stop, pause, resume, toggleMute };
}

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

