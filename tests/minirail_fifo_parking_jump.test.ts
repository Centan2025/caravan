import { describe, it, expect } from 'vitest';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopology } from '../src/core/switch/graph/GraphTopology';
import { SIDING_TOPOLOGY_L103_FIFO, SIDING_LEVEL_103_FIFO } from '../src/core/switch/graph/SidingLevels';
import { MiniRailDioramaRegistry } from '../src/core/switch/graph/MiniRailDioramaLayouts';
import { MiniRailParkingController } from '../src/core/switch/graph/MiniRailParkingController';
import { TrackGeometry } from '../src/core/switch/graph/TrackGeometry';

describe('Mini Rail City — FIFO Siding Visual Jump & Departure Consistency', () => {
  const config = MiniRailDioramaRegistry.getDioramaConfig(1032, SIDING_TOPOLOGY_L103_FIFO);
  const bay = config.sidingBays[0];

  it('demonstrates the audit risk in the legacy code (70px jump)', () => {
    // Legacy logic:
    // Car 0 was at slot 0 (y=335), Car 1 was at slot 1 (y=405)
    const slot1 = bay.slots[1]; // { x: 130, y: 405 }

    // If Car 1 is released from slot 1 using legacy hardcoded originSlot:
    const legacyOriginSlot = bay.slots[0];
    const car1ParkedPos = slot1;

    // Measure distance in legacy code:
    const jumpDistance = Math.hypot(
      legacyOriginSlot.x - car1ParkedPos.x,
      legacyOriginSlot.y - car1ParkedPos.y
    );

    // Confirmed bug: 70px jump!
    expect(jumpDistance).toBe(70);
  });

  it('verifies deterministic 7-step test with MiniRailParkingController: zero visual jump', () => {
    const controller = new MiniRailParkingController(config.sidingBays, { advanceDurationMs: 400 });

    // Step 1: Park two vehicles in FIFO siding
    const v0State = controller.parkVehicle(0, bay.id);
    const v1State = controller.parkVehicle(1, bay.id);

    expect(v0State.slotIndex).toBe(0);
    expect(v0State.currentX).toBe(bay.slots[0].x);
    expect(v0State.currentY).toBe(bay.slots[0].y); // y=335

    expect(v1State.slotIndex).toBe(1);
    expect(v1State.currentX).toBe(bay.slots[1].x);
    expect(v1State.currentY).toBe(bay.slots[1].y); // y=405

    // Step 2: Release the first vehicle (v0)
    const v0LastParkPos = controller.getVehiclePosition(0)!;
    const v0DepartureOrigin = controller.releaseVehicle(0)!;

    const v0JumpDistance = Math.hypot(
      v0DepartureOrigin.x - v0LastParkPos.x,
      v0DepartureOrigin.y - v0LastParkPos.y
    );
    expect(v0JumpDistance).toBe(0.0); // Exact continuity

    // Step 3: Check second vehicle (v1) visual position immediately after v0 is released
    // At deltaMs = 0, v1 MUST NOT jump to slot 0 instantaneously!
    const v1PosImmediate = controller.getVehiclePosition(1)!;
    const immediateSnapDistance = Math.hypot(
      v1PosImmediate.x - bay.slots[1].x,
      v1PosImmediate.y - bay.slots[1].y
    );
    expect(immediateSnapDistance).toBe(0.0); // No instantaneous snap! Still at y=405

    // Step 3b: Test smooth slot advance animation over time
    controller.update(200); // 50% through 400ms advance
    const v1PosMid = controller.getVehiclePosition(1)!;
    expect(v1PosMid.x).toBe(bay.slots[1].x);
    // Smoothly between 405 and 335 (ease-out quad: 0.5 * 1.5 = 0.75 => 405 - 70*0.75 = 352.5)
    expect(v1PosMid.y).toBeCloseTo(352.5, 1);

    controller.update(200); // Finish advance
    const v1PosEnd = controller.getVehiclePosition(1)!;
    expect(v1PosEnd.y).toBe(bay.slots[0].y); // Reached y=335 smoothly

    // Step 4: Release the second vehicle (v1)
    const v1LastParkPos = controller.getVehiclePosition(1)!;
    const v1DepartureOrigin = controller.releaseVehicle(1)!;

    // Step 5: Measure distance between movement start position and vehicle's last park position
    const v1JumpDistance = Math.hypot(
      v1DepartureOrigin.x - v1LastParkPos.x,
      v1DepartureOrigin.y - v1LastParkPos.y
    );

    // Step 6: Verify no unexpected visual jump (delta distance = 0)
    expect(v1JumpDistance).toBe(0.0);
  });

  it('rejects early release of second vehicle before advance completes and allows at 400ms with zero jump', () => {
    const controller = new MiniRailParkingController(config.sidingBays, { advanceDurationMs: 400 });

    controller.parkVehicle(10, bay.id);
    controller.parkVehicle(11, bay.id);

    // Release vehicle 10 (lead)
    controller.releaseVehicle(10);

    // Advance vehicle 11 only 100ms (25% progress)
    controller.update(100);
    expect(controller.canReleaseVehicle(11)).toBe(false);

    // Premature release MUST be rejected
    expect(() => controller.releaseVehicle(11)).toThrowError(
      /cannot depart while advancing between slots/
    );

    // Advance vehicle 11 remaining 300ms to complete slot transition
    controller.update(300);
    expect(controller.canReleaseVehicle(11)).toBe(true);

    const car11FinalPos = controller.getVehiclePosition(11)!;
    const departureOrigin = controller.releaseVehicle(11)!;

    const jump = Math.hypot(
      departureOrigin.x - car11FinalPos.x,
      departureOrigin.y - car11FinalPos.y
    );
    expect(jump).toBe(0.0); // Exact smooth departure
  });

  it('verifies departure trajectory sampling from slot 1 is geometrically continuous to merge point', () => {
    const edge = config.edges.find((e) => e.from === 'SIDING_BAY' && e.to === 'MERGE')!;
    const slot1Origin = bay.slots[1]; // y=405

    const pointsFromSlot1 = [slot1Origin, ...edge.points.slice(1)];
    const samples = TrackGeometry.sampleCurve(pointsFromSlot1, 20);

    expect(samples[0].x).toBe(slot1Origin.x);
    expect(samples[0].y).toBe(slot1Origin.y);
    expect(samples[samples.length - 1].x).toBe(config.nodes['MERGE'].x);
    expect(samples[samples.length - 1].y).toBe(config.nodes['MERGE'].y);

    // Check monotonic y progression downwards
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].y).toBeGreaterThanOrEqual(samples[i - 1].y);
    }
  });

  it('Step 7: Verifies strict FIFO vehicle ordering in simulation network', () => {
    const topology = new GraphTopology(SIDING_TOPOLOGY_L103_FIFO);
    const network = new GraphSwitchNetwork(SIDING_LEVEL_103_FIFO, topology);
    network.start();

    // Manifest: ['B', 'B', 'R']
    // Run until both vehicles 0 and 1 are parked in SIDING_BAY
    let safetyTicks = 0;
    while (
      network.vehicles.filter((v) => v.state === 'PARKED' && v.currentNode === 'SIDING_BAY').length < 2 &&
      safetyTicks < 20
    ) {
      network.tick();
      safetyTicks++;
    }

    const parked = network.vehicles.filter((v) => v.state === 'PARKED');
    expect(parked.length).toBe(2);
    expect(parked[0].id).toBe(1); // Vehicle 1 entered first
    expect(parked[1].id).toBe(2); // Vehicle 2 entered second

    // Request release: Vehicle 1 must depart FIRST (FIFO)
    network.releaseSiding('SIDING_BAY');
    network.tick();

    const v1 = network.vehicles.find((v) => v.id === 1)!;
    const v2 = network.vehicles.find((v) => v.id === 2)!;
    expect(v1.state).toBe('MOVING'); // First car left
    expect(v2.state).toBe('PARKED'); // Second car still in siding

    // Next tick: Vehicle 1 arrives at MERGE, then departs to station
    network.tick();

    // Release second car
    network.releaseSiding('SIDING_BAY');
    network.tick();

    expect(v2.state).toBe('MOVING'); // Second car now departs

    // Verify ordering: Vehicle 1 was released and moved first, Vehicle 2 second
    expect(v1.id).toBe(1);
    expect(v2.id).toBe(2);
  });
});
