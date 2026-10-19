# Chain Domino & Switch Rush — GDD v1.0

**Status:** Experimental, no claim of originality, engagement, or commercial success.
**Goal:** Compare two fundamentally different one-finger play loops in bare web prototypes.
**Stack:** Vite + TypeScript + Phaser 3, portrait mobile browser, no backend.

## Shared acceptance rules

- A landing screen lets players choose game A or B, clearly indicating that both are experimental.
- Responsive board at viewport widths 320–480 px, pointer/touch input without scrolling during play.
- Tutorial only as a nonblocking one-line hint; do not tell the player solutions.
- Pause/resume when browser loses focus. Disable duplicate input during animations where applicable.
- Explicit `Play again` and `Leave` buttons at end. Never automatically start the next run.
- Every session uses anonymous random ID. No email, fingerprinting, advertising identifiers or automatic upload.
- Events are stored locally for the session, exportable as JSON. Count `voluntary_restart` only for a deliberate button press; auto-advancing does not count.
- Save a brief diagnostic error log and expose a reset control.
- No art polish, economy, progression meta, ads, IAP, accounts, daily login, or backend.
- Deterministic logic is separate from Phaser rendering and covered by automated tests.

# GAME A — CHAIN DOMINO

## Player promise

Pick the best ignition point and watch a chain of directed tiles fire. Discover how to hit every gold target with as few ignitions as possible.

## Board and entities

5 columns × 5 rows, coordinates `(x,y)` where `(0,0)` is the top-left; x increases right, y increases down. Cells hold one of:
- `.` Empty. No hit and no propagation.
- `#` Wall. Blocks pulses.
- `U`, `R`, `D`, `L`: arrow relays. When triggered, emit **one pulse** to the adjacent cell in that direction.
- `H`, `V`: split relays. `H` emits left and right; `V` emits up and down. Emission goes to two adjacent cells, even when the relay was entered from one of those cells.
- `G`: gold goal. A pulse reaching it marks it activated; it never emits a pulse.

**Tap eligibility:** Only arrow or split relays can be manually ignited. No tap rotation, no tile movement. A manually ignited relay counts as one ignition (one move). Already activated relays cannot be ignited again in that attempt. Goals, walls and empty cells are not tappable.

## Exact pulse resolution

1. Immediately after a valid tap, mark the tapped relay activated and schedule its emissions for animation tick 1.
2. Each pulse travels exactly **one cell**, along its emission direction, per tick. Pulses leaving the board are discarded. Walls and empty cells absorb pulses.
3. If a pulse enters an inactive arrow or split relay, activate it and queue its emissions for the next tick. If it enters an inactive goal, mark it collected (no outgoing pulse).
4. If several pulses hit the same cell in the same tick, process it once. Process active cells in stable y-then-x order to make results reproducible; this ordering must not change the final activation set.
5. Each relay and each goal activates **at most once per attempt**, so cycles cannot run forever.
6. Run until the pulse queue is empty. Only then allow the next ignition.
7. If all goals are active, win immediately; if no ignitions remain, lose; otherwise await another player tap.
8. Invalid touches do not spend an ignition. Animation speed affects only presentation, never logic.

## Scoring and clarity

- Score = 100 per collected gold goal + 30 × unused ignition count on success; failure keeps collected-goal score, clearly marked as a failed run.
- Display goals collected / total and ignitions left, plus `Retry` after completion. Pulse path draws briefly in low-cost lines; a small visual flash is acceptable, but no screen shake or particle storms.
- A goal directly adjacent to a relay can be hit normally. A goal cannot be hit by tapping itself.
- Starter level has at least two plausible ignitable relays and a recognizable chain of 3+ activations.

## Level design

Create **10 fixed level JSON files**, each with a literal 5×5 board (five strings of exactly five characters) and `maxIgnitions` from 1 to 3. Do not use RNG for these first ten levels. For each level:
- minimum one goal and at least two eligible starting relays;
- at least one winning solution from the original board;
- at least one losing opening tap, except introductory level 1;
- automatic exhaustive solver enumerates available ignition sequences and asserts solvability within the move cap;
- never rely on a random distribution, hidden order, or unimplemented rule to make a level solvable.

Example level 1, used as reference and acceptance test:
```
....G
....U
....U
....U
....U
```
`maxIgnitions = 1`; tapping the bottom `U` at (4,4) fires to the `U` above, which fires upward along the column, finally collecting `G` at (4,0). Other taps may fail; adjust the beginner hint only, not the model.

Author and validate nine further fixed boards before release. Output each grid and one solver-confirmed winning tap sequence in `LEVELS.md`; levels must be progressive in observed decision burden rather than merely increasing number of arrows.

## Unit tests

- Pulse moves exactly one orthogonal neighbor.
- Walls, blanks, and off-board pulses terminate.
- H/V split emits two; triggered cells activate once.
- Closed loop terminates; multiple simultaneous incoming pulses do not double-trigger.
- Tapping goal/wall/activated relay is invalid and does not consume a move.
- Gold completion and ignition exhaustion are mutually resolved correctly.
- Solver validates all 10 boards.

# GAME B — SWITCH RUSH

## Player promise

Vehicles depart automatically. Touch a junction to decide where the next passing vehicle goes. Send each color to the matching station, without managing speed or drawing tracks.

## Railway layout (fixed for all 10 scenarios)

Use an abstract directed network, drawn as a readable top-down railway diagram:

`SOURCE -> J1`
`J1 LEFT -> J2 -> (RED, BLUE)`
`J1 RIGHT -> J3 -> (GREEN, YELLOW)`

J1, J2 and J3 each have **exactly two** toggle states. J1 defaults LEFT, J2 defaults RED, J3 defaults GREEN. The game shows selected branches clearly and color is also indicated by a letter/icon (R/B/G/Y) for color-blind accessibility.

## Movement and switch semantics

- One simulation tick every 700ms. A vehicle moves one edge each tick in order: `SOURCE -> J1 -> J2/J3 -> STATION`.
- Vehicle must be spawned at SOURCE before moving; next vehicle appears every 1400ms if SOURCE is free. If SOURCE is occupied, it waits until free; never drop or overlap cars.
- Cars have immutable target labels R, B, G, Y, shown above the vehicle.
- A tap on a junction toggles its branch instantly unless a car is currently entering that junction during the same simulation tick. Resolve input events **before** the next tick. The selected route is latched once a vehicle departs that junction; toggling later cannot teleport a vehicle or change its already-chosen edge.
- Vehicles on edges are rendered with smooth linear interpolation. They cannot be tapped, accelerated, stopped or redirected.
- No collision system: vehicles queue if the next node is occupied. Queueing has no penalty in this test.
- Arriving at a correct station increments correct count; wrong station increments mistakes. Three mistakes = game over immediately.
- A scenario wins after its full manifest has been processed with fewer than three mistakes. No new vehicles spawn after manifest exhaustion. Idle waiting when all vehicles are delivered/failed must resolve to an end screen.
- Score = 100 × correct deliveries + 25 × longest consecutive correct-delivery streak; show correct / total, mistake / 3, and current streak.
- Switch taps never cost currency or points; repeated taps are allowed. Pausing the game stops both tick simulation and interpolation.

## 10 fixed test scenarios

Use the **same network** and tick rate for all scenarios; progression comes only from destination combinations, not surprise new rules. These are exact ordered manifests:

1. `R B R B R B`  (6 vehicles)
2. `G Y G Y G Y`  (6)
3. `R G B Y R G`  (6)
4. `R B G Y B R G Y`  (8)
5. `Y Y G R B B G R`  (8)
6. `R G R G B Y B Y`  (8)
7. `R B Y G Y B R G R B`  (10)
8. `G R Y B G B Y R G Y`  (10)
9. `B Y R G B G R Y B G`  (10)
10. `R G B Y Y B G R B Y R G`  (12)

Allow a `Retry same scenario` option and a manually chosen scenario list for tests. Do **not** auto advance after success; it would contaminate the voluntary-replay signal. The transport diagram must be readable at 320px viewport width; do not draw physically impossible crossing tracks as if cars can intersect without junctions.

## Unit tests

- Correct vehicle appears in manifest order; no unexpected spawns.
- J1/J2/J3 default states and taps toggle deterministically.
- Route latch at departure prevents retroactive changes.
- Source waiting and downstream queuing do not lose or overlap vehicles.
- Correct/wrong stations score accurately; third error triggers loss.
- Manifest exhaustion plus all vehicles resolved triggers a win if mistakes <=2.
- Pausing freezes movement and spawn clock.
- All 10 manifests can be delivered perfectly by a simulated omniscient controller, establishing baseline reachability.

# Shared telemetry and unbiased playtest

Log events with `session_id`, `game_id`, `scenario_id`, elapsed monotonic time since run start, and payload:
`run_started`, `first_tap`, `valid_move`, `invalid_tap`, `goal_hit`, `vehicle_delivered`, `vehicle_misdelivered`, `run_won`, `run_lost`, `replay_clicked`, `exit_clicked`, `help_opened`, `app_blurred`, `runtime_error`.

No names, account IDs, raw IPs or remote upload. Exclude time in background from active play time.

**Prespecified feasibility gate (not industry benchmarks):** 5 unfamiliar testers for each prototype, balanced order. At least 4 of 5 understand controls in 30 seconds; at least 3 of 5 voluntarily restart once without being instructed. Ask for no praise or ratings before observation. If a prototype fails controls, fix usability before treating replay failure as mechanic failure. If either passes, replicate with 10–20 new players. Small samples are qualitative screening only, not commercial proof.

# Engineering deliverables and done criteria

- Working source with `npm install`, `npm run dev`, `npm test`, `npm run build` documented in README.
- `src/core/chain` and `src/core/switch` pure, reproducible state machines with tests; rendering under `src/games`.
- `levels/chain/*.json` for 10 solver-verified boards and manifests for 10 rail scenarios.
- `LEVELS.md` documents solver-confirmed winning taps.
- `QA.md` with actual test output, mobile touch smoke test, and known issues.
- Session-local JSON event export, no server required.
- No pretend-success reporting. If a mechanic detail is ambiguous, resolve it explicitly in `DECISIONS.md` before coding, do not silently invent rules.

## Implementation order

1. Read repo rules and inspect existing code; protect uncommitted work.
2. Implement shared harness and unit tests.
3. Implement Chain Domino as pure model then minimal rendering, 10 solver-verified levels.
4. Implement Switch Rush as pure model then minimal rendering, 10 manifests.
5. Add telemetry, export and neutral playtest instructions.
6. Run tests and a genuine mobile touch smoke test; report what is and is not verified.
