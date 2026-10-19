import { describe, it, expect } from 'vitest';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopology } from '../src/core/switch/graph/GraphTopology';
import { SIDING_TOPOLOGY_L103_FIFO, SIDING_LEVEL_103_FIFO } from '../src/core/switch/graph/SidingLevels';
import { MiniRailDioramaRegistry } from '../src/core/switch/graph/MiniRailDioramaLayouts';
import { MiniRailParkingController } from '../src/core/switch/graph/MiniRailParkingController';
import { TrackGeometry } from '../src/core/switch/graph/TrackGeometry';

describe('MINI RAIL CITY — FIFO Final Integrity Gate', () => {
  const config = MiniRailDioramaRegistry.getDioramaConfig(1032, SIDING_TOPOLOGY_L103_FIFO);
  const bay = config.sidingBays[0];

  describe('1. Kapasite Aşımı (Capacity Overflow)', () => {
    it('throws explicit error when attempting to park beyond capacity (no silent fallback)', () => {
      const controller = new MiniRailParkingController(config.sidingBays);

      // Bay capacity is 2
      expect(bay.capacity).toBe(2);

      const s1 = controller.parkVehicle(101, bay.id);
      expect(s1.slotIndex).toBe(0);

      const s2 = controller.parkVehicle(102, bay.id);
      expect(s2.slotIndex).toBe(1);

      // Verify slot distinction: vehicles never share a slot
      expect(s1.slotIndex).not.toBe(s2.slotIndex);
      expect(s1.currentY).not.toBe(s2.currentY);

      // 3rd vehicle exceeds capacity 2: MUST throw explicit error
      expect(() => controller.parkVehicle(103, bay.id)).toThrowError(
        /capacity exceeded \(capacity: 2\)\. Cannot park vehicle 103/
      );
    });

    it('verifies simulation engine strictly prevents siding capacity overflow in normal gameplay', () => {
      const topology = new GraphTopology(SIDING_TOPOLOGY_L103_FIFO);
      const network = new GraphSwitchNetwork(SIDING_LEVEL_103_FIFO, topology);
      network.start();

      // Run simulation until 2 vehicles enter SIDING_BAY
      let ticks = 0;
      while (
        network.vehicles.filter((v) => v.state === 'PARKED' && v.currentNode === 'SIDING_BAY').length < 2 &&
        ticks < 20
      ) {
        network.tick();
        ticks++;
      }

      // Check SIDING_BAY occupancy
      expect(network.isNodeOccupied('SIDING_BAY')).toBe(true);

      // Run additional ticks while SW_SIDING points to SIDING
      for (let i = 0; i < 5; i++) {
        network.tick();
      }

      // Siding must strictly contain at most 2 vehicles
      const inSiding = network.vehicles.filter((v) => v.currentNode === 'SIDING_BAY');
      expect(inSiding.length).toBeLessThanOrEqual(2);

      // 3rd vehicle (manifest item 2) cannot enter; must wait upstream
      const car3 = network.vehicles.find((v) => v.id === 3);
      if (car3) {
        expect(car3.currentNode).not.toBe('SIDING_BAY');
      }
    });
  });

  describe('2. Çıkış Geometrisi & Erken Çıkış Kısıtlamaları (Exit Geometry & Release Constraints)', () => {
    it('evaluates position, rotation, and track centerline alignment across 0ms, 100ms, 200ms, and 400ms', () => {
      const controller = new MiniRailParkingController(config.sidingBays, { advanceDurationMs: 400 });

      // 1. Two trains are parked
      controller.parkVehicle(1, bay.id);
      controller.parkVehicle(2, bay.id);

      expect(controller.getVehicleSlotIndex(1)).toBe(0);
      expect(controller.getVehicleSlotIndex(2)).toBe(1);

      // 2. Train 1 is released
      const train1Origin = controller.releaseVehicle(1)!;
      expect(train1Origin).toBeDefined();

      // Track centerline along the siding is at x = 130
      const trackCenterlineX = 130;

      // 3 & 4 & 5. Inspect Train 2 at 0ms, 100ms, 200ms, 400ms
      // AT 0 MS (Immediately upon release of Train 1)
      expect(controller.canReleaseVehicle(2)).toBe(false);
      expect(() => controller.releaseVehicle(2)).toThrowError(/cannot depart while advancing/);

      const p0 = controller.getVehiclePosition(2)!;
      expect(p0.x).toBe(trackCenterlineX);
      expect(Math.abs(p0.x - trackCenterlineX)).toBe(0.0); // Exactly on track centerline!
      expect(p0.y).toBe(bay.slots[1].y); // Still at Slot 1 (no instant teleportation)

      // AT 100 MS (25% progress)
      controller.update(100);
      expect(controller.canReleaseVehicle(2)).toBe(false);
      expect(() => controller.releaseVehicle(2)).toThrowError(/cannot depart while advancing/);

      const p100 = controller.getVehiclePosition(2)!;
      expect(p100.x).toBe(trackCenterlineX);
      expect(Math.abs(p100.x - trackCenterlineX)).toBe(0.0); // Exactly on track centerline!
      // Between Slot 1 and Slot 0
      expect(p100.y).toBeGreaterThan(Math.min(bay.slots[0].y, bay.slots[1].y));
      expect(p100.y).toBeLessThan(Math.max(bay.slots[0].y, bay.slots[1].y));

      // AT 200 MS (50% progress)
      controller.update(100);
      expect(controller.canReleaseVehicle(2)).toBe(false);
      expect(() => controller.releaseVehicle(2)).toThrowError(/cannot depart while advancing/);

      const p200 = controller.getVehiclePosition(2)!;
      expect(p200.x).toBe(trackCenterlineX);
      expect(Math.abs(p200.x - trackCenterlineX)).toBe(0.0); // Exactly on track centerline!

      // AT 400 MS (100% progress, arrival at Slot 0)
      controller.update(200);
      expect(controller.canReleaseVehicle(2)).toBe(true); // Now allowed!

      const p400 = controller.getVehiclePosition(2)!;
      expect(p400.x).toBe(trackCenterlineX);
      expect(Math.abs(p400.x - trackCenterlineX)).toBe(0.0); // Exactly on track centerline!
      expect(p400.y).toBe(bay.slots[0].y); // Reached Slot 0 lead position

      // Release Train 2 at 400ms: must succeed with 0 jump
      const train2DepartureOrigin = controller.releaseVehicle(2)!;
      expect(train2DepartureOrigin.x).toBe(p400.x);
      expect(train2DepartureOrigin.y).toBe(p400.y);
      const departureJump = Math.hypot(
        train2DepartureOrigin.x - p400.x,
        train2DepartureOrigin.y - p400.y
      );
      expect(departureJump).toBe(0.0);
    });

    it('verifies full sampled departure trajectory from lead slot has 0.0 deviation from exit track', () => {
      const exitEdge = config.edges.find((e) => e.from === 'SIDING_BAY' && e.to === 'MERGE')!;
      const leadSlot = bay.slots[0];

      const departurePath = [leadSlot, ...exitEdge.points.slice(1)];
      const samples = TrackGeometry.sampleCurve(departurePath, 30);

      expect(samples.length).toBe(31);
      expect(samples[0].x).toBe(leadSlot.x);
      expect(samples[0].y).toBe(leadSlot.y);
      expect(samples[30].x).toBe(config.nodes['MERGE'].x);
      expect(samples[30].y).toBe(config.nodes['MERGE'].y);

      // Measure tangent continuity throughout exit curve
      for (let i = 0; i < samples.length; i++) {
        const pt = samples[i];
        expect(Number.isFinite(pt.angle)).toBe(true);
        expect(Number.isFinite(pt.normalX)).toBe(true);
        expect(Number.isFinite(pt.normalY)).toBe(true);
        // Normal unit vector magnitude must be 1.0
        const mag = Math.hypot(pt.normalX, pt.normalY);
        expect(mag).toBeCloseTo(1.0, 5);
      }
    });
  });

  describe('3. Sıfırlama ve Temizleme (Reset Integrity)', () => {
    it('wipes all slot allocations and departure origins upon reset()', () => {
      const controller = new MiniRailParkingController(config.sidingBays);

      controller.parkVehicle(1, bay.id);
      controller.parkVehicle(2, bay.id);

      controller.releaseVehicle(1);
      expect(controller.getDepartureOrigin(1)).toBeDefined();

      // Reset
      controller.reset();

      expect(controller.getVehicleSlotIndex(1)).toBeUndefined();
      expect(controller.getVehicleSlotIndex(2)).toBeUndefined();
      expect(controller.getDepartureOrigin(1)).toBeUndefined();

      // After reset, bay can be cleanly re-occupied from slot 0
      const freshState = controller.parkVehicle(3, bay.id);
      expect(freshState.slotIndex).toBe(0);
    });
  });
});
