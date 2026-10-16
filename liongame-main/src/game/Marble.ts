import { GAME_HEIGHT, GAME_WIDTH } from "../constants";

const RADIUS = 25 / 2;
const FRICTION = 0.975;
const STOP_SPEED = 0.15;
const MAX_SPEED = 24;
const SPEED_PER_PULL_DISTANCE = 0.08;

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
  ) {}

  launchFromPull(directionX: number, directionY: number) {
    const pullDistance = Math.hypot(directionX, directionY);
    if (pullDistance === 0) {
      return false;
    }

    const speed = Math.min(pullDistance * SPEED_PER_PULL_DISTANCE, MAX_SPEED);
    this.velocityX = (directionX / pullDistance) * speed;
    this.velocityY = (directionY / pullDistance) * speed;
    return true;
  }

  step() {
    if (!this.alive || this.inHole) {
      return false;
    }

    this.x += this.velocityX;
    this.y += this.velocityY;
    this.bounceAtWalls();

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
    const minX = RADIUS;
    const maxX = GAME_WIDTH - RADIUS;
    if (this.x < minX) {
      this.x = minX + (minX - this.x);
      this.velocityX = Math.abs(this.velocityX);
    } else if (this.x > maxX) {
      this.x = maxX - (this.x - maxX);
      this.velocityX = -Math.abs(this.velocityX);
    }

    const minY = RADIUS;
    const maxY = GAME_HEIGHT - RADIUS;
    if (this.y < minY) {
      this.y = minY + (minY - this.y);
      this.velocityY = Math.abs(this.velocityY);
    } else if (this.y > maxY) {
      this.y = maxY - (this.y - maxY);
      this.velocityY = -Math.abs(this.velocityY);
    }
  }
}
