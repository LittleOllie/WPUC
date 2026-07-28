import { getStageConfig } from "../../config/puzzleBalance";
import type { PuzzleStageConfig } from "../../types/puzzle";

export class StageDirector {
  stage = 1;

  getConfig(): PuzzleStageConfig {
    return getStageConfig(this.stage) as PuzzleStageConfig;
  }

  advance(): number {
    this.stage += 1;
    return this.stage;
  }

  reset(): void {
    this.stage = 1;
  }
}
