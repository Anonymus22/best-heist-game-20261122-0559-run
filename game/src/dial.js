// Midnight Ledger - the safe dial: a needle sweeps the dial and the thief
// must stop it inside the brass zone, once per tumbler. Each lock spins the
// needle faster and flips its direction, so muscle memory betrays you.

export function createDial(diff) {
  return {
    needle: 0,                    // radians around the dial
    speed: diff.dialSpeed,
    direction: 1,
    zoneCenter: 1.2,
    zoneHalf: ((diff.dialWindowDeg * Math.PI) / 180) / 2,
    tumblers: 0,
    tumblersNeeded: 3,
    open: false,                  // the modal is on screen
    cracked: false,
    flash: null,                  // 'lock' | 'slip' | null, shown briefly
    flashT: 0,
    diff,
  };
}

// Opens the modal with a fresh set of tumblers and a first zone.
export function dialBegin(dial, rng) {
  dial.open = true;
  dial.cracked = false;
  dial.tumblers = 0;
  dial.needle = 0;
  dial.direction = 1;
  dial.speed = dial.diff.dialSpeed;
  dial.flash = null;
  dial.zoneCenter = rng() * Math.PI * 2;
}

// Advances the needle; the zone itself creeps, so waiting is not free.
export function dialUpdate(dial, dt) {
  if (!dial.open || dial.cracked) return;
  dial.needle += dial.speed * dial.direction * dt;
  if (dial.needle > Math.PI * 2) dial.needle -= Math.PI * 2;
  if (dial.needle < 0) dial.needle += Math.PI * 2;
  dial.zoneCenter += 0.12 * dt;
  if (dial.zoneCenter > Math.PI * 2) dial.zoneCenter -= Math.PI * 2;
  if (dial.flash) {
    dial.flashT -= dt;
    if (dial.flashT <= 0) dial.flash = null;
  }
}

// The thief commits: SPACE stops the needle where it stands.
// Returns 'lock', 'slip' or null when the dial is not live.
export function dialAttempt(dial, rng) {
  if (!dial.open || dial.cracked || dial.flash) return null;
  let d = dial.needle - dial.zoneCenter;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= dial.zoneHalf) {
    dial.tumblers += 1;
    dial.flash = 'lock';
    dial.flashT = 0.5;
    dial.speed += 0.5;
    dial.direction = -dial.direction;
    dial.zoneCenter = rng() * Math.PI * 2;
    if (dial.tumblers >= dial.tumblersNeeded) {
      dial.cracked = true;
      dial.open = false;
    }
    return 'lock';
  }
  dial.flash = 'slip';
  dial.flashT = 0.5;
  dial.zoneCenter = rng() * Math.PI * 2;
  return 'slip';
}
