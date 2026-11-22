// Midnight Ledger - eyes and lenses: who can see the thief, and how fast
// their suspicion fills. Guards and cameras share the same cone test; they
// differ in range, arc and what they do when their meter tops out.

import { clamp, dist, angleDiff } from './constants.js';
import { lineBlocked } from './bank.js';

export const GUARD_SIGHT = { range: 168, halfArc: 0.62 };
export const CAMERA_SIGHT = { range: 150, halfArc: 0.5 };

// True when (tx, ty) lies inside the observer's cone and no wall intervenes.
export function canSee(map, ox, oy, angle, sight, tx, ty) {
  const d = dist(ox, oy, tx, ty);
  if (d > sight.range) return false;
  const bearing = Math.atan2(ty - oy, tx - ox);
  if (Math.abs(angleDiff(bearing, angle)) > sight.halfArc) return false;
  return !lineBlocked(map, ox, oy, tx, ty);
}

// How strongly one observer registers the thief this frame, 0..1.
// Close is loud, far is faint; a crouching thief reads smaller, a sprinting
// one larger, and a thief hauling loot is in a hurry, not invisible.
export function exposure(map, ox, oy, angle, sight, thief) {
  if (!canSee(map, ox, oy, angle, sight, thief.x, thief.y)) return 0;
  const d = dist(ox, oy, thief.x, thief.y);
  let signal = clamp(1.15 - d / sight.range, 0.12, 1);
  if (thief.crouching) signal *= 0.55;
  if (thief.sprinting) signal *= 1.3;
  return signal;
}

// The loudest single signal the thief is giving off right now, across every
// guard and camera: the game uses it to drive the shared heat meter.
export function strongestSignal(map, guards, cameras, thief) {
  let best = 0;
  for (const g of guards) {
    const s = exposure(map, g.x, g.y, g.angle, GUARD_SIGHT, thief);
    if (s > best) best = s;
  }
  for (const c of cameras) {
    const s = exposure(map, c.x, c.y, c.angle, CAMERA_SIGHT, thief);
    if (s > best) best = s;
  }
  return best;
}
