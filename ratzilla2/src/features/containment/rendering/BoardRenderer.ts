import type { SimulationSnapshot, TutorialHighlights } from "../types";
import { corridorDisplayId } from "../config/balance";
import { HEX_SIZE, hexCorners } from "../utils/hexCoords";

export interface BoardTheme {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  danger: string;
  warning: string;
  safe: string;
  scanner: string;
}

export interface RenderHints {
  flashCorridorId: string | null;
  flashRoomId: string | null;
  tutorialHighlights: TutorialHighlights | null;
  reducedMotion: boolean;
}

export const DEFAULT_THEME: BoardTheme = {
  bg: "#030203",
  panel: "#0a0809",
  border: "#3a2020",
  text: "rgba(228, 220, 210, 0.92)",
  muted: "rgba(180, 170, 160, 0.55)",
  danger: "#c42028",
  warning: "#c89020",
  safe: "#3a8050",
  scanner: "#4080a0",
};

function pressureLevel(integrity: number, pressure: number): "safe" | "strained" | "critical" | "breaching" {
  if (integrity <= 15 || pressure > 80) return "breaching";
  if (integrity <= 35 || pressure > 55) return "critical";
  if (integrity <= 60 || pressure > 25) return "strained";
  return "safe";
}

const MAX_PARTICLES = 48;

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private theme: BoardTheme;
  private reducedMotion = false;
  private animPhase = 0;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, theme: BoardTheme = DEFAULT_THEME) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.theme = theme;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(
    snapshot: SimulationSnapshot,
    camera: { x: number; y: number; scale: number },
    hints: RenderHints,
  ): void {
    this.reducedMotion = hints.reducedMotion;
    const { width, height } = this.canvas;
    const w = width / this.dpr;
    const h = height / this.dpr;

    if (!this.reducedMotion) this.animPhase += 0.025;

    this.ctx.fillStyle = this.theme.bg;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
    this.ctx.scale(camera.scale, camera.scale);

    for (const corridor of snapshot.corridors) {
      if (corridor.state === "destroyed") continue;
      this.drawCorridor(corridor, snapshot, hints);
    }

    for (const room of snapshot.rooms) {
      if (room.state === "purged") continue;
      this.drawRoom(room, snapshot, hints);
    }

    this.ctx.restore();
  }

  private drawCorridor(
    corridor: SimulationSnapshot["corridors"][0],
    snapshot: SimulationSnapshot,
    hints: RenderHints,
  ): void {
    const roomA = snapshot.rooms.find((r) => r.id === corridor.roomA);
    const roomB = snapshot.rooms.find((r) => r.id === corridor.roomB);
    if (!roomA || !roomB) return;

    const isSelected = snapshot.selectedCorridorId === corridor.id;
    const isFlash =
      hints.flashCorridorId === corridor.id ||
      hints.tutorialHighlights?.corridorId === corridor.id;
    const isBreachFlash = snapshot.recentBreachCorridorId === corridor.id;
    const pw = pressureLevel(corridor.integrity, corridor.pressure);
    const mx = (roomA.displayPos.x + roomB.displayPos.x) / 2;
    const my = (roomA.displayPos.y + roomB.displayPos.y) / 2;
    const angle = Math.atan2(
      roomB.displayPos.y - roomA.displayPos.y,
      roomB.displayPos.x - roomA.displayPos.x,
    );

    this.ctx.beginPath();
    this.ctx.moveTo(roomA.displayPos.x, roomA.displayPos.y);
    this.ctx.lineTo(roomB.displayPos.x, roomB.displayPos.y);

    let lineColor = "#5a4540";
    let lineWidth = 2.5;

    if (corridor.state === "open") {
      lineColor = "#6a5550";
      lineWidth = 3;
    }
    if (corridor.state === "breached") {
      lineColor = this.theme.danger;
      lineWidth = 3;
    }
    if (isSelected) {
      lineColor = "#f0e8dc";
      lineWidth = 6;
    }
    if (isFlash && !this.reducedMotion) {
      lineColor = this.theme.warning;
      lineWidth = 5 + Math.sin(this.animPhase * 5) * 1.5;
    }
    if (isBreachFlash && !this.reducedMotion) {
      lineColor = this.theme.danger;
      lineWidth = 7;
    }

    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.setLineDash(corridor.state === "sealed" ? [5, 4] : []);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    if (corridor.state === "sealed") {
      this.drawBulkheadSymbol(mx, my, angle, pw, isSelected);
    }

    if (corridor.state === "sealed" || corridor.pressure > 5) {
      this.drawPressureBar(mx, my, angle, corridor, pw);
    }

    if (pw === "critical" || pw === "breaching") {
      this.drawWarningIcon(mx, my - 14, pw === "breaching");
    }
  }

  private drawBulkheadSymbol(
    x: number,
    y: number,
    angle: number,
    pw: ReturnType<typeof pressureLevel>,
    selected: boolean,
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);
    const w = 18;
    const h = 10;
    this.ctx.fillStyle = selected ? "#2a1818" : "#1a1010";
    this.ctx.strokeStyle =
      pw === "breaching"
        ? this.theme.danger
        : pw === "critical"
          ? this.theme.warning
          : this.theme.warning;
    this.ctx.lineWidth = pw === "breaching" && !this.reducedMotion ? 2.5 : 2;
    this.ctx.fillRect(-w / 2, -h / 2, w, h);
    this.ctx.strokeRect(-w / 2, -h / 2, w, h);
    this.ctx.beginPath();
    this.ctx.moveTo(-4, -3);
    this.ctx.lineTo(-4, 3);
    this.ctx.moveTo(0, -3);
    this.ctx.lineTo(0, 3);
    this.ctx.moveTo(4, -3);
    this.ctx.lineTo(4, 3);
    this.ctx.strokeStyle = this.theme.warning;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawPressureBar(
    x: number,
    y: number,
    angle: number,
    corridor: SimulationSnapshot["corridors"][0],
    pw: ReturnType<typeof pressureLevel>,
  ): void {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle + Math.PI / 2);
    const barW = 28;
    const barH = 5;
    const pressurePct = Math.min(1, corridor.pressure / 100);
    const integPct = corridor.integrity / corridor.maxIntegrity;

    this.ctx.fillStyle = "#0a0808";
    this.ctx.fillRect(-barW / 2, 10, barW, barH);
    this.ctx.fillStyle =
      pw === "breaching"
        ? this.theme.danger
        : pw === "critical"
          ? this.theme.warning
          : this.theme.scanner;
    this.ctx.fillRect(-barW / 2, 10, barW * integPct, barH);

    if (corridor.state === "sealed" && pressurePct > 0.05) {
      this.ctx.fillStyle = `rgba(200, 60, 40, ${0.35 + pressurePct * 0.5})`;
      const segs = 4;
      for (let i = 0; i < segs; i += 1) {
        if (pressurePct > (i + 1) / segs) {
          this.ctx.fillRect(-barW / 2 + i * (barW / segs), 16, barW / segs - 1, 3);
        }
      }
    }
    this.ctx.restore();
  }

  private drawWarningIcon(x: number, y: number, critical: boolean): void {
    this.ctx.font = "11px 'Share Tech Mono', monospace";
    this.ctx.textAlign = "center";
    this.ctx.fillStyle = critical ? this.theme.danger : this.theme.warning;
    if (critical && !this.reducedMotion && Math.sin(this.animPhase * 8) > 0) {
      this.ctx.fillText("!", x, y);
    } else if (!critical || this.reducedMotion) {
      this.ctx.fillText("!", x, y);
    }
  }

  private drawRoom(
    room: SimulationSnapshot["rooms"][0],
    snapshot: SimulationSnapshot,
    hints: RenderHints,
  ): void {
    const center = room.displayPos;
    const size = HEX_SIZE - 2;
    const corners = hexCorners(center, size);
    const isSelected = snapshot.selectedRoomId === room.id;
    const isTutorialPulse =
      hints.tutorialHighlights?.roomId === room.id && hints.tutorialHighlights.pulseRoom;
    const isSpreadFlash = snapshot.recentSpreadRoomId === room.id;
    const hidden =
      !room.visibleToScanner &&
      room.state !== "infected" &&
      room.state !== "critical" &&
      room.infectionStage === "incubation";

    this.ctx.beginPath();
    this.ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < corners.length; i += 1) {
      this.ctx.lineTo(corners[i]!.x, corners[i]!.y);
    }
    this.ctx.closePath();

    let fill = "#0c0a0b";
    let stroke = "#3a2828";
    let statusLabel: string | null = null;

    if (room.type === "containment_core") {
      fill = "#180808";
      stroke = "#8a2028";
    }

    switch (room.state) {
      case "stable":
      case "offline":
        fill = room.state === "offline" ? "#060606" : "#0c0a0b";
        break;
      case "exposed":
        stroke = this.theme.warning;
        statusLabel = "EXPOSED";
        if (!this.reducedMotion) {
          stroke = `rgba(200, 144, 32, ${0.65 + Math.sin(this.animPhase * 4) * 0.35})`;
        }
        break;
      case "incubating":
        fill = "#1a0e0e";
        stroke = this.theme.warning;
        statusLabel = hidden ? "???" : "INCUBATING";
        break;
      case "infected":
        fill = `rgba(140, 25, 25, ${0.35 + room.infectionAmount * 0.45})`;
        stroke = this.theme.danger;
        statusLabel = "INFECTED";
        break;
      case "critical":
        fill = `rgba(160, 20, 20, ${0.5 + room.infectionAmount * 0.4})`;
        stroke = this.theme.danger;
        statusLabel = "CRITICAL";
        break;
      case "lost":
        fill = "#050505";
        stroke = "#333";
        statusLabel = "LOST";
        break;
      case "protected":
        stroke = this.theme.safe;
        statusLabel = "PROTECTED";
        break;
      default:
        break;
    }

    if (isSpreadFlash && !this.reducedMotion) {
      fill = `rgba(200, 50, 40, 0.55)`;
    }

    this.ctx.fillStyle = fill;
    this.ctx.fill();

    let lineWidth = isSelected ? 3.5 : 1.8;
    if (room.state === "critical" && !this.reducedMotion) {
      lineWidth = 2.5 + Math.sin(this.animPhase * 7) * 0.8;
    }
    if (isTutorialPulse && !this.reducedMotion) {
      lineWidth = 3 + Math.sin(this.animPhase * 4) * 1;
      stroke = this.theme.warning;
    }

    if (isSelected) {
      this.ctx.strokeStyle = "#f0e8dc";
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
      this.ctx.strokeStyle = stroke;
    }

    this.ctx.strokeStyle = stroke;
    this.ctx.lineWidth = lineWidth;

    if (room.state === "exposed" && !this.reducedMotion) {
      this.ctx.setLineDash([4, 3]);
    } else if (room.state === "protected") {
      this.ctx.setLineDash([2, 2]);
    } else {
      this.ctx.setLineDash([]);
    }
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    if (room.state === "protected") {
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, size * 0.75, 0, Math.PI * 2);
      this.ctx.strokeStyle = this.theme.safe;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    if (room.infectionAmount > 0.08 && room.state !== "lost") {
      this.drawInfectionVisuals(room, snapshot);
    }

    this.ctx.fillStyle = hidden ? this.theme.muted : this.theme.text;
    this.ctx.font = "bold 9px 'Share Tech Mono', monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(hidden ? "???" : room.label, center.x, center.y - 6);

    if (statusLabel && !hidden) {
      this.ctx.font = "7px 'Share Tech Mono', monospace";
      this.ctx.fillStyle =
        room.state === "critical" || room.state === "infected"
          ? this.theme.danger
          : room.state === "exposed" || room.state === "incubating"
            ? this.theme.warning
            : this.theme.muted;
      this.ctx.fillText(statusLabel, center.x, center.y + 7);
    }

    if (room.type === "containment_core") {
      this.ctx.font = "7px 'Share Tech Mono', monospace";
      this.ctx.fillStyle = this.theme.danger;
      this.ctx.fillText(`CORE ${Math.round(snapshot.coreIntegrity)}%`, center.x, center.y + 16);
    }

    if (isSelected && room.infectionAmount > 0) {
      this.ctx.font = "7px 'Share Tech Mono', monospace";
      this.ctx.fillStyle = this.theme.warning;
      this.ctx.fillText(`${Math.round(room.infectionAmount * 100)}%`, center.x, center.y + 18);
    }
  }

  private drawInfectionVisuals(
    room: SimulationSnapshot["rooms"][0],
    snapshot: SimulationSnapshot,
  ): void {
    const center = room.displayPos;
    const n = Math.min(
      MAX_PARTICLES,
      Math.floor(room.chainDensity * 10 + room.infectionAmount * 8) + 2,
    );
    const spreadPulse = snapshot.recentSpreadRoomId === room.id;

    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2 + (this.reducedMotion ? 0 : this.animPhase * (1 + room.infectionAmount));
      const dist = 6 + (i % 4) * 5 + room.chainDensity * 8;
      const px = center.x + Math.cos(angle) * dist;
      const py = center.y + Math.sin(angle) * dist;
      const r = 1.5 + room.chainDensity * 2.5;

      this.ctx.fillStyle = `rgba(220, 45, 35, ${0.35 + room.infectionAmount * 0.55})`;
      this.ctx.beginPath();
      this.ctx.arc(px, py, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (!this.reducedMotion && room.infectionAmount > 0.25) {
      this.ctx.strokeStyle = `rgba(200, 40, 30, ${0.2 + room.chainDensity * 0.4})`;
      this.ctx.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        const a1 = this.animPhase + i * 2;
        const a2 = a1 + 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(
          center.x + Math.cos(a1) * 10,
          center.y + Math.sin(a1) * 10,
        );
        this.ctx.lineTo(
          center.x + Math.cos(a2) * (18 + room.chainDensity * 10),
          center.y + Math.sin(a2) * (18 + room.chainDensity * 10),
        );
        this.ctx.stroke();
      }
    }

    if (spreadPulse && !this.reducedMotion) {
      this.ctx.strokeStyle = `rgba(255, 80, 60, ${0.6 - (this.animPhase % 1) * 0.4})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, 12 + (this.animPhase % 1) * 20, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  hitTestRoom(
    snapshot: SimulationSnapshot,
    camera: { x: number; y: number; scale: number },
    canvasW: number,
    canvasH: number,
    sx: number,
    sy: number,
  ): string | null {
    const wx = (sx - canvasW / 2 - camera.x) / camera.scale;
    const wy = (sy - canvasH / 2 - camera.y) / camera.scale;

    for (const room of snapshot.rooms) {
      if (room.state === "purged") continue;
      const dx = wx - room.displayPos.x;
      const dy = wy - room.displayPos.y;
      if (Math.hypot(dx, dy) < HEX_SIZE * 0.85) return room.id;
    }
    return null;
  }

  hitTestCorridor(
    snapshot: SimulationSnapshot,
    camera: { x: number; y: number; scale: number },
    canvasW: number,
    canvasH: number,
    sx: number,
    sy: number,
    hitRadius = 22,
  ): string | null {
    const wx = (sx - canvasW / 2 - camera.x) / camera.scale;
    const wy = (sy - canvasH / 2 - camera.y) / camera.scale;

    let best: { id: string; dist: number } | null = null;

    for (const corridor of snapshot.corridors) {
      if (corridor.state === "destroyed") continue;
      const roomA = snapshot.rooms.find((r) => r.id === corridor.roomA);
      const roomB = snapshot.rooms.find((r) => r.id === corridor.roomB);
      if (!roomA || !roomB) continue;

      const dist = pointToSegmentDist(
        wx,
        wy,
        roomA.displayPos.x,
        roomA.displayPos.y,
        roomB.displayPos.x,
        roomB.displayPos.y,
      );

      if (dist < hitRadius && (!best || dist < best.dist)) {
        best = { id: corridor.id, dist };
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

export { corridorDisplayId };
