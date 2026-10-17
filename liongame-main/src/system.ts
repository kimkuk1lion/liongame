import { Marble, SCORE_RULES } from "./game/Marble";
import { GAME_MAPS, type GameMap, type Hole } from "./game/maps";

type RenderArgs = {
  turn: number;
  marbles: Marble[];
  holes: Hole[];
  map: GameMap;
  mapIndex: number;
  state: State;
};

type SavedMarble = Pick<
  Marble,
  "id" | "x" | "y" | "lion" | "hole" | "alive" | "inHole" | "score"
>;

type SavedProgress = {
  version: 1;
  mapIndex: number;
  turn: number;
  hasStarted: boolean;
  marbles: SavedMarble[];
};

export type SystemOptions = {
  initialMapIndex?: number;
  resumeSavedGame?: boolean;
};

type RenderFunction = (args: RenderArgs) => void;
type State = "wait_move" | "moving";

const MARBLE_RADIUS = 25 / 2;
const HOLE_RADIUS = 35 / 2;
const PHYSICS_STEP_MS = 1000 / 60;
const DRAG_PICKUP_RADIUS = 30;
const MIN_PULL_DISTANCE = 5;
const SAVE_KEY = "liongame.progress.v1";

export class System {
  private turn: number = 0;
  private marbles: Marble[];
  private mapIndex = 0;
  private hasStarted = false;
  private state: State = "wait_move";
  private physicsTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private marbleCount: number,
    private renderFunction: RenderFunction,
    options: SystemOptions = {},
  ) {
    const initialMapIndex = options.initialMapIndex ?? 0;
    if (Number.isInteger(initialMapIndex) && initialMapIndex >= 0 && initialMapIndex < GAME_MAPS.length) {
      this.mapIndex = initialMapIndex;
    }
    this.marbles = [];
    for (let i = 0; i < marbleCount; i += 1) {
      this.marbles.push(new Marble(i, 100 + i * 130, 1200, false, 0, true, true));
    }
    if (options.resumeSavedGame) {
      this.restoreProgress();
    }
  }

  getDraggableMarblePosition(x: number, y: number) {
    if (this.state !== "wait_move") {
      return null;
    }

    const marble = this.marbles[this.turn];
    if (!marble.alive || Math.hypot(x - marble.x, y - marble.y) > DRAG_PICKUP_RADIUS) {
      return null;
    }
    return { x: marble.x, y: marble.y };
  }

  selectMap(mapIndex: number) {
    if (this.hasStarted || this.state !== "wait_move") {
      return false;
    }
    if (mapIndex < 0 || mapIndex >= GAME_MAPS.length) {
      return false;
    }
    this.mapIndex = mapIndex;
    this.saveProgress();
    this.render();
    return true;
  }

  launchMarble(directionX: number, directionY: number) {
    if (this.state !== "wait_move") {
      return false;
    }
    if (Math.hypot(directionX, directionY) < MIN_PULL_DISTANCE) {
      return false;
    }

    const marble = this.marbles[this.turn];
    if (!marble.alive || !marble.launchFromPull(directionX, directionY)) {
      return false;
    }

    this.state = "moving";
    this.hasStarted = true;
    marble.inHole = false;
    this.saveProgress();
    const f = () => {
      this.physicsTimer = null;
      if (this.stopped) {
        return;
      }
      const isMoving = marble.step(this.currentMap.obstacles);
      if (this.checkCollision(marble)) {
        this.state = "wait_move";
        this.nextTurn();
        this.saveProgress();
        this.render();
        return;
      }

      if (isMoving) {
        this.render();
        this.physicsTimer = setTimeout(f, PHYSICS_STEP_MS);
        return;
      }
      this.state = "wait_move";
      this.nextTurn();
      this.saveProgress();
      this.render();
    };
    f();
    return true;
  }

  stop() {
    this.stopped = true;
    if (this.physicsTimer !== null) {
      clearTimeout(this.physicsTimer);
      this.physicsTimer = null;
    }
    this.state = "wait_move";
    this.saveProgress();
  }

  private nextTurn() {
    this.turn += 1;
    if (this.turn === this.marbleCount) {
      this.turn = 0;
    }
    const turnMarble = this.marbles[this.turn];
    if (!turnMarble.alive) {
      this.nextTurn();
    }
  }

  private checkCollision(marble: Marble): boolean {
    if (!marble.lion) {
      const targetHole = this.currentMap.holes[marble.hole];

      if (collision(targetHole.x, targetHole.y, marble.x, marble.y, HOLE_RADIUS, MARBLE_RADIUS)) {
        this.nextHole(marble, true);
        return true;
      }
    }

    for (const otherMarble of this.marbles) {
      if (otherMarble.id === marble.id || otherMarble.inHole || !otherMarble.alive) {
        continue;
      }
      if (
        collision(otherMarble.x, otherMarble.y, marble.x, marble.y, MARBLE_RADIUS, MARBLE_RADIUS)
      ) {
        if (marble.lion) {
          this.captureMarble(marble, otherMarble);
          return true;
        }

        if (otherMarble.lion) {
          this.captureMarble(otherMarble, marble);
          return true;
        }

        this.nextHole(marble);

        return true;
      }
    }
    return false;
  }

  private captureMarble(lion: Marble, victim: Marble) {
    victim.alive = false;
    lion.score += SCORE_RULES.lionCapture;
  }

  private restoreProgress() {
    const saved = readSavedProgress(this.marbleCount);
    if (!saved) {
      return;
    }

    this.mapIndex = saved.mapIndex;
    this.turn = saved.turn;
    this.hasStarted = saved.hasStarted;
    saved.marbles.forEach((savedMarble, i) => {
      Object.assign(this.marbles[i], savedMarble);
    });
  }

  private saveProgress() {
    try {
      const saved: SavedProgress = {
        version: 1,
        mapIndex: this.mapIndex,
        turn: this.turn,
        hasStarted: this.hasStarted,
        marbles: this.marbles.map(({ id, x, y, lion, hole, alive, inHole, score }) => ({
          id,
          x,
          y,
          lion,
          hole,
          alive,
          inHole,
          score,
        })),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch {
      // Keep the current session playable when browser storage is unavailable.
    }
  }

  private nextHole(marble: Marble, awardHolePoints = false) {
    const targetHole = this.currentMap.holes[marble.hole];
    if (awardHolePoints) {
      marble.score += SCORE_RULES.holeEntry;
    }
    marble.inHole = true;
    marble.x = targetHole.x;
    marble.y = targetHole.y;
    marble.hole += 1;
    if (marble.hole === this.currentMap.holes.length) {
      marble.lion = true;
    }
  }

  private get currentMap() {
    return GAME_MAPS[this.mapIndex];
  }

  render() {
    this.renderFunction({
      turn: this.turn,
      holes: this.currentMap.holes,
      marbles: this.marbles,
      map: this.currentMap,
      mapIndex: this.mapIndex,
      state: this.state,
    });
  }
}

export function hasSavedProgress(marbleCount: number) {
  return readSavedProgress(marbleCount)?.hasStarted ?? false;
}

export function clearSavedProgress() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Keep the game usable when browser storage is unavailable.
  }
}

function readSavedProgress(marbleCount: number) {
  try {
    const serialized = window.localStorage.getItem(SAVE_KEY);
    if (!serialized) {
      return null;
    }

    const saved: unknown = JSON.parse(serialized);
    if (!isSavedProgress(saved)) {
      return null;
    }
    if (
      saved.marbles.length !== marbleCount ||
      saved.mapIndex < 0 ||
      saved.mapIndex >= GAME_MAPS.length ||
      saved.turn < 0 ||
      saved.turn >= marbleCount
    ) {
      return null;
    }
    if (
      saved.marbles.some(
        (marble) => marble.hole < 0 || marble.hole > GAME_MAPS[saved.mapIndex].holes.length,
      )
    ) {
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function isSavedProgress(value: unknown): value is SavedProgress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const saved = value as Partial<SavedProgress>;
  return (
    saved.version === 1 &&
    Number.isInteger(saved.mapIndex) &&
    Number.isInteger(saved.turn) &&
    typeof saved.hasStarted === "boolean" &&
    Array.isArray(saved.marbles) &&
    saved.marbles.every((marble, index) => {
      if (!marble || typeof marble !== "object") {
        return false;
      }
      const item = marble as Partial<SavedMarble>;
      return (
        item.id === index &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y) &&
        typeof item.lion === "boolean" &&
        Number.isInteger(item.hole) &&
        typeof item.alive === "boolean" &&
        typeof item.inHole === "boolean" &&
        Number.isInteger(item.score) &&
        (item.score ?? -1) >= 0
      );
    })
  );
}

function collision(x1: number, y1: number, x2: number, y2: number, d1: number, d2: number) {
  const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  return distance <= d1 + d2;
}

