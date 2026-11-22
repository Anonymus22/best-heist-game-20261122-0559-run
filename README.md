# Midnight Ledger

[![Competition](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![Rank](https://make.fun/badge/best-heist-game-20261122-0559/Anonymus22/best-heist-game-20261122-0559-run/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![Reward](https://make.fun/badge/best-heist-game-20261122-0559/Anonymus22/best-heist-game-20261122-0559-run/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

A top-down 2D bank heist for the make.fun best-heist-game bounty. One bank,
one night, three phases: cross the lobby unseen, crack the vault dial while
the bank patrols around you, then run the loot to the getaway van. All art
is drawn in code on canvas and all sound is synthesized with WebAudio — no
external assets, no network.

## How to play

Serve `game/` with any static server (or run `node serve.ts`) and open
`game/index.html` in desktop Chrome.

**Phase 1 — Infiltrate.** Slip from the street through the lobby to the
vault door in the top-left. Guards patrol with vision cones that walls
clip; cameras sweep the halls. Crouch (C) to shrink your silhouette,
sprint (Shift) to cross open ground at the price of noise, and click to
throw a coin that pulls guards away from your path. Side stashes in the
archive and the manager's office are worth the detour.

**Phase 2 — Crack the vault.** Press E at the vault door and stop the
spinning needle inside the green zone with SPACE, once per tumbler. The
zone creeps, the needle speeds up and reverses after every lock, and every
slip raises the heat. The bank does not pause while you work.

**Phase 3 — Escape.** The vault opening trips the alarm. Guards converge
on the vault approach and the escape clock runs. Fill your pockets — cash
($500), gold ($1,500), gems ($3,000); the heavier the haul, the slower you
run — and reach the GETAWAY van on the street. If a guard grabs you, mash
SPACE to break free before his grip closes.

## Controls

- **WASD / arrow keys** — move
- **Shift** — sprint (fast, loud)
- **C** — crouch (slow, hard to see)
- **Mouse click** — throw a coin lure (3 per night)
- **E** — work the vault door
- **SPACE** — stop the dial needle / break a guard's grab
- **1 / 2 / 3** — difficulty on the title screen, **Enter** — begin

Score is the loot you carry out, plus a time bonus, plus a ghost bonus if
the alarm never tripped before the vault opened.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library.
- `game/src/constants.js` — difficulty ladder, loot values, math helpers.
- `game/src/bank.js` — the Meridian Bank floor plan and collision/sight tests.
- `game/src/vision.js` — vision cones and exposure.
- `game/src/guards.js` — guard AI (patrol / investigate / chase / return) and cameras.
- `game/src/thief.js` — movement, posture, coin lures, pockets.
- `game/src/dial.js` — the safe-cracking minigame.
- `game/src/audio.js` — synthesized WebAudio effects.
- `game/src/render.js` — all drawing, HUD and screens.
- `game/src/game.js` — phases, heat, the grab struggle, the main loop.
