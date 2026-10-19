import { SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';
import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { SidingSolver } from '../src/core/switch/graph/SidingSolver';

console.log('=== SIDING LEVELS IN-DEPTH AUDIT ===');

SIDING_LEVELS.forEach((lvl, idx) => {
  const top = lvl.topology as any;
  console.log(`\n========================================`);
  console.log(`LEVEL ${lvl.id}: ${lvl.title}`);
  console.log(`Topology ID: ${top.id} (${top.name})`);
  console.log(`Nodes (${top.nodes.length}):`, top.nodes.map((n: any) => `${n.id}[${n.type}]`).join(', '));
  console.log(`Edges (${top.edges.length}):`, top.edges.map((e: any) => `${e.from}->${e.to}${e.branch ? '(' + e.branch + ')' : ''}`).join(', '));
  console.log(`Switches (${top.switches.length}):`, top.switches.map((s: any) => `${s.id}[${s.branches.join('/')}]`).join(', '));
  console.log(`Manifest (${lvl.manifest.length}): [${lvl.manifest.join(', ')}]`);
  console.log(`Tick Duration: ${lvl.tickDurationMs}ms | Spawn Cadence: ${lvl.spawnCadenceTicks} ticks | Max Mistakes: ${lvl.maxMistakes}`);
  console.log(`Initial Switches:`, JSON.stringify(lvl.initialSwitches));
});

console.log('\n=== SOLVER RESULTS ===');
console.log('Level 1:', SidingSolver.solveLevel1());
console.log('Level 2:', SidingSolver.solveLevel2());
console.log('Level 3:', SidingSolver.solveLevel3());
console.log('Level 4:', SidingSolver.solveLevel4());
console.log('Level 5 Path A:', SidingSolver.solveLevel5StrategyA());
console.log('Level 5 Path B:', SidingSolver.solveLevel5StrategyB());
