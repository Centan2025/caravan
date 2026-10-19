import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopologyDef, GraphScenarioDefinition } from '../src/core/switch/graph/GraphTypes';
import { DUAL_SIDING_TOPOLOGY } from './test_dual_siding';

// Single Siding Topology (SIDING_B removed, replaced with straight track)
const SINGLE_SIDING_TOPOLOGY: GraphTopologyDef = {
  id: 'siding_topology_single_test',
  name: 'Tek Park Cebi Ağı (Single Siding Baseline)',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 80 } },
    { id: 'SW_SIDING_A', type: 'SWITCH', position: { x: 270, y: 190 } },
    { id: 'SIDING_A', type: 'SIDING', capacity: 1, position: { x: 120, y: 300 } },
    { id: 'MERGE_A', type: 'WAYPOINT', position: { x: 270, y: 410 } },
    { id: 'WAYPOINT_MID', type: 'WAYPOINT', position: { x: 270, y: 550 } },
    { id: 'MERGE_B', type: 'WAYPOINT', position: { x: 270, y: 720 } },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 810 } },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 910 } },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 910 } },
  ],
  switches: [
    { id: 'SW_SIDING_A', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_a', from: 'SOURCE', to: 'SW_SIDING_A' },
    { id: 'e_a_main', from: 'SW_SIDING_A', to: 'MERGE_A', branch: 'MAIN' },
    { id: 'e_a_siding', from: 'SW_SIDING_A', to: 'SIDING_A', branch: 'SIDING' },
    { id: 'e_siding_a_merge', from: 'SIDING_A', to: 'MERGE_A' },
    { id: 'e_merge_a_mid', from: 'MERGE_A', to: 'WAYPOINT_MID' },
    { id: 'e_mid_merge_b', from: 'WAYPOINT_MID', to: 'MERGE_B' },
    { id: 'e_merge_b_sw', from: 'MERGE_B', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

const manifest = ['B', 'B', 'R', 'R'] as const;

console.log('=== TEST 1: DUAL SIDING NETWORK [B, B, R, R] ===');
const netDual = new GraphSwitchNetwork({
  id: 104,
  topology: DUAL_SIDING_TOPOLOGY,
  manifest: [...manifest],
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING_A', 'SW_SIDING_B', 'SW_STATION'],
  initialSwitches: { SW_SIDING_A: 'SIDING', SW_SIDING_B: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 1,
});
netDual.start();

let wonDual = false;
for (let t = 1; t <= 45; t++) {
  const v1 = netDual.vehicles.find(v => v.id === 1);
  const v2 = netDual.vehicles.find(v => v.id === 2);
  const v3 = netDual.vehicles.find(v => v.id === 3);
  const v4 = netDual.vehicles.find(v => v.id === 4);

  if (v1 && v1.state === 'PARKED' && netDual.switches['SW_SIDING_A'] === 'SIDING') {
    netDual.toggleJunction('SW_SIDING_A');
  }
  if (v2 && v2.state === 'PARKED' && netDual.switches['SW_SIDING_B'] === 'SIDING') {
    netDual.toggleJunction('SW_SIDING_B');
  }
  if (v3 && v3.state === 'DELIVERED' && v4 && v4.state === 'DELIVERED') {
    if (netDual.switches['SW_STATION'] !== 'BLUE') {
      netDual.toggleJunction('SW_STATION');
    }
    if (v1 && v1.state === 'PARKED') {
      netDual.releaseSiding('SIDING_A');
    }
    if (v2 && v2.state === 'PARKED' && (v1?.currentNode === 'SW_STATION' || v1?.state === 'DELIVERED')) {
      netDual.releaseSiding('SIDING_B');
    }
  }

  netDual.tick();
  if (netDual.status === 'WON') {
    wonDual = true;
    console.log(`Dual Siding: WON at tick ${t}, correct=${netDual.correctCount}, mistakes=${netDual.mistakeCount}`);
    break;
  }
}

console.log('\n=== TEST 2: COUNTERFACTUAL - SINGLE SIDING NETWORK [B, B, R, R] ===');
const netSingle = new GraphSwitchNetwork({
  id: 104,
  topology: SINGLE_SIDING_TOPOLOGY,
  manifest: [...manifest],
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING_A', 'SW_STATION'],
  initialSwitches: { SW_SIDING_A: 'SIDING', SW_STATION: 'RED' },
  maxMistakes: 1,
});
netSingle.start();

let lostSingle = false;
for (let t = 1; t <= 45; t++) {
  const v1 = netSingle.vehicles.find(v => v.id === 1);
  const v2 = netSingle.vehicles.find(v => v.id === 2);

  // V1 parks in SIDING_A
  if (v1 && v1.state === 'PARKED' && netSingle.switches['SW_SIDING_A'] === 'SIDING') {
    netSingle.toggleJunction('SW_SIDING_A');
  }

  // With only 1 siding, V2 cannot park. If SW_STATION stays RED, V2 misdelivers to RED.
  // If player sets SW_STATION to BLUE for V2, then V3 (RED) will arrive at BLUE and misdeliver!
  netSingle.tick();
  if (netSingle.status === 'LOST') {
    lostSingle = true;
    console.log(`Single Siding: FAILED / LOST at tick ${t} (Mistakes=${netSingle.mistakeCount})`);
    console.log(`Reason: Car 2 (B) could not be held in a second siding and was forced into conflict!`);
    break;
  }
}

console.log(`\nÖzet: Dual Siding Won = ${wonDual}, Single Siding Failed = ${lostSingle}`);
