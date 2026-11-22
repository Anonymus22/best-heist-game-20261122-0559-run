// Midnight Ledger - the Meridian Bank floor plan: one map for all three
// phases. Walls block sight and movement; low cover blocks movement only, so
// a crouched thief behind a teller counter is hidden by distance, not magic.

import { WORLD_W, WORLD_H, segmentHitsRect, circleHitsRect } from './constants.js';

function wall(x, y, w, h) {
  return { x, y, w, h };
}

// Builds the full map for a difficulty: geometry, rooms, the vault, loot
// spots, patrol routes and camera mounts.
export function buildBank(difficulty) {
  const T = 14; // wall thickness
  const walls = [];

  // Outer shell; the bottom wall leaves a gap at the street entrance.
  walls.push(wall(0, 0, WORLD_W, T));
  walls.push(wall(0, 0, T, WORLD_H));
  walls.push(wall(WORLD_W - T, 0, T, WORLD_H));
  walls.push(wall(0, WORLD_H - T, 420, T));
  walls.push(wall(512, WORLD_H - T, WORLD_W - 512, T));

  // The bank facade at y = 566, its door gap aligned with the street gap.
  walls.push(wall(T, 566, 406, T));
  walls.push(wall(512, 566, WORLD_W - 512 - T, T));

  // Vault room, top-left: x 14..314, y 14..186, door gap x 204..240 south.
  walls.push(wall(300, 14, T, 172));
  walls.push(wall(14, 172, 190, T));
  walls.push(wall(240, 172, 74, T));

  // Security room, top-right: x 646..946, y 14..186, door gap x 806..842.
  walls.push(wall(646, 14, T, 172));
  walls.push(wall(646, 172, 160, T));
  walls.push(wall(842, 172, 104, T));

  // Archive, bottom-left: x 14..254, y 386..566, door gap x 154..190 north.
  walls.push(wall(240, 386, T, 180));
  walls.push(wall(14, 386, 140, T));
  walls.push(wall(190, 386, 64, T));

  // Manager office, bottom-right: x 700..946, y 360..566, gap x 820..856.
  walls.push(wall(700, 360, T, 206));
  walls.push(wall(700, 360, 120, T));
  walls.push(wall(856, 360, 90, T));

  // Lobby furniture that stops feet: teller counters and two pillars.
  walls.push(wall(350, 300, 110, 24));
  walls.push(wall(560, 300, 110, 24));
  walls.push(wall(330, 440, 24, 54));
  walls.push(wall(606, 440, 24, 54));
  walls.push(wall(430, 238, 100, 20));

  // Low cover inside the rooms: desks and archive shelves.
  const cover = [
    wall(60, 60, 70, 22),     // vault clerk desk
    wall(760, 60, 90, 26),    // security desk
    wall(790, 440, 90, 28),   // manager desk
    wall(50, 450, 120, 20),   // archive shelf
    wall(50, 510, 120, 20),   // archive shelf
  ];
  for (const c of cover) walls.push(c);

  const rooms = [
    { name: 'VAULT', x: 28, y: 24, w: 258, h: 138 },
    { name: 'SECURITY', x: 660, y: 24, w: 272, h: 138 },
    { name: 'LOBBY', x: 268, y: 196, w: 424, h: 356 },
    { name: 'ARCHIVE', x: 28, y: 396, w: 198, h: 156 },
    { name: 'MANAGER', x: 714, y: 374, w: 218, h: 178 },
    { name: 'STREET', x: 14, y: 580, w: 932, h: 40 },
  ];

  // The vault block itself: the steel safe stands against the north wall.
  const vault = {
    safeX: 157, safeY: 66,
    doorX: 204, doorY: 172, doorW: 36, doorH: 14,
    room: { x: 14, y: 14, w: 300, h: 172 },
  };

  // Loot: the vault hoard plus two side stashes worth the detour.
  const lootSpots = [
    { kind: 'cash', x: 70, y: 130 },
    { kind: 'cash', x: 252, y: 130 },
    { kind: 'gold', x: 84, y: 44 },
    { kind: 'gold', x: 236, y: 44 },
    { kind: 'gems', x: 157, y: 128 },
    { kind: 'cash', x: 205, y: 528 },  // archive stash
    { kind: 'gold', x: 880, y: 520 },  // manager stash
  ];

  // Guard patrol loops: lobby ring, west hall, vault approach, east hall,
  // and the short security-to-manager beat used on hard.
  const patrols = [
    [{ x: 330, y: 252 }, { x: 640, y: 252 }, { x: 640, y: 520 }, { x: 330, y: 520 }],
    [{ x: 272, y: 240 }, { x: 272, y: 540 }, { x: 480, y: 540 }],
    [{ x: 160, y: 222 }, { x: 480, y: 222 }, { x: 480, y: 420 }, { x: 160, y: 420 }],
    [{ x: 688, y: 240 }, { x: 688, y: 520 }, { x: 500, y: 520 }, { x: 500, y: 240 }],
    [{ x: 862, y: 222 }, { x: 862, y: 330 }, { x: 724, y: 330 }],
  ];

  // Camera mounts: position, the angle they sweep around, sweep half-width.
  const cameraDefs = [
    { x: 480, y: 190, baseAngle: Math.PI / 2, sweep: 0.8 },
    { x: 160, y: 200, baseAngle: Math.PI / 2, sweep: 0.65 },
    { x: 800, y: 200, baseAngle: Math.PI / 2, sweep: 0.65 },
    { x: 466, y: 600, baseAngle: -Math.PI / 2, sweep: 0.7 },
  ];

  return {
    walls,
    rooms,
    vault,
    lootSpots,
    patrols,
    cameraDefs: cameraDefs.slice(0, difficulty.cameras),
    spawn: { x: 466, y: 606 },
    van: { x: 416, y: 592, w: 100, h: 28 },
    doorZone: { x: 196, y: 158, w: 52, h: 42 },
    difficulty,
  };
}

// True when a circle of radius r at (x, y) overlaps any wall or cover.
export function hitsSolid(map, x, y, r) {
  for (const w of map.walls) {
    if (circleHitsRect(x, y, r, w)) return true;
  }
  return x - r < 0 || x + r > WORLD_W || y - r < 0 || y + r > WORLD_H;
}

// True when the straight line between two points crosses a wall.
export function lineBlocked(map, x1, y1, x2, y2) {
  for (const w of map.walls) {
    if (segmentHitsRect(x1, y1, x2, y2, w)) return true;
  }
  return false;
}

// True when the point stands inside the vault room.
export function insideVault(map, x, y) {
  const v = map.vault.room;
  return x > v.x && x < v.x + v.w && y > v.y && y < v.y + v.h;
}
