// All pixel art is defined here as data (hand-drawn rows or small generators)
// and baked into offscreen canvases once at startup.

export type Sprite = HTMLCanvasElement;
type Palette = Record<string, string>;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function fromRows(rows: string[], pal: Palette): Sprite {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) console.warn(`sprite row ${i} is ${r.length} wide, expected ${w}`);
  });
  const [c, g] = canvas(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  return c;
}

// Build a sprite from a per-pixel color function, optionally tracing a 1px outline
// around every filled pixel.
export function fromFn(
  w: number,
  h: number,
  fn: (x: number, y: number) => string | null,
  outline: string | null = null,
): Sprite {
  const grid: (string | null)[][] = [];
  for (let y = 0; y < h; y++) {
    grid.push([]);
    for (let x = 0; x < w; x++) grid[y].push(fn(x, y));
  }
  const [c, g] = canvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let col = grid[y][x];
      if (!col && outline) {
        const n = (xx: number, yy: number) => grid[yy]?.[xx] != null;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) col = outline;
      }
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// Solid-color silhouette of a sprite, used for hit flashes.
export function silhouette(src: Sprite, color: string): Sprite {
  const [c, g] = canvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function flipX(src: Sprite): Sprite {
  const [c, g] = canvas(src.width, src.height);
  g.scale(-1, 1);
  g.drawImage(src, -src.width, 0);
  return c;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- player

const PLAYER_PAL: Palette = {
  o: '#1a1420',
  h: '#6b4226',
  H: '#8a5a34',
  s: '#f1c27d',
  S: '#d9a066',
  e: '#1b1b2f',
  w: '#ffffff',
  t: '#3b8f4a',
  T: '#2a6636',
  b: '#4a3222',
  p: '#4a5a8c',
  P: '#33406a',
  k: '#3a2a1a',
};

const PLAYER_TOP = [
  '...ooooo....',
  '..ohhhhhoo..',
  '.ohHhhhhhho.',
  '.ohhhssssso.',
  '.ohhssssweo.',
  '.ohhsssssso.',
  '..oSsssssso.',
  '...ooSSSoo..',
  '..otttttto..',
  '.otttttttto.',
  '.otTttttTto.',
  '.osTttttTso.',
  '.osTttttTso.',
  '..obbbbbbo..',
  '..oppppppo..',
  '..opppPppo..',
];

const LEGS = {
  idle: ['..oppooppo..', '..oppooppo..', '..okkookko..', '..okkkokkko.', '..ooooooooo.'],
  walkA: ['.oppo..oppo.', '.oppo..oppo.', '.okko..okko.', '.okkko.okkko', '.ooooo.ooooo'],
  walkB: ['...oppppo...', '...oppppo...', '...okkkko...', '...okkkkko..', '...ooooooo..'],
  jump: ['..oppooppo..', '.okkoookko..', '.okkkookkko.', '.oooo..oooo.', '............'],
};

function playerFrame(legs: string[]): { right: Sprite; left: Sprite } {
  const right = fromRows([...PLAYER_TOP, ...legs], PLAYER_PAL);
  return { right, left: flipX(right) };
}

// ---------------------------------------------------------------- sword

const SWORD_PAL: Palette = {
  o: '#1a1420',
  l: '#f2f8ff',
  m: '#b4c8de',
  d: '#6b7f99',
  c: '#7fe3ff',
  g: '#f0c040',
  G: '#a87020',
  r: '#7a3e1e',
};

function swordSprite(): Sprite {
  const rows = ['.....o.....', '....olo....', '...olcdo...'];
  for (let i = 0; i < 4; i++) rows.push('..olmmmdo..');
  for (let i = 0; i < 34; i++) rows.push('..olmcmdo..');
  rows.push('..olmmmdo..', '..olmmmdo..');
  rows.push('ooooooooooo', 'ogggggggggo', 'oGGGGGGGGGo', 'ooooooooooo');
  for (let i = 0; i < 4; i++) rows.push('....oro....');
  rows.push('...ogggo...', '...oGGGo...', '....ooo....');
  return fromRows(rows, SWORD_PAL);
}

// ---------------------------------------------------------------- hearts

const HEART_ROWS = [
  '.oo...oo.',
  'orro.orro',
  'orwrorrro',
  'orrrrrrro',
  '.orrrrRo.',
  '..orRRo..',
  '...oRo...',
  '....o....',
];

// ---------------------------------------------------------------- boss

function gloomcapFrame(mouthOpen: boolean, eyesBright: boolean): Sprite {
  const W = 56;
  const H = 52;
  const cx = 27.5;
  const spots: [number, number, number][] = [
    [15, 12, 4], [28, 7, 3.5], [40, 13, 4.5], [8, 19, 2.5], [23, 17, 2.5], [47, 20, 2], [34, 19, 2],
  ];
  return fromFn(
    W,
    H,
    (x, y) => {
      const px = x + 0.5;
      const py = y + 0.5;
      // Cap: a dome with a flat underside.
      const dx = (px - cx) / 27;
      const dy = (py - 22) / 20;
      if (y <= 24 && dx * dx + dy * dy <= 1) {
        for (const [sx, sy, r] of spots) {
          if (y < 21 && (px - sx) ** 2 + (py - sy) ** 2 <= r * r) {
            return (px - sx) + (py - sy) < -r * 0.6 ? '#fff6e0' : '#e8dcc0';
          }
        }
        if (y >= 22) return '#4a2266';
        const lx = (px - 17) / 27;
        const ly = (py - 7) / 20;
        const light = lx * lx + ly * ly;
        if (light < 0.12) return '#c07ae0';
        if (light < 0.35) return '#a35cc8';
        if (dx * dx + dy * dy > 0.8) return '#5c2d80';
        return '#7b3fa0';
      }
      // Stem, flaring slightly at the base.
      const stemHalf = 11 + (y > 44 ? (y - 44) * 0.8 : 0);
      if (y >= 25 && y <= 50 && Math.abs(px - cx) <= stemHalf) {
        // Face: glowing angry eyes and a jagged mouth.
        const eyeRow = y >= 31 && y <= 34;
        const leftEye = x >= 20 && x <= 24;
        const rightEye = x >= 31 && x <= 35;
        if (eyeRow && (leftEye || rightEye)) {
          const pupil = y >= 32 && (leftEye ? x === 23 || x === 22 : x === 32 || x === 33);
          if (pupil) return '#2a0f1e';
          return eyesBright ? '#fff7a0' : '#ffe14a';
        }
        // Brows slanting down toward the middle.
        if ((leftEye && y === 30 - Math.floor((24 - x) / 2)) || (rightEye && y === 30 - Math.floor((x - 31) / 2))) {
          return '#2a0f1e';
        }
        const mouthTop = 39;
        const mouthBot = mouthOpen ? 45 : 42;
        if (y >= mouthTop && y <= mouthBot && x >= 21 && x <= 34) {
          const tooth = (y === mouthTop && x % 3 !== 0) || (y === mouthBot && x % 3 === 1);
          return tooth ? '#fff6e0' : '#2a0f1e';
        }
        if (px - cx > stemHalf - 3) return '#bfae8a';
        if (px - cx < -stemHalf + 2) return '#f7efd9';
        return '#e8dcc0';
      }
      // Gills peeking out beneath the cap.
      if (y >= 25 && y <= 26 && Math.abs(px - cx) <= 22 - (y - 25) * 5) {
        return x % 2 === 0 ? '#d8b6e8' : '#b58fc8';
      }
      return null;
    },
    '#1a1020',
  );
}

// ---------------------------------------------------------------- bullets

function orb(core: string, mid: string, edge: string): Sprite {
  return fromFn(8, 8, (x, y) => {
    const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
    if (d <= 1.6) return core;
    if (d <= 2.8) return mid;
    if (d <= 3.8) return edge;
    return null;
  });
}

function glow(color: string, r: number): Sprite {
  const size = r * 2 + 1;
  const [c, g] = canvas(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d <= 1) {
        g.globalAlpha = d < 0.5 ? 0.35 : 0.15;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

// ---------------------------------------------------------------- tiles

function grassTile(v: number): Sprite {
  return fromFn(16, 16, (x, y) => {
    const depth = 3 + Math.floor(hash(x, 0, v) * 3);
    if (y < depth) {
      if (y === 0) return hash(x, y, v + 9) < 0.8 ? '#86e05c' : '#5cb83c';
      if (y === depth - 1) return '#3e8e2f';
      return '#5cb83c';
    }
    return dirtPixel(x, y, v);
  });
}

function dirtPixel(x: number, y: number, v: number): string {
  const n = hash(x, y, v * 31 + 7);
  if (n < 0.04) return '#7a7a86';
  if (n < 0.16) return '#6e4526';
  if (n < 0.26) return '#a06a3e';
  return '#8a5a33';
}

function dirtTile(v: number): Sprite {
  return fromFn(16, 16, (x, y) => dirtPixel(x, y, v + 100));
}

function stoneTile(v: number): Sprite {
  return fromFn(16, 16, (x, y) => {
    // Irregular bricks: mortar lines with a per-variant offset.
    const row = Math.floor(y / 8);
    const off = row % 2 === 0 ? v * 3 : v * 3 + 8;
    const bx = (x + off) % 16;
    if (y % 8 === 7 || bx === 15) return '#3f3f4a';
    if (y % 8 === 0 || bx === 0) return '#8e8e9c';
    const n = hash(x, y, v + 50);
    if (n < 0.1) return '#5a5a66';
    if (n < 0.18) return '#7c7c8a';
    return '#6b6b78';
  });
}

// ---------------------------------------------------------------- decorations

const DECOR_ROWS: [string[], Palette][] = [
  [['..g..', 'g.g.g', '.ggg.', '.gGg.'], { g: '#5cb83c', G: '#3e8e2f' }],
  [['.g...g', '.g.g.g', 'gGgGg.', '.GgGgg'], { g: '#6fcf4a', G: '#3e8e2f' }],
  [['.r.', 'ryr', '.r.', '.g.', 'gg.'], { r: '#e8485a', y: '#ffe14a', g: '#3e8e2f' }],
  [['.w.', 'wyw', '.w.', '.g.', '.gg'], { w: '#ffffff', y: '#ffc93a', g: '#3e8e2f' }],
  [['.ppp.', 'pPwPp', '..s..', '..s..'], { p: '#9a4fc0', P: '#7b3fa0', w: '#e8dcc0', s: '#e8dcc0' }],
];

// ---------------------------------------------------------------- export

export type PlayerFrames = Record<keyof typeof LEGS, { right: Sprite; left: Sprite }>;

export interface Sprites {
  player: PlayerFrames;
  playerFlash: { right: Sprite; left: Sprite };
  sword: Sprite;
  heart: Sprite;
  heartEmpty: Sprite;
  boss: { idle: Sprite; attack: Sprite; flash: Sprite; rage: Sprite };
  bullets: Record<'spore' | 'toxic' | 'pink', Sprite>;
  bulletGlow: Record<'spore' | 'toxic' | 'pink', Sprite>;
  grass: Sprite[];
  dirt: Sprite[];
  stone: Sprite[];
  decor: Sprite[];
}

export function buildSprites(): Sprites {
  const player = {
    idle: playerFrame(LEGS.idle),
    walkA: playerFrame(LEGS.walkA),
    walkB: playerFrame(LEGS.walkB),
    jump: playerFrame(LEGS.jump),
  };
  const bossIdle = gloomcapFrame(false, false);
  return {
    player,
    playerFlash: {
      right: silhouette(player.idle.right, '#ffffff'),
      left: silhouette(player.idle.left, '#ffffff'),
    },
    sword: swordSprite(),
    heart: fromRows(HEART_ROWS, { o: '#2a0a10', r: '#e02438', R: '#a01020', w: '#ffb0bc' }),
    heartEmpty: fromRows(HEART_ROWS, { o: '#1a1420', r: '#3a3040', R: '#2e2634', w: '#4a4050' }),
    boss: {
      idle: bossIdle,
      attack: gloomcapFrame(true, true),
      flash: silhouette(bossIdle, '#ffffff'),
      rage: silhouette(bossIdle, '#ff3040'),
    },
    bullets: {
      spore: orb('#ffffff', '#e0a0ff', '#8a3fc0'),
      toxic: orb('#ffffff', '#b8ff7a', '#3e9e2f'),
      pink: orb('#ffffff', '#ffa0c8', '#d0306a'),
    },
    bulletGlow: {
      spore: glow('#c070ff', 7),
      toxic: glow('#8aff5a', 7),
      pink: glow('#ff6aa8', 7),
    },
    grass: [0, 1, 2, 3].map(grassTile),
    dirt: [0, 1, 2, 3].map(dirtTile),
    stone: [0, 1, 2, 3].map(stoneTile),
    decor: DECOR_ROWS.map(([rows, pal]) => fromRows(rows, pal)),
  };
}

export { hash };
