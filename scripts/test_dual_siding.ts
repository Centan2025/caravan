import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopologyDef, GraphScenarioDefinition } from '../src/core/switch/graph/GraphTypes';

export const DUAL_SIDING_TOPOLOGY: GraphTopologyDef = {
  id: 'siding_topology_dual',
  name: 'Çift Park Cebi Ağı (Dual Siding)',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 80 }, label: 'Kargo Çıkış' },
    { id: 'SW_SIDING_A', type: 'SWITCH', position: { x: 270, y: 190 }, label: 'Makas 1 (Sol Cep)' },
    { id: 'SIDING_A', type: 'SIDING', capacity: 1, position: { x: 120, y: 300 }, label: 'Sol Cep A' },
    { id: 'MERGE_A', type: 'WAYPOINT', position: { x: 270, y: 410 }, label: 'Kavşak A' },
    { id: 'SW_SIDING_B', type: 'SWITCH', position: { x: 270, y: 520 }, label: 'Makas 2 (Sağ Cep)' },
    { id: 'SIDING_B', type: 'SIDING', capacity: 1, position: { x: 420, y: 630 }, label: 'Sağ Cep B' },
    { id: 'MERGE_B', type: 'WAYPOINT', position: { x: 270, y: 720 }, label: 'Ana Birleşme' },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 810 }, label: 'İstasyon Makası' },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 910 }, label: 'Kırmızı İstasyon' },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 910 }, label: 'Mavi İstasyon' },
  ],
  switches: [
    { id: 'SW_SIDING_A', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_SIDING_B', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'RED' },
  ],
  edges: [
    { id: 'e_src_a', from: 'SOURCE', to: 'SW_SIDING_A' },
    { id: 'e_a_main', from: 'SW_SIDING_A', to: 'MERGE_A', branch: 'MAIN' },
    { id: 'e_a_siding', from: 'SW_SIDING_A', to: 'SIDING_A', branch: 'SIDING' },
    { id: 'e_siding_a_merge', from: 'SIDING_A', to: 'MERGE_A' },
    { id: 'e_merge_a_b', from: 'MERGE_A', to: 'SW_SIDING_B' },
    { id: 'e_b_main', from: 'SW_SIDING_B', to: 'MERGE_B', branch: 'MAIN' },
    { id: 'e_b_siding', from: 'SW_SIDING_B', to: 'SIDING_B', branch: 'SIDING' },
    { id: 'e_siding_b_merge', from: 'SIDING_B', to: 'MERGE_B' },
    { id: 'e_merge_b_sw', from: 'MERGE_B', to: 'SW_STATION' },
    { id: 'e_sw_red', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e_sw_blue', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

// Scenario: Manifest: ['B', 'B', 'R', 'R'], spawnCadenceTicks = 2
// Car 1 (B) -> Parks in SIDING_A
// Car 2 (B) -> Bypasses SW_SIDING_A on MAIN, parks in SIDING_B
// Car 3 (R) & Car 4 (R) -> Pass both on MAIN -> RED Station
// SIDING_A & SIDING_B released -> BLUE Station
const scDual: GraphScenarioDefinition = {
  id: 1042,
  title: 'Level 104 Dual-Siding Test',
  topology: DUAL_SIDING_TOPOLOGY,
  manifest: ['B', 'B', 'R', 'R'],
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING_A', 'SW_SIDING_B', 'SW_STATION'],
  initialSwitches: {
    SW_SIDING_A: 'SIDING',
    SW_SIDING_B: 'SIDING',
    SW_STATION: 'RED',
  },
  maxMistakes: 2,
};

const net = new GraphSwitchNetwork(scDual);
net.start();

console.log('Testing Dual-Siding execution...');
for (let t = 1; t <= 35; t++) {
  const v1 = net.vehicles.find(v => v.id === 1);
  const v2 = net.vehicles.find(v => v.id === 2);
  const v3 = net.vehicles.find(v => v.id === 3);
  const v4 = net.vehicles.find(v => v.id === 4);

  // Once V1 is parked in SIDING_A, set SW_SIDING_A to MAIN so V2 can proceed to SIDING_B
  if (v1 && v1.state === 'PARKED' && net.switches['SW_SIDING_A'] === 'SIDING') {
    net.toggleJunction('SW_SIDING_A');
    console.log(`Tick ${t}: Action: SW_SIDING_A switched to MAIN (V1 parked in SIDING_A)`);
  }

  // Once V2 is parked in SIDING_B, set SW_SIDING_B to MAIN so V3 & V4 can bypass
  if (v2 && v2.state === 'PARKED' && net.switches['SW_SIDING_B'] === 'SIDING') {
    net.toggleJunction('SW_SIDING_B');
    console.log(`Tick ${t}: Action: SW_SIDING_B switched to MAIN (V2 parked in SIDING_B)`);
  }

  // When V3 & V4 delivered at RED:
  if (v3 && v3.state === 'DELIVERED' && v4 && v4.state === 'DELIVERED') {
    if (net.switches['SW_STATION'] !== 'BLUE') {
      net.toggleJunction('SW_STATION');
      console.log(`Tick ${t}: Action: SW_STATION toggled to BLUE`);
    }
    // Release SIDING_A if still parked
    if (v1 && v1.state === 'PARKED') {
      net.releaseSiding('SIDING_A');
      console.log(`Tick ${t}: Action: Released SIDING_A`);
    }
    // Release SIDING_B if still parked and MERGE_B is free
    if (v2 && v2.state === 'PARKED' && (v1?.currentNode === 'SW_STATION' || v1?.state === 'DELIVERED')) {
      net.releaseSiding('SIDING_B');
      console.log(`Tick ${t}: Action: Released SIDING_B`);
    }
  }

  net.tick();
  console.log(`Tick ${t}: net.status=${net.status}, correct=${net.correctCount}, mistakes=${net.mistakeCount}`);
  if (net.status === 'WON' || net.status === 'LOST') break;
}

console.log(`Result: ${net.status} with correct=${net.correctCount}, mistakes=${net.mistakeCount}`);
