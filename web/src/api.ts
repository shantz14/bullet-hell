import type { BossInfo } from './boss';

const FALLBACK_BOSSES: BossInfo[] = [{ id: 1, name: 'Gloomcap', title: 'the Rotting Sovereign', maxHp: 400 }];

export async function fetchBosses(): Promise<BossInfo[]> {
  try {
    const res = await fetch('/api/bosses');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const bosses = (await res.json()) as BossInfo[] | null;
    return bosses && bosses.length > 0 ? bosses : FALLBACK_BOSSES;
  } catch (err) {
    console.warn('using built-in boss list; server unavailable:', err);
    return FALLBACK_BOSSES;
  }
}

export interface RunResult {
  bossId: number;
  won: boolean;
  durationMs: number;
  heartsLeft: number;
}

export async function recordRun(run: RunResult): Promise<void> {
  try {
    await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(run),
    });
  } catch (err) {
    console.warn('failed to record run:', err);
  }
}
