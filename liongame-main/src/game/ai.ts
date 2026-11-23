import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { Marble, SCORE_RULES } from "./Marble";
import { type GameMap, type MapObstacle } from "./maps";

export type AiDifficulty = "easy" | "normal" | "hard";

export type AiShot = {
  directionX: number;
  directionY: number;
  spreadRadians: number;
  randomUnit: number;
};

const MARBLE_RADIUS = 25 / 2;
const HOLE_RADIUS = 35 / 2;

export function chooseAiShot(
  marbles: readonly Marble[],
  turn: number,
  map: GameMap,
  obstaclesEnabled: boolean,
  difficulty: AiDifficulty,
): AiShot {
  const settings = {
    easy: {
      directions: 8, powers: [85, 170, 255], spread: 28 * Math.PI / 180,
      randomTop: 0.65, powerVariation: 0.4,
    },
    normal: {
      directions: 16, powers: [85, 155, 245], spread: 17 * Math.PI / 180,
      randomTop: 0.3, powerVariation: 0.2,
    },
    hard: {
      directions: 24, powers: [75, 135, 205, 290], spread: 8 * Math.PI / 180,
      randomTop: 0.08, powerVariation: 0.1,
    },
  }[difficulty];
  const options: Array<AiShot & { value: number; hasBounce: boolean; hasWallBounce: boolean }> = [];
  const obstacles = obstaclesEnabled ? map.obstacles : [];
  const marble = marbles[turn];
  const target = marble && !marble.lion ? map.holes[marble.hole] : undefined;
  const directPathClear = Boolean(target && !obstacles.some((obstacle) =>
    segmentIntersectsObstacle(marble.x, marble.y, target.x, target.y, obstacle),
  ));
  const makeShot = (angle: number, basePower: number): AiShot => {
    const variedPower = basePower * (1 + (Math.random() * 2 - 1) * settings.powerVariation);
    const power = Math.max(50, Math.min(300, variedPower));
    return {
      directionX: Math.cos(angle) * power,
      directionY: Math.sin(angle) * power,
      spreadRadians: settings.spread,
      randomUnit: Math.random(),
    };
  };
  const directPowers: number[] = [];

  if (target && directPathClear) {
    const distance = Math.hypot(target.x - marble.x, target.y - marble.y);
    const expectedPull = Math.max(55, Math.min(300, distance / 3.2));
    directPowers.push(expectedPull * 0.88, expectedPull, expectedPull * 1.12);
    const directAngle = Math.atan2(target.y - marble.y, target.x - marble.x);
    directPowers.forEach((power) => {
      const shot = makeShot(directAngle, power);
      options.push({ ...shot, ...simulateShotValue(marbles, turn, map, obstacles, shot, directPathClear) });
    });
  }

  if (target && !directPathClear) {
    const radius = MARBLE_RADIUS;
    const mirroredTargets = [
      { x: radius * 2 - target.x, y: target.y },
      { x: 2 * (GAME_WIDTH - radius) - target.x, y: target.y },
      { x: target.x, y: radius * 2 - target.y },
      { x: target.x, y: 2 * (GAME_HEIGHT - radius) - target.y },
    ];
    mirroredTargets.forEach((mirror) => {
      const dx = mirror.x - marble.x;
      const dy = mirror.y - marble.y;
      const angle = Math.atan2(dy, dx);
      const expectedPull = Math.max(55, Math.min(300, Math.hypot(dx, dy) / 3.2));
      [expectedPull * 0.84, expectedPull, expectedPull * 1.16].forEach((power) => {
        const shot = makeShot(angle, power);
        options.push({ ...shot, ...simulateShotValue(marbles, turn, map, obstacles, shot, false) });
      });
    });
  }

  for (let index = 0; index < settings.directions; index += 1) {
    const angle = (Math.PI * 2 * index) / settings.directions;
    for (const pullDistance of settings.powers) {
      const shot = makeShot(angle, pullDistance);
      options.push({ ...shot, ...simulateShotValue(marbles, turn, map, obstacles, shot, directPathClear) });
    }
  }

  options.sort((a, b) => b.value - a.value);
  const directOptions = directPathClear
    ? options.filter((option) => !option.hasBounce)
    : options;
  const candidates = directOptions.length > 0 ? directOptions : options;
  const pickCount = Math.max(1, Math.ceil(candidates.length * settings.randomTop));
  const choice = candidates[Math.floor(Math.random() * pickCount)];
  return {
    directionX: choice.directionX,
    directionY: choice.directionY,
    spreadRadians: choice.spreadRadians,
    randomUnit: choice.randomUnit,
  };
}

function simulateShotValue(
  originals: readonly Marble[],
  turn: number,
  map: GameMap,
  obstacles: GameMap["obstacles"],
  shot: AiShot,
  directPathClear: boolean,
) {
  const marbles = originals.map((marble) => new Marble(
    marble.id, marble.x, marble.y, marble.lion, marble.hole, marble.alive, marble.inHole, marble.score,
  ));
  const moving = marbles[turn];
  const scoreBefore = moving.score;
  const holeBefore = moving.hole;
  const aliveBefore = marbles.map((marble) => marble.alive);
  let hasBounce = false;
  let hasWallBounce = false;
  let reachedTargetHole = false;
  moving.inHole = false;
  moving.launchFromPull(shot.directionX, shot.directionY, shot.spreadRadians, shot.randomUnit);

  for (let step = 0; step < 1800; step += 1) {
    const stillMoving = moving.step(obstacles, (bounceType) => {
      hasBounce = true;
      if (bounceType === "wall") hasWallBounce = true;
    });
    if (!moving.lion) {
      const target = map.holes[moving.hole];
      if (target && overlaps(target.x, target.y, moving.x, moving.y, HOLE_RADIUS, MARBLE_RADIUS)) {
        moveToNextHole(moving, map);
        reachedTargetHole = true;
        break;
      }
    }

    let collided = false;
    for (const other of marbles) {
      if (other.id === moving.id || other.inHole || !other.alive) continue;
      if (!overlaps(other.x, other.y, moving.x, moving.y, MARBLE_RADIUS, MARBLE_RADIUS)) continue;
      if (moving.lion) {
        other.alive = false;
        moving.score += SCORE_RULES.lionCapture;
      } else if (other.lion) {
        moving.alive = false;
        other.score += SCORE_RULES.lionCapture;
      } else {
        moveToNextHole(moving, map);
      }
      collided = true;
      break;
    }
    if (collided || !stillMoving) break;
  }

  let value = (moving.score - scoreBefore) * 5 + (moving.hole - holeBefore) * 180;
  if (!moving.alive) value -= 1200;
  marbles.forEach((marble, index) => {
    if (index !== turn && aliveBefore[index] && !marble.alive) value += 500;
  });
  if (moving.alive && !moving.lion) {
    const target = map.holes[holeBefore];
    if (target && moving.hole === holeBefore) {
      const original = originals[turn];
      const startDistance = Math.hypot(target.x - original.x, target.y - original.y);
      const endDistance = Math.hypot(target.x - moving.x, target.y - moving.y);
      value += (startDistance - endDistance) * 0.55;
    }
  }
  if (reachedTargetHole && directPathClear && !hasWallBounce) value += 1800;
  if (reachedTargetHole && !directPathClear && hasWallBounce) value += 1300;
  if (reachedTargetHole && directPathClear && hasWallBounce) value -= 700;
  return { value, hasBounce, hasWallBounce };
}

function moveToNextHole(marble: Marble, map: GameMap) {
  const hole = map.holes[marble.hole];
  if (!hole) return;
  marble.inHole = true;
  marble.x = hole.x;
  marble.y = hole.y;
  marble.hole += 1;
  if (marble.hole === map.holes.length) marble.lion = true;
}

function overlaps(x1: number, y1: number, x2: number, y2: number, radius1: number, radius2: number) {
  return Math.hypot(x1 - x2, y1 - y2) <= radius1 + radius2;
}

function segmentIntersectsObstacle(x1: number, y1: number, x2: number, y2: number, obstacle: MapObstacle) {
  const minX = obstacle.x - obstacle.width / 2 - MARBLE_RADIUS;
  const maxX = obstacle.x + obstacle.width / 2 + MARBLE_RADIUS;
  const minY = obstacle.y - obstacle.height / 2 - MARBLE_RADIUS;
  const maxY = obstacle.y + obstacle.height / 2 + MARBLE_RADIUS;
  let near = 0;
  let far = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  for (const [origin, delta, min, max] of [
    [x1, dx, minX, maxX],
    [y1, dy, minY, maxY],
  ]) {
    if (Math.abs(delta) < 0.0001) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return false;
  }
  return far > 0 && near < 1;
}
