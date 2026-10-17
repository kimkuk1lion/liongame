import { Marble } from "./game/Marble";
import { GAME_MAPS, type GameMap, type Hole } from "./game/maps";

type RenderArgs = {
  turn: number;
  marbles: Marble[];
  holes: Hole[];
  map: GameMap;
  mapIndex: number;
  state: State;
};

type RenderFunction = (args: RenderArgs) => void;
type State = "wait_move" | "moving";

const MARBLE_RADIUS = 25 / 2;
const HOLE_RADIUS = 35 / 2;
const PHYSICS_STEP_MS = 1000 / 60;
const DRAG_PICKUP_RADIUS = 30;
const MIN_PULL_DISTANCE = 5;

export class System {
  private turn: number = 0;
  private marbles: Marble[];
  private mapIndex = 0;
  private hasStarted = false;
  private state: State = "wait_move";

  constructor(private marbleCount: number, private renderFunction: RenderFunction) {
    this.marbles = [];
    for (let i = 0; i < marbleCount; i += 1) {
      this.marbles.push(new Marble(i, 100 + i * 130, 1200, false, 0, true, true));
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
    const f = () => {
      const isMoving = marble.step(this.currentMap.obstacles);
      if (this.checkCollision(marble)) {
        this.state = "wait_move";
        this.nextTurn();
        this.render();
        return;
      }

      if (isMoving) {
        this.render();
        setTimeout(f, PHYSICS_STEP_MS);
        return;
      }
      this.state = "wait_move";
      this.nextTurn();
      this.render();
    };
    f();
    return true;
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
        this.nextHole(marble);
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
          otherMarble.alive = false;
          return true;
        }

        if (otherMarble.lion) {
          marble.alive = false;
          return true;
        }

        this.nextHole(marble);

        return true;
      }
    }
    return false;
  }

  private nextHole(marble: Marble) {
    const targetHole = this.currentMap.holes[marble.hole];
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

function collision(x1: number, y1: number, x2: number, y2: number, d1: number, d2: number) {
  const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
  return distance <= d1 + d2;
}

