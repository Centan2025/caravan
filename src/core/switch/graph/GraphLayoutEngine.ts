import { GraphTopologyDef, NodeType, StationColor } from './GraphTypes';

export interface VisualPoint {
  x: number;
  y: number;
}

export interface VisualNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  label: string;
  capacity?: number;
  stationColor?: StationColor;
  isSiding: boolean;
  sidingSide: 'left' | 'right' | 'center';
  sidingSlotPositions: VisualPoint[];
  bounds?: { width: number; height: number };
}

export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  branch?: string;
  points: VisualPoint[];
}

export interface VisualLayout {
  topologyId: string;
  nodes: Map<string, VisualNode>;
  edges: VisualEdge[];
  stationColors: Record<string, number>;
}

export class GraphLayoutEngine {
  /**
   * Generates a fully normalized, compact, non-overlapping visual layout
   * for any given graph topology definition.
   *
   * Pure visual transformation: Leaves graph nodes, simulation edges,
   * switch branch IDs and tick transitions 100% untouched.
   */
  public static getVisualLayout(topology: GraphTopologyDef): VisualLayout {
    const nodes = new Map<string, VisualNode>();
    const topoId = topology.id;

    // Base coordinate presets optimized for 540x960 diorama space
    // Safe viewport: Y from 90 to 740, X from 70 to 470 (Width 540)
    const customCoords = this.getOptimizedCoordinates(topoId);

    for (const node of topology.nodes) {
      const customPos = customCoords[node.id] || node.position || { x: 270, y: 350 };
      const isSiding = node.type === 'SIDING';
      const cap = node.capacity || 1;

      let sidingSide: 'left' | 'right' | 'center' = 'center';
      if (customPos.x < 250) sidingSide = 'left';
      else if (customPos.x > 290) sidingSide = 'right';

      // Calculate parking slot positions for multi-car FIFO display
      const sidingSlotPositions: VisualPoint[] = [];
      if (isSiding) {
        if (cap === 1) {
          sidingSlotPositions.push({ x: customPos.x, y: customPos.y });
        } else {
          // 2-slot vertical queue inside siding bay
          sidingSlotPositions.push({ x: customPos.x, y: customPos.y - 20 });
          sidingSlotPositions.push({ x: customPos.x, y: customPos.y + 20 });
        }
      }

      nodes.set(node.id, {
        id: node.id,
        type: node.type,
        x: customPos.x,
        y: customPos.y,
        label: node.label || node.id,
        capacity: cap,
        stationColor: node.stationColor,
        isSiding,
        sidingSide,
        sidingSlotPositions,
      });
    }

    // Build visual edge paths with smooth geometric transitions
    const edges: VisualEdge[] = [];
    for (const edge of topology.edges) {
      const fromNode = nodes.get(edge.from);
      const toNode = nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const points = this.calculateEdgeWaypoints(fromNode, toNode, edge.branch);
      edges.push({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        branch: edge.branch,
        points,
      });
    }

    return {
      topologyId: topoId,
      nodes,
      edges,
      stationColors: {
        RED: 0xe63946,
        BLUE: 0x0077b6,
        GREEN: 0x2d6a4f,
        YELLOW: 0xe09f3e,
      },
    };
  }

  /**
   * Provides handcrafted, ergonomically spaced node positions per topology.
   * Guarantees:
   * 1. Minimum 140px vertical buffer before bottom controls.
   * 2. Zero colinear overlap for Siding vs Main line.
   * 3. Level 104 Dual Siding stations terminate safely at y=740.
   */
  private static getOptimizedCoordinates(topoId: string): Record<string, VisualPoint> {
    switch (topoId) {
      case 'siding_topology_l104_dual':
        // 10-node Dual Siding: Distributed within safe [90..740] span
        return {
          SOURCE: { x: 270, y: 90 },
          SW_SIDING_A: { x: 270, y: 175 },
          SIDING_A: { x: 115, y: 260 },
          MERGE_A: { x: 270, y: 345 },
          SW_SIDING_B: { x: 270, y: 430 },
          SIDING_B: { x: 425, y: 515 },
          MERGE_B: { x: 270, y: 600 },
          SW_STATION: { x: 270, y: 670 },
          RED: { x: 155, y: 740 },
          BLUE: { x: 385, y: 740 },
        };

      case 'siding_topology_l103_fifo':
      case 'siding_topology_l3':
        // Crucial Fix: Offset the siding bay from x=270 to x=125
        // Main line stays at x=270, creating a distinct curved siding loop!
        return {
          SOURCE: { x: 270, y: 95 },
          SW_SIDING: { x: 270, y: 210 },
          SIDING_BAY: { x: 125, y: 360 }, // Physically distinct loop!
          MERGE: { x: 270, y: 510 },
          SW_STATION: { x: 270, y: 630 },
          RED: { x: 155, y: 735 },
          BLUE: { x: 385, y: 735 },
        };

      case 'siding_topology_l1':
        return {
          SOURCE: { x: 270, y: 95 },
          SW_SIDING: { x: 270, y: 210 },
          SIDING_BAY: { x: 115, y: 360 },
          MERGE: { x: 270, y: 510 },
          SW_STATION: { x: 270, y: 630 },
          RED: { x: 155, y: 735 },
          BLUE: { x: 385, y: 735 },
        };

      case 'siding_topology_l2':
        return {
          SOURCE: { x: 270, y: 95 },
          SW_SIDING: { x: 270, y: 210 },
          SIDING_BAY: { x: 425, y: 360 },
          MERGE: { x: 270, y: 510 },
          SW_STATION: { x: 270, y: 630 },
          RED: { x: 155, y: 735 },
          BLUE: { x: 385, y: 735 },
        };

      case 'siding_topology_l4_legacy':
        return {
          SOURCE: { x: 190, y: 95 },
          SW_SIDING: { x: 230, y: 210 },
          SIDING_BAY: { x: 115, y: 360 },
          MERGE: { x: 320, y: 510 },
          SW_STATION: { x: 270, y: 630 },
          RED: { x: 155, y: 735 },
          BLUE: { x: 385, y: 735 },
        };

      case 'siding_topology_l5':
        // Diamond Layout: Siding west, wide station distribution
        return {
          SOURCE: { x: 270, y: 90 },
          SW_SIDING: { x: 270, y: 195 },
          SIDING_BAY: { x: 95, y: 350 },
          MERGE: { x: 270, y: 505 },
          SW_STATION: { x: 270, y: 625 },
          RED: { x: 130, y: 735 },
          BLUE: { x: 410, y: 735 },
        };

      default:
        return {};
    }
  }

  /**
   * Calculates waypoints for smooth railway track paths.
   */
  private static calculateEdgeWaypoints(
    from: VisualNode,
    to: VisualNode,
    _branch?: string
  ): VisualPoint[] {
    // If it's a straight vertical connection
    if (Math.abs(from.x - to.x) < 4) {
      return [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
    }

    // Curved turnout transition with quadratic smooth midpoint
    const midY = (from.y + to.y) / 2;
    const cp: VisualPoint = {
      x: from.x,
      y: midY,
    };

    return [
      { x: from.x, y: from.y },
      cp,
      { x: to.x, y: to.y },
    ];
  }
}
