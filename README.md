# Mobile Gameplay Prototypes: Chain Domino, Switch Rush & Caravan

A modular web-first mobile game prototype suite built with TypeScript, Vite, Phaser 3, and Vitest. Designed for rapid, unbiased evaluation of voluntary replay desire and core mechanic engagement on portrait mobile viewports.

---

## 🎮 Prototypes Overview

### 1. Game A — Chain Domino
- **Mechanic:** 5×5 grid puzzle where the player ignites directional arrow relays (`U, R, D, L`) or split relays (`H, V`). Pulses propagate exactly 1 orthogonal cell per tick.
- **Goal:** Collect all gold goals (`G`) within the allotted `maxIgnitions` (1 to 3).
- **Levels:** 10 fixed, solver-verified levels (`levels/chain/level_01.json` to `level_10.json`).
- **Scoring:** 100 per collected gold goal + 30 × unused ignition count on success.

### 2. Game B — Switch Rush
- **Mechanic:** Top-down railway sorting simulation. Vehicles spawn from `SOURCE` depot at 1400ms cadence and traverse one edge per 700ms simulation tick.
- **Route:** `SOURCE -> J1 -> J2/J3 -> [RED, BLUE, GREEN, YELLOW]`.
- **Player Input:** Tap junctions (`J1, J2, J3`) to toggle branches between incoming vehicles. Junctions cannot be toggled while a car is currently entering that junction.
- **Accessibility:** High-contrast color-blind letter badges (`R`, `B`, `G`, `Y`) on vehicles and stations.
- **Manifests:** 10 fixed scenarios (6 to 12 vehicles). 3 mistakes = game over.
- **Scoring:** 100 × correct deliveries + 25 × longest consecutive delivery streak.

### 3. Caravan (Preserved)
- **Mod B (Trade Chain):** Turn-based route planning before camel launch.
- **Mod C (Caravan Rush):** Real-time dynamic track rotation while caravan advances.

---

## 🛠️ Developer Setup & Commands

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
npm install
```

### Local Development Server
```bash
npm run dev
```

### Automated Unit & Smoke Tests
```bash
npm test
```
Runs the full Vitest suite covering pure state machines, reachability solvers, latched edge physics, and telemetry logging:
```
 ✓ tests/telemetry.test.ts (5 tests)
 ✓ tests/chain.test.ts (8 tests)
 ✓ tests/smoke.test.ts (2 tests)
 ✓ tests/switch.test.ts (9 tests)
 Total: 24 passed (24)
```

### Production Build
```bash
npm run build
```
Compiles TypeScript (`tsc`) and bundles optimized production assets into `dist/`.

### Preview Server
```bash
npx vite preview --port 4173
```

---

## 📁 Project Architecture

```
caravan/
├── chain_domino_switch_rush_GDD.md # Master Game Design Document
├── DECISIONS.md                    # Technical decisions and rule clarifications
├── LEVELS.md                       # 10 Level grids & solver-verified winning tap sequences
├── QA.md                           # Verification report, test logs & smoke test results
├── levels/
│   └── chain/                      # 10 fixed JSON level files (level_01.json .. level_10.json)
├── src/
│   ├── core/                       # Pure, deterministic state engines (zero DOM / zero Phaser)
│   │   ├── chain/                  # ChainBoard, ChainSolver, ChainLevels, ChainTypes
│   │   └── switch/                 # SwitchNetwork, SwitchSolver, SwitchTypes
│   ├── games/                      # Phaser 3 rendering layer
│   │   ├── ChainDominoScene.ts     # Crisp vector grid, pulse animation, modal overlays
│   │   └── SwitchRushScene.ts      # Top-down railway diagram, smooth interpolation, HUD
│   ├── shared/
│   │   └── Telemetry.ts            # Anonymous session logger, active play timer, JSON exporter
│   ├── audio/
│   │   └── SoundEffects.ts         # Pure Web Audio API procedural sound synthesizers
│   ├── ui/
│   │   ├── AppController.ts        # Top navigation tab switcher & scene coordinator
│   │   └── UIManager.ts            # Caravan DOM bindings and telemetry modal
│   └── main.ts                     # Phaser game bootstrap configuration
└── tests/                          # Automated Vitest test suite
    ├── chain.test.ts               # Chain Domino model, pulse & solver tests
    ├── switch.test.ts              # Switch Rush network, latching & queueing tests
    ├── telemetry.test.ts           # Telemetry logging & visibility blur tests
    └── smoke.test.ts               # End-to-end integration & voluntary replay tests
```

---

## 📊 Telemetry & Playtest Data

In accordance with strict GDD requirements:
- No remote upload, no PII, no user accounts, no tracking cookies.
- Monotonic elapsed run time and active play duration (background tab blur duration automatically deducted).
- Logs `first_tap` latency, `valid_move`, `invalid_tap`, `run_won`, `run_lost`, `replay_clicked` (voluntary restart), `exit_clicked`.
- Built-in JSON export: testers can download `.json` logs or copy to clipboard via the in-game Telemetry modal.
