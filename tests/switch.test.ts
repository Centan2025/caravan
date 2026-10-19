import { describe, it, expect } from 'vitest';
import { SwitchNetwork, FIXED_SCENARIOS } from '../src/core/switch/SwitchNetwork';
import { SwitchSolver } from '../src/core/switch/SwitchSolver';
import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';

describe('Switch Rush Core Engine', () => {
  it('J1/J2/J3 have correct default states and toggle deterministically', () => {
    const net = new SwitchNetwork(1);
    expect(net.j1).toBe('LEFT');
    expect(net.j2).toBe('RED');
    expect(net.j3).toBe('GREEN');

    expect(net.toggleJunction('J1')).toBe(true);
    expect(net.j1).toBe('RIGHT');
    expect(net.toggleJunction('J1')).toBe(true);
    expect(net.j1).toBe('LEFT');

    expect(net.toggleJunction('J2')).toBe(true);
    expect(net.j2).toBe('BLUE');

    expect(net.toggleJunction('J3')).toBe(true);
    expect(net.j3).toBe('YELLOW');
  });

  it('Correct vehicle appears in manifest order; no unexpected spawns', () => {
    const net = new SwitchNetwork(1); // ['R', 'B', 'R', 'B', 'R', 'B']
    net.start();

    // Tick 0: starts ready
    expect(net.vehicles.length).toBe(0);

    // Tick 1: first vehicle spawns at SOURCE with color 'R'
    net.tick();
    expect(net.vehicles.length).toBe(1);
    expect(net.vehicles[0].color).toBe('R');

    // Tick 2: car 1 moves towards J1, SOURCE now free, but spawn cadence is 2 ticks
    net.tick();
    // Tick 3: car 2 spawns at SOURCE with color 'B'
    net.tick();
    expect(net.vehicles.length).toBe(2);
    expect(net.vehicles[1].color).toBe('B');
  });

  it('Route latch at departure prevents retroactive changes', () => {
    const net = new SwitchNetwork(1);
    net.manifest = ['R']; // Single car so J1 is not locked by a following car
    net.start();

    net.tick(); // Car 1 spawns at SOURCE
    net.tick(); // Car 1 departs SOURCE to J1
    net.tick(); // Car 1 arrives at J1
    expect(net.j1).toBe('LEFT');

    net.tick(); // Car 1 departs J1 towards J2 (latched J1 -> J2)
    const car = net.vehicles[0];
    expect(car.latchedEdge?.to).toBe('J2');

    // Player now toggles J1 to RIGHT while car is in transit between J1 and J2
    const toggled = net.toggleJunction('J1');
    expect(toggled).toBe(true);
    expect(net.j1).toBe('RIGHT');

    // Car must still arrive at J2!
    net.tick();
    expect(car.currentNode).toBe('J2');
  });

  it('Source waiting and downstream queuing do not lose or overlap vehicles', () => {
    const net = new SwitchNetwork(1);
    net.start();

    // Run 10 ticks without toggling
    for (let i = 0; i < 10; i++) {
      net.tick();
    }

    // No two cars should occupy the same resting node or the same edge in transit
    const onBoard = net.vehicles.filter(
      (v) => v.state !== 'DELIVERED' && v.state !== 'MISDELIVERED'
    );
    const restingNodes = onBoard
      .filter((v) => v.state === 'WAITING' || v.state === 'SPAWNED')
      .map((v) => v.currentNode);
    expect(restingNodes.length).toBe(new Set(restingNodes).size);

    const movingEdges = onBoard
      .filter((v) => v.state === 'MOVING')
      .map((v) => `${v.fromNode}->${v.toNode}`);
    expect(movingEdges.length).toBe(new Set(movingEdges).size);
  });

  it('Correct/wrong stations score accurately; third error triggers loss', () => {
    const net = new SwitchNetwork(1); // Manifest: R, B, R, B...
    // Defaults: J1=LEFT, J2=RED. So vehicles go to RED.
    net.start();

    // First car is 'R' -> goes to RED -> correct!
    // Second car is 'B' -> goes to RED -> wrong!
    // Third car is 'R' -> goes to RED -> correct!
    // Fourth car is 'B' -> goes to RED -> wrong!
    // Fifth car is 'R' -> goes to RED -> correct!
    // Sixth car is 'B' -> goes to RED -> wrong! (3rd mistake -> LOST!)

    for (let i = 0; i < 30; i++) {
      net.tick();
      if (net.status === 'LOST') break;
    }

    expect(net.mistakeCount).toBe(3);
    expect(net.status).toBe('LOST');
  });

  it('Manifest exhaustion plus all vehicles resolved triggers a win if mistakes <= 2', () => {
    // Solve scenario 1 with omniscient solver
    const res = SwitchSolver.solveScenario(1);
    expect(res.won).toBe(true);
    expect(res.mistakeCount).toBe(0);
    expect(res.correctCount).toBe(6);
  });

  it('Pausing freezes movement and spawn clock', () => {
    const net = new SwitchNetwork(1);
    net.start();
    net.tick();
    expect(net.vehicles.length).toBe(1);

    net.pause();
    const tickCountBefore = net.tickCount;
    net.tick(); // Tick while paused
    expect(net.tickCount).toBe(tickCountBefore);
    expect(net.status).toBe('PAUSED');

    net.resume();
    expect(net.status).toBe('RUNNING');
    net.tick();
    expect(net.tickCount).toBe(tickCountBefore + 1);
  });

  it('All 10 manifests can be delivered perfectly by simulated omniscient controller', () => {
    const results = SwitchSolver.verifyAllScenarios();
    expect(results.length).toBe(10);

    for (const r of results) {
      expect(r.won).toBe(true);
      expect(r.mistakeCount).toBe(0);
      expect(r.correctCount).toBe(r.totalVehicles);
    }
  });

  it('All 10 fixed manifests match GDD exact specifications', () => {
    expect(FIXED_SCENARIOS[0].manifest.join(' ')).toBe('R B R B R B');
    expect(FIXED_SCENARIOS[1].manifest.join(' ')).toBe('G Y G Y G Y');
    expect(FIXED_SCENARIOS[2].manifest.join(' ')).toBe('R G B Y R G');
    expect(FIXED_SCENARIOS[3].manifest.join(' ')).toBe('R B G Y B R G Y');
    expect(FIXED_SCENARIOS[4].manifest.join(' ')).toBe('Y Y G R B B G R');
    expect(FIXED_SCENARIOS[5].manifest.join(' ')).toBe('R G R G B Y B Y');
    expect(FIXED_SCENARIOS[6].manifest.join(' ')).toBe('R B Y G Y B R G R B');
    expect(FIXED_SCENARIOS[7].manifest.join(' ')).toBe('G R Y B G B Y R G Y');
    expect(FIXED_SCENARIOS[8].manifest.join(' ')).toBe('B Y R G B G R Y B G');
    expect(FIXED_SCENARIOS[9].manifest.join(' ')).toBe('R G B Y Y B G R B Y R G');
  });

  it('All 30 progressive levels are verified solvable with 0 mistakes by omniscient solver', () => {
    const results = SwitchSolver.verifyProgressiveLevels();
    expect(results.length).toBe(30);

    for (const r of results) {
      expect(r.won).toBe(true);
      expect(r.mistakeCount).toBe(0);
      expect(r.correctCount).toBe(r.totalVehicles);
    }
  });

  it('All 5 districts have exactly 6 levels and district metadata is valid', () => {
    const districts = ['suburb', 'downtown', 'industrial', 'harbor', 'night_express'] as const;
    for (const d of districts) {
      const inDistrict = PROGRESSIVE_LEVELS.filter((l) => l.district === d);
      expect(inDistrict.length).toBe(6);
      // Last level of each district has mastery family
      expect(inDistrict[5].levelFamily).toBe('mastery');
    }
  });

  it('Progressive levels ramp difficulty incrementally without jumping all variables at once', () => {
    // Check that early levels are tutorials
    for (let i = 0; i < 3; i++) {
      expect(PROGRESSIVE_LEVELS[i].activeJunctions).toEqual(['J2']);
      expect(PROGRESSIVE_LEVELS[i].manifest.length).toBeLessThanOrEqual(3);
      expect(PROGRESSIVE_LEVELS[i].tickDurationMs).toBeGreaterThanOrEqual(850);
      expect(PROGRESSIVE_LEVELS[i].maxConcurrentVehicles).toBe(1);
      expect(PROGRESSIVE_LEVELS[i].spawnCadenceTicks).toBeGreaterThanOrEqual(4);
    }

    // Check intermediate levels (4-7) introduce J1 and 2 switches
    for (let i = 3; i < 7; i++) {
      expect((PROGRESSIVE_LEVELS[i].activeJunctions?.length ?? 0)).toBeLessThanOrEqual(2);
      expect(PROGRESSIVE_LEVELS[i].manifest.length).toBeLessThanOrEqual(4);
      expect(PROGRESSIVE_LEVELS[i].tickDurationMs ?? 700).toBeGreaterThanOrEqual(800);
    }

    // Check that no level has fewer than 1 mistake tolerance
    for (const lvl of PROGRESSIVE_LEVELS) {
      expect(lvl.maxMistakes).toBeGreaterThanOrEqual(2);
      expect(lvl.manifest.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('Inactive junctions reject toggle attempts while active ones toggle successfully', () => {
    // Level 4 has only J1 active
    const net = new SwitchNetwork(PROGRESSIVE_LEVELS[3]);
    expect(net.activeJunctions).toEqual(['J1']);

    expect(net.isJunctionActive('J1')).toBe(true);
    expect(net.isJunctionActive('J2')).toBe(false);
    expect(net.isJunctionActive('J3')).toBe(false);

    expect(net.toggleJunction('J2')).toBe(false);
    expect(net.toggleJunction('J3')).toBe(false);
    expect(net.toggleJunction('J1')).toBe(true);
  });
});

