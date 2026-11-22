// Midnight Ledger - the thief: movement, posture, pockets and coin lures.
// The thief is quick on empty pockets and slow under a heavy haul; crouching
// trades speed for a smaller silhouette, sprinting trades silence for ground.

import { clamp, dist, circleHitsRect } from './constants.js';
import { hitsSolid } from './bank.js';
import { LOOT_KINDS } from './constants.js';

export const THIEF_RADIUS = 11;
const WALK_SPEED = 148;
const CROUCH_SPEED = 74;
const SPRINT_SPEED = 228;

export function createThief(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    crouching: false,
    sprinting: false,
    moving: false,
    coins: 3,
    loot: 0,          // dollars carried
    weight: 0,        // loot weight units; each one trims top speed
    grabbedBy: null,  // guard object while a grab struggle runs
    stepT: 0,
  };
}

// Would the thief's circle overlap the still-locked vault door?
function doorBlocks(map, dial, x, y) {
  if (dial.cracked) return false;
  const v = map.vault;
  return circleHitsRect(x, y, THIEF_RADIUS, { x: v.doorX, y: v.doorY - 4, w: v.doorW, h: v.doorH + 8 });
}

function free(map, dial, x, y) {
  return !hitsSolid(map, x, y, THIEF_RADIUS) && !doorBlocks(map, dial, x, y);
}

// Moves the thief for one frame. `input` is { dx, dy, crouch, sprint } with
// dx/dy in -1..1. Axis-separated collision so the thief slides along walls.
export function moveThief(map, dial, thief, input, dt) {
  thief.crouching = !!input.crouch;
  thief.sprinting = !!input.sprint && !thief.crouching;
  const burden = clamp(1 - thief.weight * 0.07, 0.62, 1);
  const speed = (thief.crouching ? CROUCH_SPEED : thief.sprinting ? SPRINT_SPEED : WALK_SPEED) * burden;
  let dx = input.dx;
  let dy = input.dy;
  const len = Math.sqrt(dx * dx + dy * dy);
  thief.moving = len > 0.01 && !thief.grabbedBy;
  if (!thief.moving) return;
  dx /= len;
  dy /= len;
  thief.angle = Math.atan2(dy, dx);
  const nx = thief.x + dx * speed * dt;
  const ny = thief.y + dy * speed * dt;
  if (free(map, dial, nx, thief.y)) thief.x = nx;
  if (free(map, dial, thief.x, ny)) thief.y = ny;
  thief.stepT -= dt;
}

// Throws a coin toward (tx, ty), clamped to throwing range. The coin lands,
// waits a beat, then rings: guards in earshot come to look. Returns the coin
// object or null when the purse is empty.
export function throwCoin(thief, tx, ty) {
  if (thief.coins <= 0) return null;
  const d = dist(thief.x, thief.y, tx, ty);
  const reach = Math.min(d, 190);
  const a = Math.atan2(ty - thief.y, tx - thief.x);
  thief.coins -= 1;
  return {
    x: thief.x + Math.cos(a) * reach,
    y: thief.y + Math.sin(a) * reach,
    ringT: 0.45,   // time until the ring pulls eyes
    lifeT: 3.2,    // how long guards stay interested
    rung: false,
  };
}

// Picks up every un-looted spot the thief is standing on. Returns the list
// of spots taken this call so the game can chime and count.
export function grabLoot(thief, lootSpots) {
  const taken = [];
  for (const spot of lootSpots) {
    if (spot.taken) continue;
    if (dist(thief.x, thief.y, spot.x, spot.y) < 22) {
      spot.taken = true;
      const kind = LOOT_KINDS[spot.kind];
      thief.loot += kind.value;
      thief.weight += kind.weight;
      taken.push(spot);
    }
  }
  return taken;
}
