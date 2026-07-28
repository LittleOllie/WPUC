export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

export class CameraController {
  state: CameraState = { x: 0, y: 0, scale: 1 };
  private minScale = 0.45;
  private maxScale = 2.2;
  private dragging = false;
  private pointerActive = false;
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  private startX = 0;
  private startY = 0;
  private dragThresholdPx = 10;

  recenter(): void {
    this.state = { x: 0, y: 0, scale: 1 };
  }

  zoom(delta: number, centerX: number, centerY: number, canvasW: number, canvasH: number): void {
    const prev = this.state.scale;
    this.state.scale = Math.max(
      this.minScale,
      Math.min(this.maxScale, this.state.scale * (delta > 0 ? 1.1 : 0.9)),
    );
    const factor = this.state.scale / prev - 1;
    this.state.x -= (centerX - canvasW / 2) * factor;
    this.state.y -= (centerY - canvasH / 2) * factor;
  }

  setScale(scale: number): void {
    this.state.scale = Math.max(this.minScale, Math.min(this.maxScale, scale));
  }

  /** @deprecated use beginPointer — kept for legacy ContainmentGame */
  startDrag(x: number, y: number): void {
    this.beginPointer(x, y);
  }

  /** @deprecated use movePointer */
  drag(x: number, y: number): void {
    this.movePointer(x, y);
  }

  /** @deprecated use endPointer */
  endDrag(): void {
    this.endPointer();
  }

  beginPointer(x: number, y: number): void {
    this.pointerActive = true;
    this.dragging = false;
    this.moved = false;
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.lastY = y;
  }

  movePointer(x: number, y: number): void {
    if (!this.pointerActive) return;

    if (!this.moved) {
      const dx = x - this.startX;
      const dy = y - this.startY;
      if (dx * dx + dy * dy >= this.dragThresholdPx * this.dragThresholdPx) {
        this.moved = true;
        this.dragging = true;
      }
    }

    if (!this.dragging) return;

    this.state.x += x - this.lastX;
    this.state.y += y - this.lastY;
    this.lastX = x;
    this.lastY = y;
  }

  /** Returns true when the gesture was a tap (not a pan). */
  endPointer(): boolean {
    const wasTap = this.pointerActive && !this.moved;
    this.pointerActive = false;
    this.dragging = false;
    this.moved = false;
    return wasTap;
  }

  isDragging(): boolean {
    return this.dragging;
  }
}
