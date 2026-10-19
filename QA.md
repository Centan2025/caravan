# QA and Verification Report: Chain Domino & Switch Rush

**Date:** 2026-10-17  
**Test Suite:** Vitest v5.0.5  
**Engine:** Phaser 3 + TypeScript  
**Build Target:** Vite v6.4.4  

---

## 1. Automated Test Results

The test suite was run via `npm test` (`vitest run`). All 30 tests passed across 4 test suites.

```
 RUN  v5.0.5 C:/Users/ASUS/.gemini/antigravity/scratch/caravan

 ✓ tests/telemetry.test.ts (5 tests) 5ms
   ✓ Generates a non-empty anonymous session id
   ✓ Logs run_started, valid_move, and tracks first_tap automatically
   ✓ Records invalid_tap without spending valid move
   ✓ Exports valid JSON with session_id and event log
   ✓ Logs replay_clicked and exit_clicked with intentional flag

 ✓ tests/switch.test.ts (13 tests) 9ms
   ✓ J1/J2/J3 have correct default states and toggle deterministically
   ✓ Correct vehicle appears in manifest order; no unexpected spawns
   ✓ Route latch at departure prevents retroactive changes
   ✓ Source waiting and downstream queuing do not lose or overlap vehicles
   ✓ Correct/wrong stations score accurately; third error triggers loss
   ✓ Manifest exhaustion plus all vehicles resolved triggers a win if mistakes <= 2
   ✓ Pausing freezes movement and spawn clock
   ✓ All 10 manifests can be delivered perfectly by simulated omniscient controller
   ✓ All 10 fixed manifests match GDD exact specifications
   ✓ All 30 progressive levels are verified solvable with 0 mistakes by omniscient solver
   ✓ All 5 districts have exactly 6 levels and district metadata is valid
   ✓ Progressive levels ramp difficulty incrementally without jumping all variables at once
   ✓ Inactive junctions reject toggle attempts while active ones toggle successfully

 ✓ tests/chain.test.ts (8 tests) 9ms
   ✓ Pulse moves exactly one orthogonal neighbor per tick
   ✓ Walls, empty cells, and off-board pulses terminate cleanly
   ✓ H and V split relays emit two pulses; activated cells trigger at most once
   ✓ Closed loops terminate; simultaneous incoming pulses do not double-trigger
   ✓ Tapping goal, wall, or activated relay is invalid and does not consume ignitions
   ✓ Gold completion and ignition exhaustion are mutually resolved correctly
   ✓ Automatic exhaustive solver validates all 10 boards as solvable
   ✓ Levels 2-10 have at least one losing opening tap and level 1 is introductory

 ✓ tests/smoke.test.ts (4 tests) 6ms
   ✓ Simulates complete gameplay of Level 1 from tap to win with telemetry
   ✓ Simulates complete gameplay of Scenario 1 with junction toggles and victory
   ✓ Simulates Switch Rush 2.0 Level 1 Suburb onboarding flow with single vehicle and telemetry
   ✓ Ensures level transitions instantiate independent boards without side effects

 Test Files  4 passed (4)
      Tests  30 passed (30)
   Start at  23:29:23
   Duration  162ms (transform 53%, import 23%, tests 16%, worker 8%)
```

---

## 2. Production Build Verification

Executed `npm run build` (`tsc && vite build`).

```
> caravan@1.0.0 build
> tsc && vite build

vite v6.4.4 building for production...
transforming...
✓ 24 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   16.32 kB │ gzip:   4.16 kB
dist/assets/index-C6reZ3-l.js  1,575.95 kB │ gzip: 364.07 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 2.85s
```

Result: **Clean production build with zero TypeScript compiler errors.**

---

## 3. Mobile Touch & Usability Verification

| Item | Requirement | Verification Result | Status |
| :--- | :--- | :--- | :--- |
| **Viewport Scaling** | Portrait 540×960 scaled down to 320px width without layout breakage | `Phaser.Scale.FIT` with `autoCenter: CENTER_BOTH` maintains full aspect ratio and touch coordinate translation across mobile viewports. | **PASS** |
| **Touch Targets (Chain Domino)** | Thumb-friendly clickable cells | Cells are 76×76px with 6px gap. Hit area exceeds minimum 48px touch target guidelines. | **PASS** |
| **Touch Targets (Switch Rush)** | Thumb-friendly junction toggles | Circular touch interaction hitboxes for `J1, J2, J3` are 80×80px containers. | **PASS** |
| **Color-Blind Accessibility** | Non-color reliance for Switch Rush routing | Every vehicle and destination depot features prominent, high-contrast labels `R` (Red), `B` (Blue), `G` (Green), `Y` (Yellow). | **PASS** |
| **No Auto-Advance** | Never automatically skip victory/loss screens to preserve voluntary replay signal | Explicit `Play again` (`🔄 Yeniden Oyna`) and `Next Level` buttons required to proceed. Voluntary replays are tagged with `intentional: true`. | **PASS** |
| **Input Locking During Simulation** | No inputs allowed while pulses travel or when cars enter junctions | Chain Domino locks input during `isSimulatingStep`. Switch Rush locks junction toggle only when a car is in the same tick entering that junction (`isJunctionLocked`). | **PASS** |
| **Audio Synthesis** | No external missing audio assets | Procedural Web Audio API sound generator (`SoundEffects.ts`) synthesizes rotation clicks, bell chimes, victory fanfare, and error buzzers. | **PASS** |

---

## 4. Telemetry and Data Collection Verification

1. **Monotonic Active Play Time:** Focus and blur events on the window and document are tracked. Time spent in background or when blurred is deducted from `active_play_ms`.
2. **First Tap Latency:** Recorded on the very first touch following `run_started`.
3. **Invalid Taps:** Ineligible touches (empty cells, walls, already activated relays, locked junctions, busy simulation) are tracked without spending moves.
4. **Local Data Export:** LocalStorage persists up to 2000 events. The Telemetry modal renders event distribution and provides one-click `JSON Download` and `Copy JSON` functionality with zero remote server dependency.

---

## 5. Known Limitations & Technical Observations

1. **Phaser Bundle Chunk Size:** Vite issues a warning that `index-C6reZ3-l.js` exceeds 500 kB due to Phaser 3 being bundled in a single vendor chunk. While standard for Phaser web games, code-splitting via Rollup dynamic imports can be considered for future optimization if load times on 3G networks are tested.
2. **Web Audio Context Autoplay Policy:** On modern mobile browsers (Safari/Chrome), Web Audio requires a user gesture before unmuting. The sound system gracefully initializes and resumes its `AudioContext` upon the user's first tap.
3. **High-Density Manifests in Switch Rush:** In scenarios 7–10, vehicles spawn in dense intervals (1400ms). While the omniscient controller solver proves 100% reachability without errors, human reaction windows are tight (~700ms between arrivals).
4. **Cross-Game Level Switch Isolation (Resolved):** Previously, `UIManager` held a direct `change` listener on the shared `#level-select` element, causing Caravan's `GameScene.setLevel()` to restart on top of Chain Domino or Switch Rush when changing levels. This was resolved by centralizing level selection routing inside `AppController.onLevelSelected()` with strict active scene checks, removing the duplicate listener from `UIManager`, and preventing any cross-scene rendering leaks.

---

## 6. Impartial Playtest Assessment

In accordance with strict testing standards:
- **Game A (Chain Domino)** provides a discrete, cerebral puzzle loop with clear anticipation and low motor pressure.
- **Game B (Switch Rush Classic)** provides a continuous, high-urgency reactive loop with high cognitive load.
- **Switch Rush 2.0 (Parcel Express)** expands Switch Rush with 30 calibrated levels, 5 distinct visual diorama themes, 1-second preparation cues, and a gentle onboarding ramp (`maxConcurrentVehicles = 1` in early levels).
- **Verdict:** No premature verdict is rendered regarding which version or game is "more fun." Both versions (`Classic` and `2.0`) are independently selectable, fully playable, and collect identical telemetry metrics so player preference and voluntary replay desire can be objectively compared from empirical test data.

---

## 7. Switch Rush 2.0 Verification Summary

| Feature | Verification Method | Result |
| :--- | :--- | :--- |
| **All 30 Levels Winnable** | `SwitchSolver.verifyProgressiveLevels()` automatic omniscient solver | **100% PASS** (30/30 levels solved with 0 mistakes) |
| **5 Districts & Level Families** | Unit test verifying 6 levels per district & mastery finale | **PASS** (Suburb, Downtown, Industrial, Harbor, Night Express) |
| **Controlled Difficulty Ramp** | Levels 1–5 enforce `maxConcurrentVehicles = 1`, 1000–900ms tick | **PASS** (Wide reaction window for onboarding) |
| **1-Second Preparation Cue** | Radar ring and label at SOURCE depot before vehicle departure | **PASS** (Visual countdown indicator rendered) |
| **Path Preview (Illuminated Route)** | Dynamic route tracing from SOURCE to aligned station | **PASS** (Glow line indicates active track) |
| **Premium Toy City Diorama** | 5 district backgrounds with miniature props outside track bounds | **PASS** (Zero track/vehicle occlusion) |
| **Parcel Express Narrative** | Thematic district unlock modal with single-click dismiss | **PASS** (Non-intrusive, skippable) |
| **Classic Mode Preservation** | 10 original GDD manifests selectable under `⚡ Classic` | **PASS** (Zero regression to original rules) |
| **Chain Domino & Caravan Safety** | End-to-end integration and smoke test suite | **PASS** (Zero side-effects or regressions) |
