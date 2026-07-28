import type { PuzzleSnapshot } from "../types/puzzle";
import { HEX_SIZE, hexCorners } from "../utils/hexCoords";

export class PuzzleBoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animPhase = 0;
  private dpr = 1;
  private reducedMotion = false;
  private lastSpread: { fromId: string; toId: string; t: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  noteSpread(fromId: string, toId: string): void {
    this.lastSpread = { fromId, toId, t: 0 };
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
    snapshot: PuzzleSnapshot,
    camera: { x: number; y: number; scale: number },
    selectedCellId: string | null = null,
  ): void {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    if (!this.reducedMotion) this.animPhase += 0.03;
    if (this.lastSpread) {
      this.lastSpread.t += this.reducedMotion ? 1 : 0.08;
      if (this.lastSpread.t >= 1) this.lastSpread = null;
    }

    this.ctx.fillStyle = "#030203";
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.save();
    this.ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
    this.ctx.scale(camera.scale, camera.scale);

    const cellMap = new Map(snapshot.cells.map((c) => [c.id, c]));

    if (this.lastSpread) {
      const from = cellMap.get(this.lastSpread.fromId);
      const to = cellMap.get(this.lastSpread.toId);
      if (from && to) {
        const t = this.lastSpread.t;
        const x = from.displayPos.x + (to.displayPos.x - from.displayPos.x) * t;
        const y = from.displayPos.y + (to.displayPos.y - from.displayPos.y) * t;
        this.ctx.strokeStyle = `rgba(255, 40, 35, ${0.85 - t * 0.3})`;
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(from.displayPos.x, from.displayPos.y);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.fillStyle = `rgba(255, 60, 45, ${0.9})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 8, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    for (const cell of snapshot.cells) {
      this.drawCell(cell, snapshot.coreExposed, cell.id === selectedCellId);
    }

    this.ctx.restore();
  }

  private drawCell(
    cell: PuzzleSnapshot["cells"][0],
    coreExposed: boolean,
    selected: boolean,
  ): void {
    const center = cell.displayPos;
    const corners = hexCorners(center, HEX_SIZE - 3);
    const pulse = this.reducedMotion ? 0 : Math.sin(this.animPhase * 4) * 0.04;

    this.ctx.beginPath();
    this.ctx.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = 1; i < corners.length; i += 1) {
      this.ctx.lineTo(corners[i]!.x, corners[i]!.y);
    }
    this.ctx.closePath();

    if (cell.isCore) {
      this.ctx.fillStyle = coreExposed || cell.isInfected
        ? `rgba(120, 20, 20, ${0.75 + pulse})`
        : "#180808";
      this.ctx.strokeStyle = coreExposed ? "#ff4040" : "#c42028";
      this.ctx.lineWidth = coreExposed ? 4 + pulse * 20 : 3;
    } else if (cell.state === "hidden") {
      this.ctx.fillStyle = cell.highlight ? "#1a1214" : "#080607";
      this.ctx.strokeStyle = cell.highlight ? "#f0e8dc" : "#2a2020";
      this.ctx.lineWidth = cell.highlight ? 3 : 1.5;
    } else if (cell.state === "revealed") {
      this.ctx.fillStyle = cell.cluePulse ? "#1e1818" : "#121010";
      this.ctx.strokeStyle = cell.cluePulse ? "#c89020" : "#4a3835";
      this.ctx.lineWidth = cell.cluePulse ? 2.5 : 1.5;
    } else if (cell.state === "infected") {
      this.ctx.fillStyle = `rgba(160, 28, 28, ${0.55 + pulse})`;
      this.ctx.strokeStyle = "#ff4040";
      this.ctx.lineWidth = 2.5;
    } else if (cell.state === "locked") {
      this.ctx.fillStyle = "#0e0c0d";
      this.ctx.strokeStyle = "#c89020";
      this.ctx.lineWidth = 3;
    } else {
      this.ctx.fillStyle = "#0c0a0b";
      this.ctx.strokeStyle = "#3a2828";
      this.ctx.lineWidth = 1.5;
    }

    this.ctx.fill();
    this.ctx.stroke();

    if (selected) {
      this.ctx.strokeStyle = "#6ec8e8";
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
    }

    if (cell.state === "locked") {
      this.drawLockOverlay(center);
    }

    if (cell.state === "revealed" && cell.clue !== null) {
      this.ctx.fillStyle = cell.cluePulse ? "#f0e8dc" : "#d8d0c8";
      this.ctx.font = `bold ${cell.clue === 0 ? 14 : 18}px 'Share Tech Mono', monospace`;
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(String(cell.clue), center.x, center.y);
    }

    if (cell.isCore) {
      this.ctx.fillStyle = "#c42028";
      this.ctx.font = "bold 10px 'Share Tech Mono', monospace";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("CORE", center.x, center.y + 14);
    }

    if (cell.state === "infected") {
      this.ctx.fillStyle = `rgba(255, 80, 70, ${0.7 + pulse})`;
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, 10 + pulse * 8, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawLockOverlay(center: { x: number; y: number }): void {
    this.ctx.strokeStyle = "#c89020";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(center.x - 12, center.y - 10, 24, 20);
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y - 14, 6, Math.PI, 0);
    this.ctx.stroke();
  }

  hitTestCell(
    snapshot: PuzzleSnapshot,
    camera: { x: number; y: number; scale: number },
    canvasW: number,
    canvasH: number,
    sx: number,
    sy: number,
  ): string | null {
    const wx = (sx - canvasW / 2 - camera.x) / camera.scale;
    const wy = (sy - canvasH / 2 - camera.y) / camera.scale;
    const hitR = (HEX_SIZE - 2) * 0.92;

    let best: { id: string; dist: number } | null = null;
    for (const cell of snapshot.cells) {
      const dist = Math.hypot(wx - cell.displayPos.x, wy - cell.displayPos.y);
      if (dist < hitR && (!best || dist < best.dist)) {
        best = { id: cell.id, dist };
      }
    }
    return best?.id ?? null;
  }

  cellCanvasPosition(
    cellId: string,
    snapshot: PuzzleSnapshot,
    camera: { x: number; y: number; scale: number },
    canvasW: number,
    canvasH: number,
  ): { x: number; y: number } | null {
    const cell = snapshot.cells.find((c) => c.id === cellId);
    if (!cell) return null;
    return {
      x: canvasW / 2 + camera.x + cell.displayPos.x * camera.scale,
      y: canvasH / 2 + camera.y + cell.displayPos.y * camera.scale,
    };
  }
}
