import { describe, it, expect } from 'vitest';
import { SwitchNetwork, FIXED_SCENARIOS } from '../src/core/switch/SwitchNetwork';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';

describe('GraphSwitchNetwork & Classic SwitchNetwork Equivalence Tests', () => {
  it('Initial states and junction getters match exactly', () => {
    for (let id = 1; id <= 10; id++) {
      const oldNet = new SwitchNetwork(id);
      const newNet = new GraphSwitchNetwork(id);

      expect(newNet.j1).toBe(oldNet.j1);
      expect(newNet.j2).toBe(oldNet.j2);
      expect(newNet.j3).toBe(oldNet.j3);
      expect(newNet.tickDurationMs).toBe(oldNet.tickDurationMs);
      expect(newNet.spawnCadenceTicks).toBe(oldNet.spawnCadenceTicks);
      expect(newNet.maxMistakes).toBe(oldNet.maxMistakes);
      expect(newNet.activeJunctions).toEqual(oldNet.activeJunctions);
      expect(newNet.manifest).toEqual(oldNet.manifest);
    }
  });

  it('Junction toggle sequences behave identically between old and new engines', () => {
    const oldNet = new SwitchNetwork(1);
    const newNet = new GraphSwitchNetwork(1);

    const toggles: Array<'J1' | 'J2' | 'J3'> = ['J1', 'J1', 'J2', 'J3', 'J1', 'J2', 'J2', 'J3'];

    for (const j of toggles) {
      const oldRes = oldNet.toggleJunction(j);
      const newRes = newNet.toggleJunction(j);
      expect(newRes).toBe(oldRes);
      expect(newNet.j1).toBe(oldNet.j1);
      expect(newNet.j2).toBe(oldNet.j2);
      expect(newNet.j3).toBe(oldNet.j3);
    }
  });

  it('Step-by-step tick simulation on Scenario 1 matches exactly with identical moves', () => {
    const oldNet = new SwitchNetwork(1); // Manifest: R, B, R, B, R, B
    const newNet = new GraphSwitchNetwork(1);

    oldNet.start();
    newNet.start();

    let ticks = 0;
    while (oldNet.status === 'RUNNING' && newNet.status === 'RUNNING' && ticks < 100) {
      // Configure switches based on waiting vehicles on oldNet and apply same to both
      for (const v of oldNet.vehicles) {
        if (v.state === 'WAITING' || v.state === 'SPAWNED') {
          if (v.currentNode === 'J1') {
            const needsLeft = v.targetStation === 'RED' || v.targetStation === 'BLUE';
            if (needsLeft && oldNet.j1 !== 'LEFT') {
              const resOld = oldNet.toggleJunction('J1');
              const resNew = newNet.toggleJunction('J1');
              expect(resNew).toBe(resOld);
            } else if (!needsLeft && oldNet.j1 !== 'RIGHT') {
              const resOld = oldNet.toggleJunction('J1');
              const resNew = newNet.toggleJunction('J1');
              expect(resNew).toBe(resOld);
            }
          } else if (v.currentNode === 'J2') {
            const needsRed = v.targetStation === 'RED';
            if (needsRed && oldNet.j2 !== 'RED') {
              const resOld = oldNet.toggleJunction('J2');
              const resNew = newNet.toggleJunction('J2');
              expect(resNew).toBe(resOld);
            } else if (!needsRed && oldNet.j2 !== 'BLUE') {
              const resOld = oldNet.toggleJunction('J2');
              const resNew = newNet.toggleJunction('J2');
              expect(resNew).toBe(resOld);
            }
          } else if (v.currentNode === 'J3') {
            const needsGreen = v.targetStation === 'GREEN';
            if (needsGreen && oldNet.j3 !== 'GREEN') {
              const resOld = oldNet.toggleJunction('J3');
              const resNew = newNet.toggleJunction('J3');
              expect(resNew).toBe(resOld);
            } else if (!needsGreen && oldNet.j3 !== 'YELLOW') {
              const resOld = oldNet.toggleJunction('J3');
              const resNew = newNet.toggleJunction('J3');
              expect(resNew).toBe(resOld);
            }
          }
        }
      }

      oldNet.tick();
      newNet.tick();
      ticks++;

      // Compare states after each tick
      expect(newNet.tickCount).toBe(oldNet.tickCount);
      expect(newNet.status).toBe(oldNet.status);
      expect(newNet.correctCount).toBe(oldNet.correctCount);
      expect(newNet.mistakeCount).toBe(oldNet.mistakeCount);
      expect(newNet.currentStreak).toBe(oldNet.currentStreak);
      expect(newNet.maxStreak).toBe(oldNet.maxStreak);
      expect(newNet.score).toBe(oldNet.score);
      expect(newNet.vehicles.length).toBe(oldNet.vehicles.length);

      for (let i = 0; i < oldNet.vehicles.length; i++) {
        const oldV = oldNet.vehicles[i];
        const newV = newNet.vehicles[i];
        expect(newV.id).toBe(oldV.id);
        expect(newV.color).toBe(oldV.color);
        expect(newV.state).toBe(oldV.state);
        expect(newV.currentNode).toBe(oldV.currentNode);
        expect(newV.targetStation).toBe(oldV.targetStation);
      }
    }

    expect(newNet.status).toBe('WON');
    expect(oldNet.status).toBe('WON');
    expect(newNet.correctCount).toBe(6);
    expect(newNet.mistakeCount).toBe(0);
    expect(oldNet.correctCount).toBe(6);
    expect(oldNet.mistakeCount).toBe(0);
  });

  it('Equivalence on Progressive Level 4 (only J1 active)', () => {
    const sc = PROGRESSIVE_LEVELS[3]; // Level 4
    const oldNet = new SwitchNetwork(sc);
    const newNet = new GraphSwitchNetwork(sc as any);

    expect(newNet.activeJunctions).toEqual(['J1']);
    expect(newNet.isJunctionActive('J1')).toBe(true);
    expect(newNet.isJunctionActive('J2')).toBe(false);
    expect(newNet.isJunctionActive('J3')).toBe(false);

    expect(newNet.toggleJunction('J2')).toBe(false);
    expect(oldNet.toggleJunction('J2')).toBe(false);

    expect(newNet.toggleJunction('J1')).toBe(true);
    expect(oldNet.toggleJunction('J1')).toBe(true);
    expect(newNet.j1).toBe(oldNet.j1);
  });

  it('Locking behavior equivalence when car is in transit', () => {
    const oldNet = new SwitchNetwork(1);
    const newNet = new GraphSwitchNetwork(1);

    oldNet.manifest = ['R'];
    newNet.manifest = ['R'];

    oldNet.start();
    newNet.start();

    // Tick 1: Spawn at SOURCE
    oldNet.tick();
    newNet.tick();

    // Tick 2: Depart SOURCE -> J1 (in transit to J1)
    oldNet.tick();
    newNet.tick();

    // Both should report J1 locked
    expect(newNet.isJunctionLocked('J1')).toBe(true);
    expect(oldNet.isJunctionLocked('J1')).toBe(true);

    // Toggle should be rejected on both
    expect(newNet.toggleJunction('J1')).toBe(false);
    expect(oldNet.toggleJunction('J1')).toBe(false);
  });

  it('Latched edge prevents mid-transit path hijacking on both engines', () => {
    const oldNet = new SwitchNetwork(1);
    const newNet = new GraphSwitchNetwork(1);

    oldNet.manifest = ['R'];
    newNet.manifest = ['R'];

    oldNet.start();
    newNet.start();

    oldNet.tick(); newNet.tick(); // Spawn
    oldNet.tick(); newNet.tick(); // Depart to J1
    oldNet.tick(); newNet.tick(); // Arrive at J1
    oldNet.tick(); newNet.tick(); // Depart J1 -> J2

    // Car is in transit to J2. J1 is now free from incoming cars, so player toggles J1 to RIGHT
    expect(newNet.toggleJunction('J1')).toBe(true);
    expect(oldNet.toggleJunction('J1')).toBe(true);
    expect(newNet.j1).toBe('RIGHT');
    expect(oldNet.j1).toBe('RIGHT');

    // Next tick: both cars must arrive at J2 because edge was latched!
    oldNet.tick();
    newNet.tick();
    expect(newNet.vehicles[0].currentNode).toBe('J2');
    expect(oldNet.vehicles[0].currentNode).toBe('J2');
  });

  it('All 10 Classic scenarios solve with 0 mistakes and 100% win on GraphSwitchNetwork', () => {
    for (const sc of FIXED_SCENARIOS) {
      const net = new GraphSwitchNetwork(sc.id);
      net.start();

      let ticks = 0;
      const MAX_TICKS = 200;

      while (net.status === 'RUNNING' && ticks < MAX_TICKS) {
        for (const v of net.vehicles) {
          if (v.state === 'WAITING' || v.state === 'SPAWNED') {
            if (v.currentNode === 'J1') {
              const needsLeft = v.targetStation === 'RED' || v.targetStation === 'BLUE';
              if (needsLeft && net.j1 !== 'LEFT') {
                net.toggleJunction('J1');
              } else if (!needsLeft && net.j1 !== 'RIGHT') {
                net.toggleJunction('J1');
              }
            } else if (v.currentNode === 'J2') {
              const needsRed = v.targetStation === 'RED';
              if (needsRed && net.j2 !== 'RED') {
                net.toggleJunction('J2');
              } else if (!needsRed && net.j2 !== 'BLUE') {
                net.toggleJunction('J2');
              }
            } else if (v.currentNode === 'J3') {
              const needsGreen = v.targetStation === 'GREEN';
              if (needsGreen && net.j3 !== 'GREEN') {
                net.toggleJunction('J3');
              } else if (!needsGreen && net.j3 !== 'YELLOW') {
                net.toggleJunction('J3');
              }
            }
          }
        }
        net.tick();
        ticks++;
      }

      expect(net.status).toBe('WON');
      expect(net.mistakeCount).toBe(0);
      expect(net.correctCount).toBe(sc.manifest.length);
    }
  });
});
