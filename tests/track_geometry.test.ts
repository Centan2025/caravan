import { describe, it, expect } from 'vitest';
import { TrackGeometry, DioramaPoint } from '../src/core/switch/graph/TrackGeometry';

describe('TrackGeometry — Geometric Consistency & Rail Matching', () => {
  it('straight edge: evaluates positions and normals accurately', () => {
    const edge: DioramaPoint[] = [
      { x: 100, y: 100 },
      { x: 100, y: 300 },
    ];

    const mid = TrackGeometry.evaluatePosition(edge, 0.5);
    expect(mid.x).toBeCloseTo(100, 3);
    expect(mid.y).toBeCloseTo(200, 3);

    const tangent = TrackGeometry.evaluateTangent(edge, 0.5);
    expect(tangent.angle).toBeCloseTo(Math.PI / 2, 3);
    // Vertical edge tangent is (0, 1), normal is (-1, 0)
    expect(tangent.normalX).toBeCloseTo(-1, 3);
    expect(tangent.normalY).toBeCloseTo(0, 3);
  });

  it('quadratic bezier: sampled centerline matches vehicle position with 0.0 deviation', () => {
    const curvedEdge: DioramaPoint[] = [
      { x: 270, y: 230 },
      { x: 190, y: 280 },
      { x: 130, y: 380 },
    ];

    const testTValues = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
    for (const t of testTValues) {
      const vTransform = TrackGeometry.getVehicleTransform(curvedEdge, t);
      const pos = TrackGeometry.evaluatePosition(curvedEdge, t);

      expect(vTransform.x).toBeCloseTo(pos.x, 5);
      expect(vTransform.y).toBeCloseTo(pos.y, 5);
    }
  });

  it('twin rails maintain exact gauge separation throughout curved turnout', () => {
    const curvedEdge: DioramaPoint[] = [
      { x: 270, y: 210 },
      { x: 330, y: 370 },
      { x: 270, y: 530 },
    ];

    const gauge = 12;
    const { leftRail, rightRail } = TrackGeometry.computeTwinRailPaths(curvedEdge, gauge, 40);

    expect(leftRail.length).toBe(rightRail.length);
    expect(leftRail.length).toBe(41); // 40 segments = 41 sample points

    for (let i = 0; i < leftRail.length; i++) {
      const pL = leftRail[i];
      const pR = rightRail[i];
      const dist = Math.hypot(pR.x - pL.x, pR.y - pL.y);
      // Rail separation must strictly equal gauge
      expect(dist).toBeCloseTo(gauge, 2);

      // Center point between rails must lie exactly on the track centerline
      const centerX = (pL.x + pR.x) / 2;
      const centerY = (pL.y + pR.y) / 2;
      const t = i / 40;
      const centerExpected = TrackGeometry.evaluatePosition(curvedEdge, t);
      expect(centerX).toBeCloseTo(centerExpected.x, 2);
      expect(centerY).toBeCloseTo(centerExpected.y, 2);
    }
  });

  it('sleepers are perpendicular to track tangent along entire curve', () => {
    const curvedEdge: DioramaPoint[] = [
      { x: 270, y: 180 },
      { x: 175, y: 220 },
      { x: 125, y: 270 },
    ];

    const sleepers = TrackGeometry.computeSleeperPositions(curvedEdge, 16, 20);
    expect(sleepers.length).toBeGreaterThan(3);

    for (const s of sleepers) {
      const sleeperLength = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      expect(sleeperLength).toBeCloseTo(20, 2);
    }
  });
});
