// 5x7 bitmap font so all text stays on the pixel grid.
const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# #...# ##..# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '.###. #.... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ....# .###.',
  ' ': '..... ..... ..... ..... ..... ..... .....',
  ',': '..... ..... ..... ..... ..... ..#.. .#...',
  '.': '..... ..... ..... ..... ..... ..... ..#..',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  ':': '..... ..#.. ..... ..... ..... ..#.. .....',
  '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '-': '..... ..... ..... .###. ..... ..... .....',
  "'": '..#.. ..#.. ..... ..... ..... ..... .....',
};

const cache = new Map<string, HTMLCanvasElement>();

export function textWidth(s: string, scale = 1): number {
  return (s.length * 6 - 1) * scale;
}

function render(s: string, color: string, scale: number, shadow: string | null): HTMLCanvasElement {
  const pad = shadow ? scale : 0;
  const c = document.createElement('canvas');
  c.width = textWidth(s, scale) + pad;
  c.height = 7 * scale + pad;
  const g = c.getContext('2d')!;
  const paint = (ox: number, oy: number, col: string) => {
    g.fillStyle = col;
    [...s.toUpperCase()].forEach((ch, i) => {
      const rows = (GLYPHS[ch] ?? GLYPHS['?']).split(' ');
      rows.forEach((row, y) => {
        for (let x = 0; x < 5; x++) {
          if (row[x] === '#') g.fillRect(ox + (i * 6 + x) * scale, oy + y * scale, scale, scale);
        }
      });
    });
  };
  if (shadow) paint(pad, pad, shadow);
  paint(0, 0, color);
  return c;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color = '#ffffff',
  scale = 1,
  shadow: string | null = '#1a1020',
): void {
  const key = `${s}|${color}|${scale}|${shadow}`;
  let c = cache.get(key);
  if (!c) {
    c = render(s, color, scale, shadow);
    cache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x), Math.round(y));
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  s: string,
  cx: number,
  y: number,
  color = '#ffffff',
  scale = 1,
  shadow: string | null = '#1a1020',
): void {
  drawText(ctx, s, cx - textWidth(s, scale) / 2, y, color, scale, shadow);
}
