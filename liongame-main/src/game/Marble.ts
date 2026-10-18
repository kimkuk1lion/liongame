import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { MapObstacle } from "./maps";

const RADIUS = 25 / 2;
const FRICTION = 0.975;
const STOP_SPEED = 0.15;
const MAX_SPEED = 24;
const SPEED_PER_PULL_DISTANCE = 0.08;

export const SCORE_RULES = {
  holeEntry: 100,
  lionCapture: 30,
} as const;

export class Marble {
  private velocityX = 0;
  private velocityY = 0;

  constructor(
    readonly id: number,
    public x: number,
    public y: number,
    public lion: boolean,
    public hole: number,
    public alive: boolean,
    public inHole: boolean,
    public score = 0,
  ) {}

  launchFromPull(directionX: number, directionY: number, spreadRadians = 0) {
    const pullDistance = Math.hypot(directionX, directionY);
    if (pullDistance === 0) {
      return false;
    }

    const speed = Math.min(pullDistance * SPEED_PER_PULL_DISTANCE, MAX_SPEED);
    const intendedAngle = Math.atan2(directionY, directionX);
    const randomAngle = intendedAngle + (Math.random() * 2 - 1) * spreadRadians;
    this.velocityX = Math.cos(randomAngle) * speed;
    this.velocityY = Math.sin(randomAngle) * speed;
    return true;
  }

  step(obstacles: readonly MapObstacle[] = [], onBounce?: () => void) {
    if (!this.alive || this.inHole) {
      return false;
    }

    this.x += this.velocityX;
    this.y += this.velocityY;
    const hitWall = this.bounceAtWalls();
    const hitObstacle = this.bounceAtObstacles(obstacles);
    if (hitWall || hitObstacle) onBounce?.();

    this.velocityX *= FRICTION;
    this.velocityY *= FRICTION;

    if (Math.hypot(this.velocityX, this.velocityY) < STOP_SPEED) {
      this.velocityX = 0;
      this.velocityY = 0;
      return false;
    }
    return true;
  }

  private bounceAtWalls() {
    let bounced = false;
    const minX = RADIUS;
    const maxX = GAME_WIDTH - RADIUS;
    if (this.x < minX) {
      this.x = minX + (minX - this.x);
      this.velocityX = Math.abs(this.velocityX);
      bounced = true;
    } else if (this.x > maxX) {
      this.x = maxX - (this.x - maxX);
      this.velocityX = -Math.abs(this.velocityX);
      bounced = true;
    }

    const minY = RADIUS;
    const maxY = GAME_HEIGHT - RADIUS;
    if (this.y < minY) {
      this.y = minY + (minY - this.y);
      this.velocityY = Math.abs(this.velocityY);
      bounced = true;
    } else if (this.y > maxY) {
      this.y = maxY - (this.y - maxY);
      this.velocityY = -Math.abs(this.velocityY);
      bounced = true;
    }
    return bounced;
  }

  private bounceAtObstacles(obstacles: readonly MapObstacle[]) {
    let bounced = false;
    for (const obstacle of obstacles) {
      const overlapX = obstacle.width / 2 + RADIUS - Math.abs(this.x - obstacle.x);
      const overlapY = obstacle.height / 2 + RADIUS - Math.abs(this.y - obstacle.y);
      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }

      if (overlapX < overlapY) {
        const side = Math.sign(this.x - obstacle.x) || -Math.sign(this.velocityX) || 1;
        this.x = obstacle.x + side * (obstacle.width / 2 + RADIUS);
        if (this.velocityX * side < 0) {
          this.velocityX *= -1;
        }
      } else {
        const side = Math.sign(this.y - obstacle.y) || -Math.sign(this.velocityY) || 1;
        this.y = obstacle.y + side * (obstacle.height / 2 + RADIUS);
        if (this.velocityY * side < 0) {
          this.velocityY *= -1;
        }
      }
      bounced = true;
    }
    return bounced;
  }
}
