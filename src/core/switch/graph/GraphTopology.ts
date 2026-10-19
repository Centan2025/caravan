import {
  GraphTopologyDef,
  GraphNodeDef,
  GraphEdgeDef,
  GraphSwitchDef,
  StationColor,
} from './GraphTypes';

export const CLASSIC_TREE_TOPOLOGY: GraphTopologyDef = {
  id: 'classic_tree',
  name: 'Classic Binary Tree',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 130 } },
    { id: 'J1', type: 'SWITCH', position: { x: 270, y: 280 } },
    { id: 'J2', type: 'SWITCH', position: { x: 160, y: 470 } },
    { id: 'J3', type: 'SWITCH', position: { x: 380, y: 470 } },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 90, y: 700 } },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 230, y: 700 } },
    { id: 'GREEN', type: 'STATION', stationColor: 'GREEN', position: { x: 310, y: 700 } },
    { id: 'YELLOW', type: 'STATION', stationColor: 'YELLOW', position: { x: 450, y: 700 } },
  ],
  switches: [
    { id: 'J1', branches: ['LEFT', 'RIGHT'], defaultBranch: 'LEFT' },
    { id: 'J2', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
    { id: 'J3', branches: ['GREEN', 'YELLOW'], defaultBranch: 'GREEN' },
  ],
  edges: [
    { id: 'e_src_j1', from: 'SOURCE', to: 'J1' },
    { id: 'e_j1_j2', from: 'J1', to: 'J2', branch: 'LEFT' },
    { id: 'e_j1_j3', from: 'J1', to: 'J3', branch: 'RIGHT' },
    { id: 'e_j2_red', from: 'J2', to: 'RED', branch: 'RED' },
    { id: 'e_j2_blue', from: 'J2', to: 'BLUE', branch: 'BLUE' },
    { id: 'e_j3_green', from: 'J3', to: 'GREEN', branch: 'GREEN' },
    { id: 'e_j3_yellow', from: 'J3', to: 'YELLOW', branch: 'YELLOW' },
  ],
};

export class GraphTopology {
  public readonly def: GraphTopologyDef;
  private readonly nodesMap: Map<string, GraphNodeDef> = new Map();
  private readonly switchesMap: Map<string, GraphSwitchDef> = new Map();
  private readonly outgoingEdgesMap: Map<string, GraphEdgeDef[]> = new Map();
  private readonly incomingEdgesMap: Map<string, GraphEdgeDef[]> = new Map();
  private readonly downstreamRankMap: Map<string, number> = new Map();

  constructor(topologyDef: GraphTopologyDef = CLASSIC_TREE_TOPOLOGY) {
    this.def = topologyDef;
    this.init();
  }

  private init(): void {
    for (const node of this.def.nodes) {
      this.nodesMap.set(node.id, node);
      this.outgoingEdgesMap.set(node.id, []);
      this.incomingEdgesMap.set(node.id, []);
    }

    for (const sw of this.def.switches) {
      this.switchesMap.set(sw.id, sw);
    }

    for (const edge of this.def.edges) {
      const outList = this.outgoingEdgesMap.get(edge.from);
      if (outList) outList.push(edge);

      const inList = this.incomingEdgesMap.get(edge.to);
      if (inList) inList.push(edge);
    }

    this.computeDownstreamRanks();
  }

  /**
   * Computes reverse topological rank (distance to nearest station/sink).
   * Downstream nodes have lower rank.
   * Stations have rank 0.
   * Predecessors to stations have rank 1.
   * SOURCE has higher rank (e.g. rank 3).
   * In ready-departure sort, nodes are processed by rank ASCENDING:
   * Rank 1 (J2, J3) departs before Rank 2 (J1), which departs before Rank 3 (SOURCE).
   */
  private computeDownstreamRanks(): void {
    // Breadth-first search backwards from all stations
    const queue: Array<{ nodeId: string; distance: number }> = [];
    const visited = new Map<string, number>();

    for (const node of this.def.nodes) {
      if (node.type === 'STATION') {
        queue.push({ nodeId: node.id, distance: 0 });
        visited.set(node.id, 0);
      }
    }

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;
      const inEdges = this.incomingEdgesMap.get(nodeId) || [];
      for (const edge of inEdges) {
        const prevNodeId = edge.from;
        const nextDist = distance + 1;
        // In DAG, choose max distance or min distance to sink. Min distance ensures it departs as soon as downstream is clear
        if (!visited.has(prevNodeId) || visited.get(prevNodeId)! > nextDist) {
          visited.set(prevNodeId, nextDist);
          queue.push({ nodeId: prevNodeId, distance: nextDist });
        }
      }
    }

    // Assign ranks
    for (const node of this.def.nodes) {
      this.downstreamRankMap.set(node.id, visited.get(node.id) ?? 999);
    }
  }

  public getNode(id: string): GraphNodeDef | undefined {
    return this.nodesMap.get(id);
  }

  public getSwitch(id: string): GraphSwitchDef | undefined {
    return this.switchesMap.get(id);
  }

  public isStation(nodeId: string): boolean {
    const node = this.nodesMap.get(nodeId);
    return node?.type === 'STATION';
  }

  public isSiding(nodeId: string): boolean {
    const node = this.nodesMap.get(nodeId);
    return node?.type === 'SIDING';
  }

  public isSource(nodeId: string): boolean {
    const node = this.nodesMap.get(nodeId);
    return node?.type === 'SOURCE';
  }

  public getStationColor(nodeId: string): StationColor | undefined {
    return this.nodesMap.get(nodeId)?.stationColor;
  }

  public getNodeCapacity(nodeId: string): number {
    const node = this.nodesMap.get(nodeId);
    if (!node) return 1;
    if (node.type === 'STATION') return Infinity;
    return node.capacity ?? 1;
  }

  public getDownstreamRank(nodeId: string): number {
    return this.downstreamRankMap.get(nodeId) ?? 999;
  }

  /**
   * Resolves the next node for a vehicle resting at fromNode given current switch states.
   */
  public resolveNextNode(fromNodeId: string, switchStates: Record<string, string>): string | null {
    const outEdges = this.outgoingEdgesMap.get(fromNodeId) || [];
    if (outEdges.length === 0) {
      return null;
    }

    const sw = this.switchesMap.get(fromNodeId);
    if (sw) {
      const activeBranch = switchStates[fromNodeId] ?? sw.defaultBranch ?? sw.branches[0];
      const matchingEdge = outEdges.find((e) => e.branch === activeBranch);
      return matchingEdge ? matchingEdge.to : outEdges[0].to;
    }

    // Default: first outgoing edge
    return outEdges[0].to;
  }

  public getOutgoingEdges(nodeId: string): GraphEdgeDef[] {
    return this.outgoingEdgesMap.get(nodeId) || [];
  }
}
