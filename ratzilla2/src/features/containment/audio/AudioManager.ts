/** Minimal Web Audio hooks — no autoplay before user gesture */

export type SfxId =
  | "confirm"
  | "door_seal"
  | "door_open"
  | "door_stress"
  | "breach"
  | "serum"
  | "reinforce"
  | "lockdown"
  | "mutation"
  | "purge"
  | "game_over";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = true;
  private unlocked = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (this.unlocked) return;
    try {
      this.ctx = new AudioContext();
      this.unlocked = true;
    } catch {
      /* unsupported */
    }
  }

  play(id: SfxId, intensity = 1): void {
    if (this.muted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const freqs: Record<SfxId, number> = {
      confirm: 440,
      door_seal: 120,
      door_open: 180,
      door_stress: 90,
      breach: 60,
      serum: 520,
      reinforce: 280,
      lockdown: 100,
      mutation: 70,
      purge: 45,
      game_over: 55,
    };

    osc.type = id === "serum" ? "sine" : "square";
    osc.frequency.value = freqs[id] * intensity;
    gain.gain.value = 0.04 * intensity;
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + 0.15,
    );

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.unlocked = false;
  }
}
