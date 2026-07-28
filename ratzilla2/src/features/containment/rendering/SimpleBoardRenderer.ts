import type { SimpleSnapshot } from "../types/simplified";
import { HEX_SIZE, hexCorners } from "../utils/hexCoords";
import { getFrontPosition } from "../engine/InfectionRouter";

export class SimpleBoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animPhase = 0;
  private dpr = 1;
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(
    snapshot: SimpleSnapshot,
    camera: { x: number; y: number; scale: number },
  ): void {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    if (!this.reducedMotion) this.animPhase += 0.03;

    this.ctx.fillStyle = "#030203";
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
    this.ctx.scale(camera.scale, camera.scale);

    const roomMap = new Map(snapshot.rooms.map((r) => [r.id, r]));

    for (const c of snapshot.corridors) {
      const a = roomMap.get(c.roomA);
      const b = roomMap.get(c.roomB);
      if (!a || !b) continue;

      const isReleased = snapshot.oldestReleasedId === c.id;
      const isHighlight = snapshot.highlightCorridorId === c.id;

      this.ctx.beginPath();
      this.ctx.moveTo(a.displayPos.x, a.displayPos.y);
      this.ctx.lineTo(b.displayPos.x, b.displayPos.y);

      if (c.state === "closed") {
        this.ctx.strokeStyle = "#c89020";
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([]);
        this.ctx.stroke();
        this.drawBarrier(
          (a.displayPos.x + b.displayPos.x) / 2,
          (a.displayPos.y + b.displayPos.y) / 2,
          Math.atan2(b.displayPos.y - a.displayPos.y, b.displayPos.x - a.displayPos.x),
          isReleased,
        );
      } else {
        this.ctx.strokeStyle = isHighlight ? "#f0e8dc" : "#4a3835";
        this.ctx.lineWidth = isHighlight ? 5 : 3;
        if (isHighlight && !this.reducedMotion) {
          this.ctx.lineWidth = 4 + Math.sin(this.animPhase * 5) * 1;
        }
        this.ctx.setLineDash([]);
        this.ctx.stroke();
      }
    }

    for (const front of snapshot.fronts) {
      const pos = getFrontPosition(front, roomMap);
      if (!pos) continue;
      this.drawInfectionPulse(pos.from, pos.to, pos.t);
    }

    for (const room of snapshot.rooms) {
      this.drawRoom(room);
    }

    this.ctx.restore();
  }

  private drawRoom(room: SimpleSnapshot["rooms"][0]): void {
    const center = room.displayPos;
    const corners = hexCorners(center, HEX_SIZE - 2);

    this.ctx.beginPath();
    this.ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < corners.length; i += 1) {
      this.ctx.lineTo(corners[i]!.x, corners[i]!.y);
    }
    this.ctx.closePath();

    if (room.isCore) {
      this.ctx.fillStyle = "#180808";
      this.ctx.strokeStyle = "#c42028";
      this.ctx.lineWidth = 3;
    } else if (room.state === "infected") {
      this.ctx.fillStyle = `rgba(180, 30, 30, ${0.45 + Math.sin(this.animPhase) * 0.05})`;
      this.ctx.strokeStyle = "#c42028";
      this.ctx.lineWidth = 2;
    } else if (room.state === "source") {
      this.ctx.fillStyle = "rgba(120, 20, 20, 0.35)";
      this.ctx.strokeStyle = "#c42028";
      this.ctx.lineWidth = 2;
      if (!this.reducedMotion) {
        this.ctx.lineWidth = 2 + Math.sin(this.animPhase * 4) * 0.5;
      }
    } else {
      this.ctx.fillStyle = "#0c0a0b";
      this.ctx.strokeStyle = "#3a2828";
      this.ctx.lineWidth = 1.5;
    }

    this.ctx.fill();
    this.ctx.stroke();

    if (room.isCore) {
      this.ctx.fillStyle = "#c42028";
      this.ctx.font = "bold 11px 'Share Tech Mono', monospace";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("CORE", center.x, center.y);
    }
  }

  private drawBarrier(x: number, y: number, angle: number, flash: boolean): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    this.ctx.fillStyle = flash ? "#3a2020" : "#1a1010";
    this.ctx.strokeStyle = flash ? "#f0e8dc" : "#c89020";
    this.ctx.lineWidth = flash ? 3 : 2;
    this.ctx.fillRect(-14, -8, 28, 16);
    this.ctx.strokeRect(-14, -8, 28, 16);
    this.ctx.beginPath();
    for (let i = -8; i <= 8; i += 4) {
      this.ctx.moveTo(i, -5);
      this.ctx.lineTo(i, 5);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawInfectionPulse(
    from: { x: number; y: number },
    to: { x: number; y: number },
    t: number,
  ): void {
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    const pulse = this.reducedMotion ? 0 : Math.sin(this.animPhase * 6) * 0.15;

    this.ctx.strokeStyle = `rgba(255, 60, 45, ${0.5 + pulse})`;
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.ctx.fillStyle = `rgba(255, 40, 35, ${0.85 + pulse})`;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 7 + pulse * 10, 0, Math.PI * 2);
    this.ctx.fill();

    if (!this.reducedMotion) {
      this.ctx.strokeStyle = `rgba(255, 100, 80, ${0.3 + (this.animPhase % 1) * 0.3})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 12 + (this.animPhase % 1) * 8, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  hitTestCorridor(
    snapshot: SimpleSnapshot,
    camera: { x: number; y: number; scale: number },
    canvasW: number,
    canvasH: number,
    sx: number,
    sy: number,
    hitRadius = 40,
  ): string | null {
    const scale = Math.max(camera.scale, 0.35);
    const worldHitRadius = hitRadius / scale;
    const wx = (sx - canvasW / 2 - camera.x) / camera.scale;
    const wy = (sy - canvasH / 2 - camera.y) / camera.scale;
    const roomMap = new Map(snapshot.rooms.map((r) => [r.id, r]));

    let best: { id: string; dist: number } | null = null;

    for (const c of snapshot.corridors) {
      const a = roomMap.get(c.roomA);
      const b = roomMap.get(c.roomB);
      if (!a || !b) continue;
      const dist = pointToSegmentDist(wx, wy, a.displayPos.x, a.displayPos.y, b.displayPos.x, b.displayPos.y);
      if (dist < worldHitRadius && (!best || dist < best.dist)) {
        best = { id: c.id, dist };
      }
    }
    return best?.id ?? null;
  }
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
