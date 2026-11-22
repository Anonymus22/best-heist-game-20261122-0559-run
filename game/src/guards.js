// Midnight Ledger - the opposition: patrol guards with a four-state brain
// (patrol, investigate, chase, return) and the sweeping cameras that feed
// them. A guard who only glimpses something comes to look; a guard whose
// suspicion tops out gives chase and lays hands on the thief.

import { clamp, dist, angleDiff, turnToward } from './constants.js';
import { hitsSolid } from './bank.js';
import { GUARD_SIGHT, CAMERA_SIGHT, exposure } from './vision.js';

const PATROL_SPEED = 62;
const INVESTIGATE_SPEED = 98;
const CHASE_SPEED = 131;
const GUARD_RADIUS = 11;

export function createGuards(map, diff) {
  const guards = [];
  for (let i = 0; i < diff.guards; i++) {
    const route = map.patrols[i % map.patrols.length];
    const start = route[0];
    guards.push({
      x: start.x,
      y: start.y,
      angle: Math.atan2(route[1].y - start.y, route[1].x - start.x),
      route,
      routeIdx: 1,
      state: 'patrol',
      suspicion: 0,
      waitT: 0,
      lookT: 0,
      targetX: start.x,
      targetY: start.y,
      lastSeenX: start.x,
      lastSeenY: start.y,
      loseT: 0,
      stunT: 0,
      grabbing: false,
    });
  }
  return guards;
}

export function createCameras(map, diff, rng) {
  return map.cameraDefs.map((def) => ({
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    angle: def.baseAngle,
    phase: rng() * Math.PI * 2,
    meter: 0,
    tripped: false,
    diff,
  }));
}

// Slides a guard toward a point, axis-separated like the thief's movement.
function stepGuard(map, g, tx, ty, speed, dt) {
  const d = dist(g.x, g.y, tx, ty);
  if (d < 2) return true;
  const dx = (tx - g.x) / d;
  const dy = (ty - g.y) / d;
  const nx = g.x + dx * speed * dt;
  const ny = g.y + dy * speed * dt;
  if (!hitsSolid(map, nx, g.y, GUARD_RADIUS)) g.x = nx;
  if (!hitsSolid(map, g.x, ny, GUARD_RADIUS)) g.y = ny;
  g.angle = turnToward(g.angle, Math.atan2(dy, dx), 6 * dt);
  return dist(g.x, g.y, tx, ty) < 6;
}

// Sends a guard to look at a point: a coin's ring or a half-seen shape.
export function sendToLook(g, x, y) {
  if (g.state === 'chase' || g.stunT > 0) return;
  g.state = 'investigate';
  g.targetX = x;
  g.targetY = y;
  g.lookT = 0;
}

export function updateGuards(world, guards, dt) {
  const { map, thief, diff } = world;
  for (const g of guards) {
    if (g.stunT > 0) {
      g.stunT -= dt;
      g.grabbing = false;
      continue;
    }
    // Perception: suspicion fills while the thief is in the cone, drains
    // when he is not. A full meter means the guard is sure.
    const signal = exposure(map, g.x, g.y, g.angle, GUARD_SIGHT, thief);
    if (signal > 0) {
      g.suspicion = clamp(g.suspicion + signal * diff.detectRate * dt * 1.5, 0, 1);
      g.lastSeenX = thief.x;
      g.lastSeenY = thief.y;
      g.loseT = 0;
      if (g.suspicion >= 1 && g.state !== 'chase') {
        g.state = 'chase';
        world.alarmRaised = true;
      } else if (g.suspicion > 0.35 && g.state === 'patrol') {
        sendToLook(g, thief.x, thief.y);
      }
    } else {
      g.suspicion = clamp(g.suspicion - 0.25 * dt, 0, 1);
      g.loseT += dt;
    }

    if (g.state === 'patrol') {
      const wp = g.route[g.routeIdx];
      if (g.waitT > 0) {
        g.waitT -= dt;
      } else if (stepGuard(map, g, wp.x, wp.y, PATROL_SPEED, dt)) {
        g.routeIdx = (g.routeIdx + 1) % g.route.length;
        g.waitT = 0.7;
      }
    } else if (g.state === 'investigate') {
      if (stepGuard(map, g, g.targetX, g.targetY, INVESTIGATE_SPEED, dt)) {
        g.lookT += dt;
        g.angle += 1.9 * dt; // scanning the room
        if (g.lookT > 1.6) {
          g.state = 'return';
          g.suspicion = Math.min(g.suspicion, 0.3);
        }
      }
    } else if (g.state === 'return') {
      const wp = g.route[g.routeIdx];
      if (stepGuard(map, g, wp.x, wp.y, INVESTIGATE_SPEED, dt)) g.state = 'patrol';
    } else if (g.state === 'chase') {
      const target = signal > 0 ? thief : { x: g.lastSeenX, y: g.lastSeenY };
      stepGuard(map, g, target.x, target.y, CHASE_SPEED, dt);
      if (signal > 0 && dist(g.x, g.y, thief.x, thief.y) < 19) {
        g.grabbing = true;
      } else {
        g.grabbing = false;
      }
      if (g.loseT > 2.5) {
        g.state = 'investigate';
        g.targetX = g.lastSeenX;
        g.targetY = g.lastSeenY;
        g.lookT = 0;
        g.suspicion = 0.6;
      }
    }
  }
}

// Cameras sweep on a sine; a full meter trips once: the game spikes the heat
// and sends the nearest guards to the thief's position.
export function updateCameras(world, cameras, dt) {
  const { map, thief, diff } = world;
  for (const c of cameras) {
    c.phase += diff.cameraSpeed * dt;
    c.angle = c.baseAngle + Math.sin(c.phase) * c.sweep;
    const signal = exposure(map, c.x, c.y, c.angle, CAMERA_SIGHT, thief);
    if (signal > 0) {
      c.meter = clamp(c.meter + signal * diff.detectRate * dt * 1.2, 0, 1);
      if (c.meter >= 1 && !c.tripped) c.tripped = true;
    } else {
      c.meter = clamp(c.meter - 0.35 * dt, 0, 1);
    }
  }
}

// The loudest guard suspicion, for the HUD's per-guard "!" markers.
export function loudestSuspicion(guards) {
  let best = 0;
  for (const g of guards) if (g.suspicion > best) best = g.suspicion;
  return best;
}

export { GUARD_SIGHT, CAMERA_SIGHT };
