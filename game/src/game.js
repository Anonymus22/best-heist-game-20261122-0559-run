// Midnight Ledger - the game itself: phases, heat, the grab struggle, the
// score, input, the main loop, and the deterministic ?shot= staging the
// screenshots are taken from. The other modules are the bank, the eyes, the
// hands and the dial; this one is the night they all share.

import { PHASE, DIFFICULTY, clamp, dist } from './constants.js';
import { buildBank, insideVault } from './bank.js';
import { createThief, moveThief, throwCoin, grabLoot } from './thief.js';
import { createGuards, createCameras, updateGuards, updateCameras, sendToLook } from './guards.js';
import { strongestSignal } from './vision.js';
import { createDial, dialBegin, dialUpdate, dialAttempt } from './dial.js';
import { wakeAudio, sfx } from './audio.js';
import { drawGame } from './render.js';
import { makeRng } from './constants.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) >>> 0;

// A whole run's state, rebuilt from scratch on every (re)start.
function createGame(difficultyKey) {
  const diff = DIFFICULTY[difficultyKey];
  const rng = makeRng(seed);
  const map = buildBank(diff);
  const game = {
    difficultyKey,
    difficulty: diff,
    map,
    thief: createThief(map.spawn),
    guards: [],
    cameras: [],
    dial: createDial(diff),
    coins: [],
    phase: PHASE.TITLE,
    heat: 0,
    timeLeft: diff.timeLimit,
    time: 0,
    alarmTripped: false,
    grab: null,
    score: null,
    lostReason: '',
    hint: '',
    rng,
    world: null,
  };
  game.guards = createGuards(map, diff);
  game.cameras = createCameras(map, diff, rng);
  game.world = { map, thief: game.thief, diff, alarmRaised: false };
  return game;
}

let game = createGame('normal');
Object.defineProperty(window, '__ledger', { get: () => game });

// ---------------------------------------------------------------- input
const keys = new Set();
let interactQueued = false;
let spaceQueued = false;

addEventListener('keydown', (e) => {
  wakeAudio();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.key.toLowerCase());
  if (e.key === 'Enter') onEnter();
  if (e.key === '1' || e.key === '2' || e.key === '3') {
    if (game.phase === PHASE.TITLE) {
      game = createGame(['easy', 'normal', 'hard'][Number(e.key) - 1]);
    }
  }
  if (e.key.toLowerCase() === 'e') interactQueued = true;
  if (e.key === ' ') spaceQueued = true;
  if (e.key === 'Escape' && game.phase === PHASE.CRACKING) {
    game.dial.open = false;
    game.phase = PHASE.INFILTRATE;
  }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousedown', (e) => {
  wakeAudio();
  if (game.phase !== PHASE.INFILTRATE && game.phase !== PHASE.ESCAPE) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const coin = throwCoin(game.thief, x, y);
  if (coin) game.coins.push(coin);
});

function onEnter() {
  if (game.phase === PHASE.TITLE) {
    const key = game.difficultyKey;
    game = createGame(key);
    game.phase = PHASE.INFILTRATE;
  } else if (game.phase === PHASE.WON || game.phase === PHASE.LOST) {
    game = createGame('normal');
  }
}

function readInput() {
  let dx = 0;
  let dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  return {
    dx,
    dy,
    crouch: keys.has('c') || keys.has('control'),
    sprint: keys.has('shift'),
  };
}

// ---------------------------------------------------------------- phases
function lose(reason) {
  game.phase = PHASE.LOST;
  game.lostReason = reason;
  sfx.caught();
}

function win() {
  const timeBonus = Math.round(game.timeLeft) * 10;
  const ghostBonus = game.alarmTripped ? 0 : 1500;
  game.score = {
    loot: game.thief.loot,
    timeBonus,
    ghostBonus,
    total: game.thief.loot + timeBonus + ghostBonus,
  };
  game.phase = PHASE.WON;
  sfx.win();
}

function startEscape() {
  game.phase = PHASE.ESCAPE;
  game.timeLeft = game.difficulty.escapeTime;
  game.heat = Math.max(game.heat, 35);
  game.alarmTripped = true;
  sfx.alarm();
  for (const g of game.guards) sendToLook(g, game.map.vault.doorX + 18, game.map.vault.doorY + 30);
}

// The shared heat meter: the loudest pair of eyes drives it up, quiet
// moments let it bleed away. Cameras that trip dump a spike into it.
function updateHeat(dt) {
  const signal = strongestSignal(game.map, game.guards, game.cameras, game.thief);
  if (signal > 0) {
    game.heat = clamp(game.heat + signal * 16 * game.difficulty.detectRate * dt, 0, 100);
  } else {
    const floor = game.phase === PHASE.ESCAPE && game.alarmTripped ? 25 : 0;
    game.heat = clamp(game.heat - game.difficulty.heatDecay * dt, floor, 100);
  }
  for (const c of game.cameras) {
    if (c.tripped) {
      c.tripped = false;
      c.meter = 0.4;
      game.heat = clamp(game.heat + 26, 0, 100);
      game.alarmTripped = true;
      sfx.alarm();
      const sorted = [...game.guards].sort(
        (a, b) => dist(a.x, a.y, game.thief.x, game.thief.y) - dist(b.x, b.y, game.thief.x, game.thief.y),
      );
      sendToLook(sorted[0], game.thief.x, game.thief.y);
      if (sorted[1]) sendToLook(sorted[1], game.thief.x, game.thief.y);
    }
  }
  if (game.world.alarmRaised) {
    game.world.alarmRaised = false;
    game.alarmTripped = true;
    game.heat = Math.max(game.heat, 55);
    sfx.alarm();
  }
}

// The grab: a chasing guard who reaches the thief holds on for a moment;
// mashing SPACE tears free at the cost of heat and a stunned guard.
function updateGrab(dt) {
  if (!game.grab) {
    for (const g of game.guards) {
      if (g.grabbing) {
        game.grab = { guard: g, escape: 0, needed: 6, t: 1.15 };
        game.thief.grabbedBy = g;
        break;
      }
    }
    return;
  }
  const grab = game.grab;
  grab.t -= dt;
  if (spaceQueued) {
    grab.escape += 1;
    spaceQueued = false;
  }
  if (grab.escape >= grab.needed) {
    grab.guard.stunT = 2.2;
    grab.guard.grabbing = false;
    grab.guard.suspicion = 0.4;
    grab.guard.state = 'return';
    game.thief.grabbedBy = null;
    game.grab = null;
    game.heat = clamp(game.heat + 20, 0, 100);
  } else if (grab.t <= 0) {
    lose('Caught red-handed in the Meridian Bank.');
  }
}

function updateCoins(dt) {
  game.coins = game.coins.filter((coin) => {
    coin.lifeT -= dt;
    if (!coin.rung) {
      coin.ringT -= dt;
      if (coin.ringT <= 0) {
        coin.rung = true;
        sfx.coin();
        for (const g of game.guards) {
          if (dist(g.x, g.y, coin.x, coin.y) < 175) sendToLook(g, coin.x, coin.y);
        }
      }
    }
    return coin.lifeT > 0;
  });
}

function updatePlay(dt) {
  game.time += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    lose(game.phase === PHASE.ESCAPE ? 'The van left without you.' : 'Lockdown — the bank sealed itself.');
    return;
  }
  if (!game.grab) moveThief(game.map, game.dial, game.thief, readInput(), dt);
  const taken = grabLoot(game.thief, game.map.lootSpots);
  if (taken.length) sfx.pickup();
  // Sprinting is loud: nearby guards come to look at the noise.
  if (game.thief.sprinting && game.thief.moving) {
    for (const g of game.guards) {
      if (dist(g.x, g.y, game.thief.x, game.thief.y) < 72) sendToLook(g, game.thief.x, game.thief.y);
    }
  }
  updateCoins(dt);
  updateGuards(game.world, game.guards, dt);
  updateCameras(game.world, game.cameras, dt);
  updateHeat(dt);
  updateGrab(dt);

  const t = game.thief;
  const door = game.map.doorZone;
  const atDoor = t.x > door.x && t.x < door.x + door.w && t.y > door.y && t.y < door.y + door.h;
  if (game.phase === PHASE.INFILTRATE) {
    game.hint = atDoor
      ? 'E — work the vault door'
      : 'Cross the lobby to the VAULT door (top-left). Stay out of the cones.';
    if (atDoor && interactQueued) {
      interactQueued = false;
      game.phase = PHASE.CRACKING;
      dialBegin(game.dial, game.rng);
    }
  } else if (game.phase === PHASE.ESCAPE) {
    game.hint = insideVault(game.map, t.x, t.y)
      ? 'Grab the loot, then run for the GETAWAY van.'
      : 'Get to the GETAWAY van on the street!';
    const van = game.map.van;
    if (t.x > van.x - 4 && t.x < van.x + van.w + 4 && t.y > van.y - 4 && t.y < van.y + van.h + 4) win();
  }
  interactQueued = false;
}

function updateCracking(dt) {
  game.time += dt;
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    lose('Lockdown — the bank sealed itself.');
    return;
  }
  dialUpdate(game.dial, dt);
  if (spaceQueued) {
    spaceQueued = false;
    const result = dialAttempt(game.dial, game.rng);
    if (result === 'lock') sfx.lock();
    if (result === 'slip') {
      game.heat = clamp(game.heat + game.difficulty.heatPerMiss, 0, 100);
      sfx.slip();
    }
  }
  // The bank does not pause while the thief works the dial.
  updateGuards(game.world, game.guards, dt);
  updateCameras(game.world, game.cameras, dt);
  updateHeat(dt);
  updateGrab(dt);
  if (game.grab) {
    game.dial.open = false;
    game.phase = PHASE.INFILTRATE;
    return;
  }
  if (game.dial.cracked) startEscape();
}

function update(dt) {
  spaceQueued = spaceQueued && (game.phase === PHASE.CRACKING || !!game.grab);
  if (game.phase === PHASE.INFILTRATE || game.phase === PHASE.ESCAPE) updatePlay(dt);
  else if (game.phase === PHASE.CRACKING) updateCracking(dt);
  else if (game.phase === PHASE.TITLE) {
    updateGuards(game.world, game.guards, dt);
    updateCameras(game.world, game.cameras, dt);
  }
}

// ---------------------------------------------------------------- staging
// Deterministic states for the screenshots: the same seed always stages the
// same night, so the maker's screenshots are reproducible renders.
function stageShot(name) {
  game = createGame('normal');
  const step = (n) => {
    for (let i = 0; i < n; i++) update(1 / 60);
  };
  if (name === 'play') {
    game.phase = PHASE.INFILTRATE;
    game.thief.x = 395;
    game.thief.y = 345;
    step(140);
    // Volatile values are staged after the steps so the frame is exact.
    game.thief.crouching = true;
    game.heat = 18;
    game.timeLeft = 231;
  } else if (name === 'safe') {
    game.thief.x = 222;
    game.thief.y = 205;
    step(120);
    game.phase = PHASE.CRACKING;
    dialBegin(game.dial, game.rng);
    game.dial.tumblers = 1;
    game.dial.needle = game.dial.zoneCenter - game.dial.zoneHalf * 0.35;
    game.heat = 30;
    game.timeLeft = 187;
  } else if (name === 'escape') {
    game.phase = PHASE.ESCAPE;
    game.alarmTripped = true;
    for (const spot of game.map.lootSpots) {
      if (spot.x < 320 && spot.y < 190) spot.taken = true;
    }
    game.thief.loot = 8500;
    game.thief.weight = 8;
    game.thief.x = 520;
    game.thief.y = 430;
    step(90);
    const g = game.guards[0];
    g.x = 612;
    g.y = 372;
    g.state = 'chase';
    g.suspicion = 1;
    g.angle = Math.atan2(game.thief.y - g.y, game.thief.x - g.x);
    game.phase = PHASE.ESCAPE;
    game.heat = 62;
    game.timeLeft = 47;
  } else if (name === 'end') {
    game.thief.loot = 8500;
    game.thief.x = game.map.van.x + 50;
    game.thief.y = game.map.van.y + 14;
    game.score = { loot: 8500, timeBonus: 470, ghostBonus: 0, total: 8970 };
    game.phase = PHASE.WON;
  } else {
    game.phase = PHASE.INFILTRATE;
    step(120);
  }
  drawGame(ctx, game);
  window.__shotReady = true;
}

// ---------------------------------------------------------------- boot
const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName);
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    update(dt);
    drawGame(ctx, game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
