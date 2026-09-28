import { hash, rng, type Sprites } from './sprites';

export const TILE = 16;
export const VIEW_W = 512;
export const VIEW_H = 288;

export const Tile = { Air: 0, Grass: 1, Dirt: 2, Stone: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

interface Decor {
  x: number;
  kind: number;
}

export class World {
  readonly cols = 60;
  readonly rows = 18;
  readonly floorRow = 15;
  private tiles: Uint8Array;
  private decor: Decor[] = [];

  constructor() {
    this.tiles = new Uint8Array(this.cols * this.rows);
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        let t: Tile = Tile.Air;
        if (cy === this.floorRow) t = Tile.Grass;
        else if (cy > this.floorRow) t = Tile.Dirt;
        // Stone pillars bound the arena on both sides.
        if (cy < this.floorRow && (cx < 2 || cx >= this.cols - 2)) t = Tile.Stone;
        this.tiles[cy * this.cols + cx] = t;
      }
    }
    const r = rng(1337);
    for (let x = 2 * TILE + 4; x < (this.cols - 2) * TILE - 8; x += 6 + Math.floor(r() * 22)) {
      const roll = r();
      const kind = roll < 0.45 ? 0 : roll < 0.7 ? 1 : roll < 0.8 ? 2 : roll < 0.9 ? 3 : 4;
      this.decor.push({ x, kind });
    }
  }

  get widthPx(): number {
    return this.cols * TILE;
  }

  get heightPx(): number {
    return this.rows * TILE;
  }

  get floorY(): number {
    return this.floorRow * TILE;
  }

  get(cx: number, cy: number): Tile {
    if (cy < 0) return Tile.Air;
    if (cx < 0 || cx >= this.cols || cy >= this.rows) return Tile.Stone;
    return this.tiles[cy * this.cols + cx] as Tile;
  }

  solidAt(px: number, py: number): boolean {
    return this.get(Math.floor(px / TILE), Math.floor(py / TILE)) !== Tile.Air;
  }

  rectCollides(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (this.get(cx, cy) !== Tile.Air) return true;
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, sprites: Sprites, camX: number, camY: number): void {
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const c1 = Math.min(this.cols - 1, Math.floor((camX + VIEW_W) / TILE));
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const t = this.get(cx, cy);
        if (t === Tile.Air) continue;
        const v = Math.floor(hash(cx, cy, 3) * 4);
        const set = t === Tile.Grass ? sprites.grass : t === Tile.Dirt ? sprites.dirt : sprites.stone;
        ctx.drawImage(set[v], cx * TILE - camX, cy * TILE - camY);
      }
    }
    for (const d of this.decor) {
      const s = sprites.decor[d.kind];
      const sx = d.x - camX;
      if (sx < -s.width || sx > VIEW_W) continue;
      ctx.drawImage(s, sx, this.floorY - s.height - camY);
    }
  }
}

// Parallax background: dithered sky, drifting clouds, far mountains, near hills.
export class Background {
  private sky: HTMLCanvasElement;
  private clouds: HTMLCanvasElement;
  private mountains: HTMLCanvasElement;
  private hills: HTMLCanvasElement;

  constructor() {
    this.sky = this.buildSky();
    this.clouds = this.buildClouds();
    this.mountains = this.buildMountains();
    this.hills = this.buildHills();
  }

  private layer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')!];
  }

  private buildSky(): HTMLCanvasElement {
    const [c, g] = this.layer(VIEW_W, VIEW_H);
    const bands = ['#4a86d8', '#5693de', '#62a0e4', '#70ade9', '#80baee', '#92c6f1', '#a6d2f4', '#bcdef6'];
    const bandH = Math.ceil(VIEW_H / bands.length);
    for (let y = 0; y < VIEW_H; y++) {
      const b = Math.min(bands.length - 1, Math.floor(y / bandH));
      const next = bands[Math.min(bands.length - 1, b + 1)];
      const intoBand = y % bandH;
      for (let x = 0; x < VIEW_W; x++) {
        // Checkerboard dither across the last few rows of each band.
        const dither = intoBand >= bandH - 3 && (x + y) % 2 === 0;
        g.fillStyle = dither ? next : bands[b];
        g.fillRect(x, y, 1, 1);
      }
    }
    // Pixel sun.
    for (let y = -10; y <= 10; y++) {
      for (let x = -10; x <= 10; x++) {
        const d = Math.hypot(x, y);
        if (d <= 10) {
          g.fillStyle = d <= 7 ? '#fff6c8' : '#ffe98a';
          g.fillRect(420 + x, 44 + y, 1, 1);
        }
      }
    }
    return c;
  }

  private buildClouds(): HTMLCanvasElement {
    const W = 1024;
    const [c, g] = this.layer(W, 140);
    const r = rng(42);
    for (let i = 0; i < 9; i++) {
      const cx = Math.floor(r() * W);
      const cy = 20 + Math.floor(r() * 90);
      const puffs: [number, number, number][] = [];
      const n = 3 + Math.floor(r() * 4);
      for (let p = 0; p < n; p++) puffs.push([p * 9 - n * 4.5 + r() * 4, -r() * 6, 6 + r() * 7]);
      for (let y = -24; y <= 16; y++) {
        for (let x = -60; x <= 60; x++) {
          let inside = false;
          let shade = false;
          for (const [px, py, pr] of puffs) {
            const d = Math.hypot(x - px, y - py);
            if (d <= pr) {
              inside = true;
              if (y - py > pr * 0.45) shade = true;
            }
          }
          if (!inside || y > 6) continue;
          g.fillStyle = shade || y > 3 ? '#dbe8f5' : '#ffffff';
          g.fillRect((((cx + x) % W) + W) % W, cy + y, 1, 1);
        }
      }
    }
    return c;
  }

  private ridge(
    color: string,
    top: string,
    fn: (x: number) => number,
    extra?: (g: CanvasRenderingContext2D) => void,
  ): HTMLCanvasElement {
    const [c, g] = this.layer(VIEW_W, VIEW_H);
    for (let x = 0; x < VIEW_W; x++) {
      const h = Math.round(fn(x));
      g.fillStyle = top;
      g.fillRect(x, h, 1, 2);
      g.fillStyle = color;
      g.fillRect(x, h + 2, 1, VIEW_H - h);
    }
    extra?.(g);
    return c;
  }

  private buildMountains(): HTMLCanvasElement {
    const k = (Math.PI * 2) / VIEW_W;
    return this.ridge('#86a2d0', '#c4d6ee', (x) =>
      140 + 28 * Math.sin(x * k * 2) + 14 * Math.sin(x * k * 5 + 1) + 6 * Math.sin(x * k * 11 + 2),
    );
  }

  private buildHills(): HTMLCanvasElement {
    const k = (Math.PI * 2) / VIEW_W;
    const h = (x: number) => 196 + 12 * Math.sin(x * k * 3) + 7 * Math.sin(x * k * 7 + 0.5);
    return this.ridge('#4f8f5a', '#6aac6c', h, (g) => {
      const r = rng(7);
      for (let tx = 10; tx < VIEW_W; tx += 22 + Math.floor(r() * 30)) {
        const base = Math.round(h(tx)) + 2;
        const cr = 6 + Math.floor(r() * 5);
        const trunkH = 5 + Math.floor(r() * 5);
        g.fillStyle = '#3e2a1c';
        g.fillRect(tx - 1, base - trunkH, 2, trunkH);
        const ccy = base - trunkH - cr + 2;
        for (let y = -cr; y <= cr; y++) {
          for (let x = -cr; x <= cr; x++) {
            if (Math.hypot(x, y) > cr) continue;
            g.fillStyle = x + y < -cr * 0.5 ? '#4f9a58' : '#3a7a46';
            g.fillRect((((tx + x) % VIEW_W) + VIEW_W) % VIEW_W, ccy + y, 1, 1);
          }
        }
      }
    });
  }

  private wrap(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, offset: number, y: number): void {
    const w = img.width;
    let x = -(((Math.floor(offset) % w) + w) % w);
    for (; x < VIEW_W; x += w) ctx.drawImage(img, x, y);
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, time: number): void {
    ctx.drawImage(this.sky, 0, 0);
    this.wrap(ctx, this.clouds, camX * 0.08 + time * 4, 0);
    this.wrap(ctx, this.mountains, camX * 0.15, 0);
    this.wrap(ctx, this.hills, camX * 0.35, 0);
  }
}
