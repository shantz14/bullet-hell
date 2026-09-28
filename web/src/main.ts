import { fetchBosses, recordRun } from './api';
import { Boss, type BossInfo, type Bullet } from './boss';
import { drawText, drawTextCentered } from './font';
import { Effects } from './fx';
import { Hud } from './hud';
import { Input } from './input';
import { Player, SWORD_REACH } from './player';
import { buildSprites } from './sprites';
import { Background, TILE, VIEW_H, VIEW_W, World } from './world';

const STEP = 1 / 60;
const INTRO_TIME = 3;

type State = 'intro' | 'fight' | 'victory' | 'defeat';

class Game {
  private ctx: CanvasRenderingContext2D;
  private sprites = buildSprites();
  private world = new World();
  private bg = new Background();
  private fx = new Effects();
  private hud = new Hud();
  private input: Input;
  private player!: Player;
  private boss!: Boss;
  private bullets: Bullet[] = [];
  private camX = 0;
  private time = 0;
  private state: State = 'intro';
  private stateT = 0;
  private fightTime = 0;
  private lastHitSwing = -1;

  constructor(
    canvas: HTMLCanvasElement,
    private bosses: BossInfo[],
  ) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input(canvas);
    this.reset();
  }

  private get bossInfo(): BossInfo {
    return this.bosses[0];
  }

  private reset(): void {
    this.player = new Player(8 * TILE, this.world.floorY - 20);
    this.boss = new Boss(this.bossInfo, 30 * TILE);
    this.bullets = [];
    this.fx.clear();
    this.state = 'intro';
    this.stateT = 0;
    this.fightTime = 0;
    this.lastHitSwing = -1;
    this.camX = this.targetCamX();
  }

  private targetCamX(): number {
    return Math.max(0, Math.min(this.world.widthPx - VIEW_W, this.player.cx - VIEW_W / 2));
  }

  private setState(s: State): void {
    this.state = s;
    this.stateT = 0;
    if (s === 'victory' || s === 'defeat') {
      void recordRun({
        bossId: this.bossInfo.id,
        won: s === 'victory',
        durationMs: Math.round(this.fightTime * 1000),
        heartsLeft: this.player.hearts,
      });
    }
  }

  step(dt: number): void {
    this.time += dt;
    this.stateT += dt;
    const input = this.input;
    const ctx = { player: this.player, world: this.world, fx: this.fx, spawn: (b: Bullet) => this.bullets.push(b) };

    if ((this.state === 'victory' || this.state === 'defeat') && this.stateT > 1 && input.hit('KeyR', 'Enter')) {
      this.reset();
    }

    const aim = input.mouseDown ? input.mouseX + this.camX : null;
    this.player.update(dt, input, this.world, aim, this.player.alive);

    if (this.state === 'intro') {
      this.boss.update(dt, ctx);
      if (this.stateT >= INTRO_TIME && !this.boss.entering) this.setState('fight');
    } else if (this.state === 'fight') {
      this.fightTime += dt;
      this.boss.update(dt, ctx);
      this.checkSwordHit(ctx);
      this.checkPlayerHits();
      if (!this.boss.alive) {
        this.fx.addShake(8);
        for (let i = 0; i < 5; i++) {
          this.fx.burst(this.boss.x, this.boss.y, ['#a35cc8', '#e8dcc0', '#ffe14a', '#7b3fa0'], 30, 200);
        }
        for (const b of this.bullets) this.fx.burst(b.x, b.y, ['#ffffff', '#ffe14a'], 2, 40, 0);
        this.bullets = [];
        this.setState('victory');
      } else if (!this.player.alive) {
        this.fx.burst(this.player.cx, this.player.cy, ['#e02438', '#a01020', '#f1c27d'], 40, 160);
        this.fx.addShake(6);
        this.setState('defeat');
      }
    } else if (this.state === 'defeat') {
      this.boss.update(dt, ctx);
    }

    this.updateBullets(dt);
    this.fx.update(dt);
    this.hud.update(dt, this.boss);
    this.camX += (this.targetCamX() - this.camX) * Math.min(1, dt * 8);
    input.endStep();
  }

  private checkSwordHit(ctx: Parameters<Boss['damage']>[1]): void {
    const p = this.player;
    if (!p.swinging || p.swingId === this.lastHitSwing) return;
    const [dx, dy] = p.bladeDir();
    for (let d = 8; d <= SWORD_REACH; d += 4) {
      if (this.boss.containsPoint(p.handX + dx * d, p.handY + dy * d)) {
        this.lastHitSwing = p.swingId;
        const crit = Math.random() < 0.1;
        const dmg = (14 + Math.floor(Math.random() * 5)) * (crit ? 2 : 1);
        this.boss.damage(dmg, ctx);
        this.fx.addShake(crit ? 3 : 1.5);
        return;
      }
    }
  }

  private checkPlayerHits(): void {
    const p = this.player;
    if (p.invuln > 0) return;
    // A forgiving hitbox smaller than the sprite, as is traditional for bullet hells.
    const hx = p.x + 2;
    const hy = p.y + 3;
    const hw = p.w - 4;
    const hh = p.h - 5;
    for (const b of this.bullets) {
      const nx = Math.max(hx, Math.min(b.x, hx + hw));
      const ny = Math.max(hy, Math.min(b.y, hy + hh));
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 < b.r * b.r) {
        b.life = 0;
        this.hurtPlayer(b.x);
        return;
      }
    }
    const bh = this.boss.hitbox;
    const inset = 6;
    if (
      hx < bh.x + bh.w - inset &&
      hx + hw > bh.x + inset &&
      hy < bh.y + bh.h - inset &&
      hy + hh > bh.y + inset
    ) {
      this.hurtPlayer(this.boss.x);
    }
  }

  private hurtPlayer(fromX: number): void {
    if (this.player.hurt(fromX)) {
      this.fx.addShake(3);
      this.fx.burst(this.player.cx, this.player.cy, ['#e02438', '#ff8a8a'], 12, 100);
    }
  }

  private updateBullets(dt: number): void {
    const maxX = this.world.widthPx + 20;
    const maxY = this.world.heightPx + 20;
    for (const b of this.bullets) {
      b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life > 0 && this.world.solidAt(b.x, b.y)) {
        b.life = 0;
        this.fx.burst(b.x, b.y - 2, ['#ffffff', '#c070ff'], 3, 50);
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < maxX && b.y > -80 && b.y < maxY);
  }

  render(): void {
    const g = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.fx.shake * 2;
    const shakeY = (Math.random() - 0.5) * this.fx.shake * 2;
    const camX = Math.round(this.camX + shakeX);
    const camY = Math.round(shakeY);

    this.bg.draw(g, this.camX, this.time);
    this.world.draw(g, this.sprites, camX, camY);
    if (this.boss.alive) this.boss.draw(g, this.sprites, camX, camY);
    this.player.draw(g, this.sprites, camX, camY);
    this.drawBullets(g, camX, camY);
    this.fx.draw(g, camX, camY);

    this.hud.drawHearts(g, this.sprites, this.player, this.time);
    if (this.boss.alive && this.state !== 'intro') this.hud.drawBossBar(g, this.boss);
    this.drawOverlay(g);
  }

  private drawBullets(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    g.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const s = this.sprites.bulletGlow[b.kind];
      g.drawImage(s, Math.round(b.x - s.width / 2 - camX), Math.round(b.y - s.height / 2 - camY));
    }
    g.globalCompositeOperation = 'source-over';
    for (const b of this.bullets) {
      const s = this.sprites.bullets[b.kind];
      g.drawImage(s, Math.round(b.x - 4 - camX), Math.round(b.y - 4 - camY));
    }
  }

  private drawOverlay(g: CanvasRenderingContext2D): void {
    const cx = VIEW_W / 2;
    if (this.state === 'intro') {
      const t = this.stateT;
      const alpha = t < 0.5 ? t / 0.5 : t > INTRO_TIME - 0.6 ? Math.max(0, (INTRO_TIME - t) / 0.6) : 1;
      g.globalAlpha = alpha;
      drawTextCentered(g, this.bossInfo.name, cx, 96, '#e0a0ff', 3);
      drawTextCentered(g, this.bossInfo.title, cx, 124, '#ffffff');
      g.globalAlpha = 1;
      drawText(g, 'A/D MOVE   SPACE JUMP   CLICK OR J ATTACK', 6, VIEW_H - 12, '#ffffff');
    } else if (this.state === 'victory') {
      drawTextCentered(g, 'BOSS DEFEATED!', cx, 90, '#ffe14a', 3);
      drawTextCentered(g, `TIME ${formatTime(this.fightTime)}`, cx, 122, '#ffffff');
      if (this.stateT > 1) drawTextCentered(g, 'PRESS R TO FIGHT AGAIN', cx, 140, '#c8c8d8');
    } else if (this.state === 'defeat') {
      g.fillStyle = `rgba(40, 0, 10, ${Math.min(0.45, this.stateT * 0.4)})`;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawTextCentered(g, 'YOU WERE SLAIN...', cx, 100, '#ff4a5a', 3);
      if (this.stateT > 1) drawTextCentered(g, 'PRESS R TO TRY AGAIN', cx, 132, '#c8c8d8');
    }
  }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const fit = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  // Integer scaling keeps every art pixel the same size; fall back to fractional on tiny windows.
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
}

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  const game = new Game(canvas, await fetchBosses());
  let last = performance.now();
  let acc = 0;
  const frame = (now: number) => {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      game.step(STEP);
      acc -= STEP;
    }
    game.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
