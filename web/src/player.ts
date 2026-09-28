import type { Input } from './input';
import type { Sprites } from './sprites';
import type { World } from './world';

const GRAVITY = 980;
const RUN_SPEED = 125;
const ACCEL = 1400;
const FRICTION = 1600;
const JUMP_VELOCITY = 340;
const MAX_FALL = 420;
const COYOTE = 0.08;
const JUMP_BUFFER = 0.1;

export const SWING_TIME = 0.3;
const SWING_COOLDOWN = 0.06;
// Swing arc, in radians measured clockwise from straight up (for a right-facing player).
const SWING_FROM = (-110 * Math.PI) / 180;
const SWING_TO = (135 * Math.PI) / 180;
export const SWORD_REACH = 48;
// Pivot is the middle of the grip in the sword sprite.
const SWORD_PIVOT_X = 5;
const SWORD_PIVOT_Y = 49;

export class Player {
  x: number;
  y: number;
  readonly w = 10;
  readonly h = 20;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  onGround = false;
  maxHearts = 10;
  hearts = 10;
  invuln = 0;
  private coyote = 0;
  private jumpBuffer = 0;
  private animT = 0;
  // Time since the current swing started; negative when not swinging.
  swingT = -1;
  swingId = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get cx(): number {
    return this.x + this.w / 2;
  }
  get cy(): number {
    return this.y + this.h / 2;
  }
  get alive(): boolean {
    return this.hearts > 0;
  }
  get swinging(): boolean {
    return this.swingT >= 0 && this.swingT < SWING_TIME;
  }

  // World-space pivot of the sword (the player's hand).
  get handX(): number {
    return this.cx + this.facing * 2;
  }
  get handY(): number {
    return this.y + 11;
  }

  swingAngle(): number {
    const p = Math.min(1, Math.max(0, this.swingT / SWING_TIME));
    const eased = 1 - (1 - p) * (1 - p);
    return SWING_FROM + (SWING_TO - SWING_FROM) * eased;
  }

  // Unit vector along the blade in world space.
  bladeDir(): [number, number] {
    const a = this.swingAngle();
    return [Math.sin(a) * this.facing, -Math.cos(a)];
  }

  update(dt: number, input: Input, world: World, aimWorldX: number | null, canAct: boolean): void {
    this.animT += dt;
    this.invuln = Math.max(0, this.invuln - dt);

    // Horizontal movement.
    const dir = canAct ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
    if (dir !== 0) {
      this.vx += dir * ACCEL * dt;
      this.vx = Math.max(-RUN_SPEED, Math.min(RUN_SPEED, this.vx));
      if (!this.swinging) this.facing = dir as 1 | -1;
    } else {
      const f = FRICTION * dt * (this.onGround ? 1 : 0.35);
      this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - Math.sign(this.vx) * f;
    }

    // Jumping with coyote time, input buffering and variable height.
    this.coyote = this.onGround ? COYOTE : this.coyote - dt;
    this.jumpBuffer = canAct && input.jumpPressed ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_VELOCITY;
      this.jumpBuffer = 0;
      this.coyote = 0;
    }
    const rising = this.vy < 0;
    const g = rising && !input.jumpHeld ? GRAVITY * 2.4 : GRAVITY;
    this.vy = Math.min(MAX_FALL, this.vy + g * dt);

    this.moveX(this.vx * dt, world);
    this.onGround = false;
    this.moveY(this.vy * dt, world);

    // Sword: hold to auto-swing, like Terraria.
    if (this.swingT >= 0) this.swingT += dt;
    const ready = this.swingT < 0 || this.swingT >= SWING_TIME + SWING_COOLDOWN;
    if (canAct && ready && input.attackHeld) {
      if (aimWorldX !== null) this.facing = aimWorldX < this.cx ? -1 : 1;
      this.swingT = 0;
      this.swingId++;
    } else if (this.swingT >= SWING_TIME + SWING_COOLDOWN) {
      this.swingT = -1;
    }
  }

  private moveX(dx: number, world: World): void {
    this.x += dx;
    if (world.rectCollides(this.x, this.y, this.w, this.h)) {
      this.x = dx > 0 ? Math.floor((this.x + this.w) / 16) * 16 - this.w : Math.floor(this.x / 16) * 16 + 16;
      this.vx = 0;
    }
  }

  private moveY(dy: number, world: World): void {
    this.y += dy;
    if (world.rectCollides(this.x, this.y, this.w, this.h)) {
      if (dy > 0) {
        this.y = Math.floor((this.y + this.h) / 16) * 16 - this.h;
        this.onGround = true;
      } else {
        this.y = Math.floor(this.y / 16) * 16 + 16;
      }
      this.vy = 0;
    }
  }

  hurt(fromX: number): boolean {
    if (this.invuln > 0 || !this.alive) return false;
    this.hearts--;
    this.invuln = 1.0;
    this.vx = (this.cx < fromX ? -1 : 1) * 160;
    this.vy = -180;
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, sprites: Sprites, camX: number, camY: number): void {
    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    let frame = sprites.player.idle;
    if (!this.onGround) frame = sprites.player.jump;
    else if (Math.abs(this.vx) > 10) {
      const cycle = [sprites.player.walkA, sprites.player.idle, sprites.player.walkB, sprites.player.idle];
      frame = cycle[Math.floor(this.animT * 10) % 4];
    }
    const img = this.facing === 1 ? frame.right : frame.left;
    // Sprite is 12x21; hitbox is 10x20 anchored at its feet.
    const sx = Math.round(this.x - 1 - camX);
    const sy = Math.round(this.y - 1 - camY);

    if (this.swinging) this.drawSword(ctx, sprites, camX, camY);
    if (blink) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.facing === 1 ? sprites.playerFlash.right : sprites.playerFlash.left, sx, sy);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(img, sx, sy);
    }
  }

  private drawSword(ctx: CanvasRenderingContext2D, sprites: Sprites, camX: number, camY: number): void {
    const a = this.swingAngle();
    ctx.save();
    ctx.translate(Math.round(this.handX - camX), Math.round(this.handY - camY));
    ctx.scale(this.facing, 1);

    // Swoosh trail sweeping behind the blade.
    const trailLen = 0.9;
    const start = Math.max(SWING_FROM, a - trailLen) - Math.PI / 2;
    const end = a - Math.PI / 2;
    if (end > start) {
      ctx.fillStyle = 'rgba(200, 240, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_REACH + 2, start, end);
      ctx.arc(0, 0, 14, end, start, true);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, SWORD_REACH + 2, Math.max(start, end - 0.35), end);
      ctx.arc(0, 0, SWORD_REACH - 8, end, Math.max(start, end - 0.35), true);
      ctx.closePath();
      ctx.fill();
    }

    ctx.rotate(a);
    ctx.drawImage(sprites.sword, -SWORD_PIVOT_X, -SWORD_PIVOT_Y);
    ctx.restore();
  }
}
