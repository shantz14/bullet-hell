import type { Effects } from './fx';
import type { Player } from './player';
import type { Sprites } from './sprites';
import type { World } from './world';

export type BulletKind = 'spore' | 'toxic' | 'pink';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  r: number;
  kind: BulletKind;
  life: number;
}

export interface BossInfo {
  id: number;
  name: string;
  title: string;
  maxHp: number;
}

type Pattern = 'ring' | 'spiral' | 'aimed' | 'rain' | 'slam';
const PATTERNS: Pattern[] = ['ring', 'spiral', 'aimed', 'rain', 'slam'];
const DURATION: Record<Pattern, number> = { ring: 2.6, spiral: 3.6, aimed: 2.6, rain: 3.2, slam: 2.6 };

// Number of times a timer with the given interval fires during (t - dt, t].
function ticks(t: number, dt: number, interval: number): number {
  return Math.floor(t / interval) - Math.floor((t - dt) / interval);
}

interface Ctx {
  player: Player;
  world: World;
  fx: Effects;
  spawn: (b: Bullet) => void;
}

export class Boss {
  readonly info: BossInfo;
  hp: number;
  x: number;
  y: number;
  private baseY: number;
  readonly w = 46;
  readonly h = 46;
  private t = 0;
  private flash = 0;
  private tx: number;
  private ty = 90;
  private retarget = 0;
  private pattern: Pattern | null = null;
  private patternT = 0;
  private lastPattern: Pattern | null = null;
  private gap = 1.5;
  private slam = { lockedX: 0, diving: false, landed: false };
  enraged = false;
  entering = true;

  constructor(info: BossInfo, x: number) {
    this.info = info;
    this.hp = info.maxHp;
    this.x = x;
    this.tx = x;
    this.baseY = -60;
    this.y = this.baseY;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get hitbox(): { x: number; y: number; w: number; h: number } {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2 + 2, w: this.w, h: this.h };
  }

  containsPoint(px: number, py: number): boolean {
    const b = this.hitbox;
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  damage(amount: number, c: Ctx): void {
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 0.08;
    c.fx.popup(this.x, this.y - 30, String(amount), '#ffd84a');
    c.fx.burst(this.x, this.y, ['#a35cc8', '#e8dcc0', '#7b3fa0'], 8, 110);
    if (!this.enraged && this.hp <= this.info.maxHp / 2) {
      this.enraged = true;
      c.fx.popup(this.x, this.y - 44, `${this.info.name} is enraged!`, '#ff6a6a');
      c.fx.addShake(4);
    }
  }

  update(dt: number, c: Ctx): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.entering) {
      this.baseY += (this.ty - this.baseY) * Math.min(1, dt * 1.6);
      this.y = this.baseY;
      if (Math.abs(this.baseY - this.ty) < 2) this.entering = false;
      return;
    }

    if (this.pattern === 'slam') {
      this.updateSlam(dt, c);
    } else {
      this.drift(dt, c);
    }

    if (this.pattern) {
      this.patternT += dt;
      this.runPattern(this.pattern, dt, c);
      if (this.patternT >= DURATION[this.pattern]) {
        this.lastPattern = this.pattern;
        this.pattern = null;
        this.gap = this.enraged ? 0.45 : 0.9;
      }
    } else {
      this.gap -= dt;
      if (this.gap <= 0) {
        const options = PATTERNS.filter((p) => p !== this.lastPattern);
        this.pattern = options[Math.floor(Math.random() * options.length)];
        this.patternT = 0;
        this.slam = { lockedX: 0, diving: false, landed: false };
      }
    }
  }

  private drift(dt: number, c: Ctx): void {
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = 1.6 + Math.random() * 1.2;
      const minX = 64;
      const maxX = c.world.widthPx - 64;
      this.tx = Math.max(minX, Math.min(maxX, c.player.cx + (Math.random() - 0.5) * 280));
      this.ty = 60 + Math.random() * 60;
    }
    const k = Math.min(1, dt * (this.enraged ? 1.6 : 1.1));
    this.x += (this.tx - this.x) * k;
    this.baseY += (this.ty - this.baseY) * k;
    this.y = this.baseY + Math.sin(this.t * 2.2) * 4;
  }

  private updateSlam(dt: number, c: Ctx): void {
    const t = this.patternT;
    const floorTop = c.world.floorY - this.h / 2 - 2;
    if (t < 0.7) {
      // Wind up: rise above the player.
      const k = Math.min(1, dt * 5);
      this.x += (c.player.cx - this.x) * k;
      this.baseY += (40 - this.baseY) * k;
      this.y = this.baseY + Math.sin(this.t * 30) * 1.5;
      this.slam.lockedX = this.x;
    } else if (!this.slam.landed) {
      this.slam.diving = true;
      this.baseY = Math.min(floorTop, this.baseY + (this.enraged ? 620 : 520) * dt);
      this.y = this.baseY;
      if (this.baseY >= floorTop) {
        this.slam.landed = true;
        this.impact(c);
      }
    } else if (t > 1.5) {
      this.baseY += (90 - this.baseY) * Math.min(1, dt * 3);
      this.y = this.baseY;
    }
  }

  private impact(c: Ctx): void {
    c.fx.addShake(6);
    c.fx.burst(this.x, c.world.floorY, ['#8a5a33', '#5cb83c', '#6e4526'], 30, 160);
    const speeds = this.enraged ? [110, 150, 190, 230] : [120, 170, 220];
    for (const dir of [-1, 1]) {
      for (const s of speeds) {
        c.spawn(this.bullet(this.x + dir * 20, c.world.floorY - 5, dir * s, 0, 'toxic'));
      }
    }
    const n = this.enraged ? 13 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (Math.PI * (i + 0.5)) / n;
      c.spawn(this.bullet(this.x, this.y, Math.cos(a) * 130, Math.sin(a) * 130, 'spore', 160));
    }
  }

  private bullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    kind: BulletKind,
    ay = 0,
  ): Bullet {
    return { x, y, vx, vy, ay, r: 3, kind, life: 8 };
  }

  private runPattern(p: Pattern, dt: number, c: Ctx): void {
    const t = this.patternT;
    const e = this.enraged;
    switch (p) {
      case 'ring': {
        if (t > 2.4) break;
        const n = ticks(t, dt, e ? 0.45 : 0.6);
        for (let k = 0; k < n; k++) {
          const count = e ? 26 : 18;
          const offset = Math.floor(t / 0.3) * 0.17;
          for (let i = 0; i < count; i++) {
            const a = offset + (Math.PI * 2 * i) / count;
            c.spawn(this.bullet(this.x, this.y, Math.cos(a) * 85, Math.sin(a) * 85, 'spore'));
          }
        }
        break;
      }
      case 'spiral': {
        if (t < 0.3 || t > 3.3) break;
        const n = ticks(t, dt, 0.08);
        const arms = e ? 4 : 3;
        for (let k = 0; k < n; k++) {
          for (let i = 0; i < arms; i++) {
            const a = t * 2.4 + (Math.PI * 2 * i) / arms;
            c.spawn(this.bullet(this.x, this.y, Math.cos(a) * 95, Math.sin(a) * 95, 'pink'));
            if (e) c.spawn(this.bullet(this.x, this.y, Math.cos(-a) * 70, Math.sin(-a) * 70, 'spore'));
          }
        }
        break;
      }
      case 'aimed': {
        if (t > 2.2) break;
        const n = ticks(t, dt, e ? 0.35 : 0.5);
        for (let k = 0; k < n; k++) {
          const base = Math.atan2(c.player.cy - this.y, c.player.cx - this.x);
          const spread = e ? 7 : 5;
          for (let i = 0; i < spread; i++) {
            const a = base + (i - (spread - 1) / 2) * 0.2;
            c.spawn(this.bullet(this.x, this.y, Math.cos(a) * 150, Math.sin(a) * 150, 'pink'));
          }
        }
        break;
      }
      case 'rain': {
        if (t > 2.8) break;
        const n = ticks(t, dt, e ? 0.07 : 0.11);
        for (let k = 0; k < n; k++) {
          const x = c.player.cx + (Math.random() - 0.5) * 520;
          c.spawn(this.bullet(x, -8, (Math.random() - 0.5) * 30, 70 + Math.random() * 50, 'toxic', 60));
        }
        break;
      }
      case 'slam':
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, sprites: Sprites, camX: number, camY: number): void {
    const attacking = this.pattern !== null && !this.entering;
    let img = attacking ? sprites.boss.attack : sprites.boss.idle;
    if (this.flash > 0) img = sprites.boss.flash;
    const dx = Math.round(this.x - img.width / 2 - camX);
    const dy = Math.round(this.y - img.height / 2 - camY);
    // Ground shadow.
    const shadowW = Math.max(8, 40 - Math.max(0, 200 - this.y) * 0.12);
    ctx.fillStyle = 'rgba(20, 10, 30, 0.3)';
    ctx.fillRect(Math.round(this.x - shadowW / 2 - camX), 240 - 2 - camY, Math.round(shadowW), 2);
    if (this.enraged) {
      // Pulsing red aura: the silhouette offset in each direction behind the sprite.
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 12) * 0.25;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sprites.boss.rage, dx + ox, dy + oy);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, dx, dy);
  }
}
