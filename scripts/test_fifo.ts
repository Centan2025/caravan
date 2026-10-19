import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { GraphTopologyDef, GraphScenarioDefinition } from '../src/core/switch/graph/GraphTypes';

const FIFO_TOPOLOGY: GraphTopologyDef = {
  id: 'siding_fifo_test',
  name: 'FIFO Test Network',
  nodes: [
    { id: 'SOURCE', type: 'SOURCE', position: { x: 270, y: 100 } },
    { id: 'SW_SIDING', type: 'SWITCH', position: { x: 270, y: 200 } },
    { id: 'SIDING_BAY', type: 'SIDING', capacity: 2, position: { x: 120, y: 350 } },
    { id: 'MERGE', type: 'WAYPOINT', position: { x: 270, y: 500 } },
    { id: 'SW_STATION', type: 'SWITCH', position: { x: 270, y: 620 } },
    { id: 'RED', type: 'STATION', stationColor: 'RED', position: { x: 160, y: 750 } },
    { id: 'BLUE', type: 'STATION', stationColor: 'BLUE', position: { x: 380, y: 750 } },
  ],
  switches: [
    { id: 'SW_SIDING', branches: ['MAIN', 'SIDING'], defaultBranch: 'SIDING' },
    { id: 'SW_STATION', branches: ['RED', 'BLUE'], defaultBranch: 'BLUE' },
  ],
  edges: [
    { id: 'e1', from: 'SOURCE', to: 'SW_SIDING' },
    { id: 'e2', from: 'SW_SIDING', to: 'MERGE', branch: 'MAIN' },
    { id: 'e3', from: 'SW_SIDING', to: 'SIDING_BAY', branch: 'SIDING' },
    { id: 'e4', from: 'SIDING_BAY', to: 'MERGE' },
    { id: 'e5', from: 'MERGE', to: 'SW_STATION' },
    { id: 'e6', from: 'SW_STATION', to: 'RED', branch: 'RED' },
    { id: 'e7', from: 'SW_STATION', to: 'BLUE', branch: 'BLUE' },
  ],
};

const sc: GraphScenarioDefinition = {
  id: 999,
  topology: FIFO_TOPOLOGY,
  manifest: ['B', 'R'],
  spawnCadenceTicks: 3,
  activeJunctions: ['SW_SIDING', 'SW_STATION'],
  initialSwitches: { SW_SIDING: 'SIDING', SW_STATION: 'BLUE' },
};

const net = new GraphSwitchNetwork(sc);
net.start();

console.log('Testing FIFO Siding with capacity: 2');
for (let t = 1; t <= 15; t++) {
  net.tick();
  const v1 = net.vehicles.find(v => v.id === 1);
  const v2 = net.vehicles.find(v => v.id === 2);
  console.log(`Tick ${t}: V1=${v1 ? `${v1.state}@${v1.currentNode}` : 'none'}, V2=${v2 ? `${v2.state}@${v2.currentNode}` : 'none'}, parkedCount=${net.vehicles.filter(v => v.state === 'PARKED').length}`);
}

// Now both should be parked in SIDING_BAY
console.log('\nBoth cars should be PARKED in SIDING_BAY now. Calling releaseSiding...');
net.releaseSiding('SIDING_BAY');

for (let t = 16; t <= 25; t++) {
  net.tick();
  const v1 = net.vehicles.find(v => v.id === 1);
  const v2 = net.vehicles.find(v => v.id === 2);
  console.log(`Tick ${t}: V1=${v1 ? `${v1.state}@${v1.currentNode}` : 'none'}, V2=${v2 ? `${v2.state}@${v2.currentNode}` : 'none'}`);
  
  // If V1 cleared MERGE and V2 is still PARKED, release V2
  if (v1 && (v1.currentNode === 'SW_STATION' || v1.currentNode === 'BLUE') && v2 && v2.state === 'PARKED') {
    console.log(`Tick ${t}: V1 departed, releasing second car from FIFO siding...`);
    net.releaseSiding('SIDING_BAY');
  }
}
