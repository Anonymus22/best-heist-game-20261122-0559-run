// Midnight Ledger - shared tuning tables, geometry helpers and the seeded RNG.
// Everything the other modules need to agree on lives here: world size, the
// difficulty ladder, loot values and the small math toolkit. No game state.

export const WORLD_W = 960;
export const WORLD_H = 640;

// The heist runs through these phases in order; WON and LOST are terminal.
export const PHASE = {
  TITLE: 'title',
  INFILTRATE: 'infiltrate',
  CRACKING: 'cracking',
  ESCAPE: 'escape',
  WON: 'won',
  LOST: 'lost',
};

// One row per difficulty: how many guards walk, how fast the cameras sweep,
// how forgiving the safe dial is, how quickly eyes fill with suspicion.
export const DIFFICULTY = {
  easy: {
    label: 'EASY', guards: 3, cameras: 2,
    cameraSpeed: 0.4, dialWindowDeg: 54, dialSpeed: 1.5,
    detectRate: 0.85, heatDecay: 10, heatPerMiss: 8,
    timeLimit: 360, escapeTime: 120,
  },
  normal: {
    label: 'NORMAL', guards: 4, cameras: 3,
    cameraSpeed: 0.65, dialWindowDeg: 40, dialSpeed: 2.0,
    detectRate: 1.2, heatDecay: 7, heatPerMiss: 12,
    timeLimit: 300, escapeTime: 90,
  },
  hard: {
    label: 'HARD', guards: 5, cameras: 4,
    cameraSpeed: 0.95, dialWindowDeg: 28, dialSpeed: 2.6,
    detectRate: 1.55, heatDecay: 5, heatPerMiss: 16,
    timeLimit: 240, escapeTime: 75,
  },
};

// What the vault and the side offices hold. Weight slows the thief's feet.
export const LOOT_KINDS = {
  cash: { label: 'CASH', value: 500, weight: 1, color: '#86e39a' },
  gold: { label: 'GOLD', value: 1500, weight: 2, color: '#ffd94a' },
  gems: { label: 'GEMS', value: 3000, weight: 3, color: '#7fd4ff' },
};

// mulberry32: tiny seeded RNG so staged screenshot states are reproducible.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn `angle` toward `target` by at most `step` radians.
export function turnToward(angle, target, step) {
  const d = angleDiff(target, angle);
  if (Math.abs(d) <= step) return target;
  return angle + Math.sign(d) * step;
}

// True when segment (x1,y1)-(x2,y2) touches rectangle r (walls block sight).
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

// Circle (x, y, r) against rectangle overlap test.
export function circleHitsRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function formatMoney(n) {
  return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
