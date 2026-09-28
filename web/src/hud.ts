import type { Boss } from './boss';
import { drawTextCentered } from './font';
import type { Player } from './player';
import type { Sprites } from './sprites';
import { VIEW_H, VIEW_W } from './world';

const BAR_W = 220;
const BAR_H = 8;

export class Hud {
  // Trailing "chip" value that lags behind the real HP to show recent damage.
  private chipHp = 0;
  private bossRef: Boss | null = null;

  update(dt: number, boss: Boss): void {
    if (this.bossRef !== boss) {
      this.bossRef = boss;
      this.chipHp = boss.hp;
    }
    if (this.chipHp > boss.hp) this.chipHp = Math.max(boss.hp, this.chipHp - boss.info.maxHp * 0.35 * dt);
    else this.chipHp = boss.hp;
  }

  drawHearts(ctx: CanvasRenderingContext2D, sprites: Sprites, player: Player, time: number): void {
    for (let i = 0; i < player.maxHearts; i++) {
      const full = i < player.hearts;
      // The last remaining heart beats when health is low.
      const beat = full && i === player.hearts - 1 && player.hearts <= 3 && Math.sin(time * 10) > 0.3;
      ctx.drawImage(full ? sprites.heart : sprites.heartEmpty, 6 + i * 11, 6 - (beat ? 1 : 0));
    }
  }

  drawBossBar(ctx: CanvasRenderingContext2D, boss: Boss): void {
    const x = Math.round((VIEW_W - BAR_W) / 2);
    const y = VIEW_H - 16;
    const max = boss.info.maxHp;
    drawTextCentered(ctx, boss.info.name, VIEW_W / 2, y - 11, boss.enraged ? '#ff8a8a' : '#ffffff');

    ctx.fillStyle = '#1a1020';
    ctx.fillRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4);
    ctx.fillStyle = '#6a5a7a';
    ctx.fillRect(x - 1, y - 1, BAR_W + 2, BAR_H + 2);
    ctx.fillStyle = '#2a1a2a';
    ctx.fillRect(x, y, BAR_W, BAR_H);

    const chipW = Math.round((this.chipHp / max) * BAR_W);
    ctx.fillStyle = '#ffe0a8';
    ctx.fillRect(x, y, chipW, BAR_H);

    const w = Math.round((boss.hp / max) * BAR_W);
    ctx.fillStyle = '#d82838';
    ctx.fillRect(x, y, w, BAR_H);
    ctx.fillStyle = '#ff6a6a';
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#9a1020';
    ctx.fillRect(x, y + BAR_H - 2, w, 2);
  }
}
