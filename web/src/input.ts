import { VIEW_H, VIEW_W } from './world';

const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDown = false;
  mousePressed = false;
  mouseX = VIEW_W / 2;
  mouseY = VIEW_H / 2;
  mouseUsed = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouseY = ((e.clientY - r.top) / r.height) * VIEW_H;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mousePressed = true;
      this.mouseUsed = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  held(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  hit(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  get left(): boolean {
    return this.held('KeyA', 'ArrowLeft');
  }
  get right(): boolean {
    return this.held('KeyD', 'ArrowRight');
  }
  get jumpHeld(): boolean {
    return this.held('Space', 'KeyW', 'ArrowUp');
  }
  get jumpPressed(): boolean {
    return this.hit('Space', 'KeyW', 'ArrowUp');
  }
  get attackHeld(): boolean {
    return this.mouseDown || this.held('KeyJ', 'KeyK');
  }

  // Call once per simulation step, after the step has consumed presses.
  endStep(): void {
    this.pressed.clear();
    this.mousePressed = false;
  }
}
