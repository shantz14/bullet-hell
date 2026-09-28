import { drawTextCentered } from './font';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export class Effects {
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  shake = 0;

  burst(x: number, y: number, colors: string[], count: number, speed = 90, gravity = 300): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.3 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life,
        maxLife: life,
        size: Math.random() < 0.3 ? 2 : 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity,
      });
    }
  }

  popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x: x + (Math.random() - 0.5) * 10, y, text, color, life: 0.8 });
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 20);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 30 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      drawTextCentered(ctx, p.text, p.x - camX, p.y - camY, p.color);
    }
  }

  clear(): void {
    this.particles = [];
    this.popups = [];
    this.shake = 0;
  }
}
