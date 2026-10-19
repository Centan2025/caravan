export interface DioramaPoint {
  x: number;
  y: number;
}

export interface SampledCurvePoint {
  x: number;
  y: number;
  angle: number;       // Tangent direction in radians
  normalX: number;     // Perpendicular unit vector X
  normalY: number;     // Perpendicular unit vector Y
  distance: number;    // Cumulative arc length from start
  t: number;           // Parameter t (0 to 1)
}

export class TrackGeometry {
  /**
   * Evaluates the analytical position on a 2-point line or 3-point Quadratic Bézier curve.
   */
  public static evaluatePosition(points: DioramaPoint[], t: number): DioramaPoint {
    const clampedT = Math.max(0, Math.min(1, t));
    if (points.length === 0) {
      return { x: 0, y: 0 };
    }
    if (points.length === 1 || clampedT <= 0) {
      return { x: points[0].x, y: points[0].y };
    }
    if (clampedT >= 1) {
      return { x: points[points.length - 1].x, y: points[points.length - 1].y };
    }

    if (points.length === 2) {
      const p0 = points[0];
      const p1 = points[1];
      return {
        x: p0.x + clampedT * (p1.x - p0.x),
        y: p0.y + clampedT * (p1.y - p0.y),
      };
    }

    if (points.length === 3) {
      const p0 = points[0];
      const p1 = points[1];
      const p2 = points[2];
      const u = 1 - clampedT;
      const tt = clampedT * clampedT;
      const uu = u * u;
      return {
        x: uu * p0.x + 2 * u * clampedT * p1.x + tt * p2.x,
        y: uu * p0.y + 2 * u * clampedT * p1.y + tt * p2.y,
      };
    }

    // Fallback for multi-point polyline
    const segmentCount = points.length - 1;
    const scaledT = clampedT * segmentCount;
    const idx = Math.min(Math.floor(scaledT), segmentCount - 1);
    const localT = scaledT - idx;
    const pA = points[idx];
    const pB = points[idx + 1];
    return {
      x: pA.x + localT * (pB.x - pA.x),
      y: pA.y + localT * (pB.y - pA.y),
    };
  }

  /**
   * Evaluates the tangent angle (in radians) and normal vector at parameter t.
   */
  public static evaluateTangent(points: DioramaPoint[], t: number): { angle: number; normalX: number; normalY: number } {
    const clampedT = Math.max(0, Math.min(1, t));
    if (points.length < 2) {
      return { angle: Math.PI / 2, normalX: 1, normalY: 0 };
    }

    let dx = 0;
    let dy = 0;

    if (points.length === 2) {
      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;
    } else if (points.length === 3) {
      // First derivative of Quadratic Bézier: B'(t) = 2*(1-t)*(P1-P0) + 2*t*(P2-P1)
      const p0 = points[0];
      const p1 = points[1];
      const p2 = points[2];
      const u = 1 - clampedT;
      dx = 2 * u * (p1.x - p0.x) + 2 * clampedT * (p2.x - p1.x);
      dy = 2 * u * (p1.y - p0.y) + 2 * clampedT * (p2.y - p1.y);
    } else {
      const deltaT = 0.005;
      const t1 = Math.max(0, clampedT - deltaT);
      const t2 = Math.min(1, clampedT + deltaT);
      const pA = this.evaluatePosition(points, t1);
      const pB = this.evaluatePosition(points, t2);
      dx = pB.x - pA.x;
      dy = pB.y - pA.y;
    }

    const angle = Math.atan2(dy, dx);
    // Normal is 90 degrees counterclockwise to tangent
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);

    return { angle, normalX, normalY };
  }

  /**
   * Generates a densely sampled sequence of points along the curve with arc length.
   */
  public static sampleCurve(points: DioramaPoint[], sampleCount = 40): SampledCurvePoint[] {
    if (points.length < 2) {
      const pt = points[0] || { x: 0, y: 0 };
      return [
        {
          x: pt.x,
          y: pt.y,
          angle: Math.PI / 2,
          normalX: 1,
          normalY: 0,
          distance: 0,
          t: 0,
        },
      ];
    }

    const samples: SampledCurvePoint[] = [];
    let cumulativeDistance = 0;
    let prevPos: DioramaPoint | null = null;

    for (let i = 0; i <= sampleCount; i++) {
      const t = i / sampleCount;
      const pos = this.evaluatePosition(points, t);
      const { angle, normalX, normalY } = this.evaluateTangent(points, t);

      if (prevPos) {
        const segDist = Math.hypot(pos.x - prevPos.x, pos.y - prevPos.y);
        cumulativeDistance += segDist;
      }

      samples.push({
        x: pos.x,
        y: pos.y,
        angle,
        normalX,
        normalY,
        distance: cumulativeDistance,
        t,
      });

      prevPos = pos;
    }

    return samples;
  }

  /**
   * Returns exact transform for a vehicle at parameter t.
   * Guarantees 100% mathematical consistency with track rails.
   */
  public static getVehicleTransform(
    points: DioramaPoint[],
    t: number
  ): { x: number; y: number; angle: number } {
    const pos = this.evaluatePosition(points, t);
    const { angle } = this.evaluateTangent(points, t);
    return { x: pos.x, y: pos.y, angle };
  }

  /**
   * Computes uniform sleeper positions along the curve arc length.
   */
  public static computeSleeperPositions(
    points: DioramaPoint[],
    spacing = 16,
    sleeperLength = 20
  ): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const samples = this.sampleCurve(points, 40);
    const totalLength = samples[samples.length - 1].distance;
    const count = Math.max(1, Math.floor(totalLength / spacing));

    const sleepers: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const halfLen = sleeperLength / 2;

    for (let s = 1; s <= count; s++) {
      const targetDist = (s / (count + 1)) * totalLength;
      // Find sample bracket
      let sample = samples[0];
      for (let i = 0; i < samples.length - 1; i++) {
        if (targetDist >= samples[i].distance && targetDist <= samples[i + 1].distance) {
          const segDist = samples[i + 1].distance - samples[i].distance;
          const u = segDist > 0.0001 ? (targetDist - samples[i].distance) / segDist : 0;
          const interpT = samples[i].t + u * (samples[i + 1].t - samples[i].t);
          const pos = this.evaluatePosition(points, interpT);
          const { normalX, normalY } = this.evaluateTangent(points, interpT);
          sample = {
            x: pos.x,
            y: pos.y,
            angle: 0,
            normalX,
            normalY,
            distance: targetDist,
            t: interpT,
          };
          break;
        }
      }

      sleepers.push({
        x1: sample.x - sample.normalX * halfLen,
        y1: sample.y - sample.normalY * halfLen,
        x2: sample.x + sample.normalX * halfLen,
        y2: sample.y + sample.normalY * halfLen,
      });
    }

    return sleepers;
  }

  /**
   * Computes left and right rail polyline points offset by half gauge.
   */
  public static computeTwinRailPaths(
    points: DioramaPoint[],
    gauge = 12,
    sampleCount = 30
  ): { leftRail: DioramaPoint[]; rightRail: DioramaPoint[] } {
    const samples = this.sampleCurve(points, sampleCount);
    const halfGauge = gauge / 2;

    const leftRail: DioramaPoint[] = [];
    const rightRail: DioramaPoint[] = [];

    for (const s of samples) {
      leftRail.push({
        x: s.x - s.normalX * halfGauge,
        y: s.y - s.normalY * halfGauge,
      });
      rightRail.push({
        x: s.x + s.normalX * halfGauge,
        y: s.y + s.normalY * halfGauge,
      });
    }

    return { leftRail, rightRail };
  }
}
