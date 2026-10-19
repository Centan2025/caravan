import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';
import { FIXED_SCENARIOS } from '../src/core/switch/SwitchNetwork';

console.log('=== PROGRESSIVE 30 LEVELS AUDIT ===');

const junctionGroups = new Map<string, number[]>();

PROGRESSIVE_LEVELS.forEach(l => {
  const key = (l.activeJunctions || ['J1', 'J2', 'J3']).sort().join('+');
  if (!junctionGroups.has(key)) junctionGroups.set(key, []);
  junctionGroups.get(key)!.push(l.id);
});

console.log('Active Junction Groupings:');
for (const [key, ids] of junctionGroups.entries()) {
  console.log(`  [${key}]: ${ids.length} levels -> IDs: ${ids.join(', ')}`);
}

console.log('\nDetailed Matrix:');
PROGRESSIVE_LEVELS.forEach(l => {
  const aj = (l.activeJunctions || ['J1', 'J2', 'J3']).sort().join('+');
  const uniqueColors = new Set(l.manifest).size;
  console.log(`Lvl ${String(l.id).padStart(2, ' ')} | District: ${l.district?.padEnd(14, ' ')} | Juncs: ${aj.padEnd(8, ' ')} | Manifest: ${l.manifest.join('').padEnd(12, ' ')} (len:${l.manifest.length}, colors:${uniqueColors}) | Tick: ${l.tickDurationMs}ms | Cadence: ${l.spawnCadenceTicks} | MaxConc: ${l.maxConcurrentVehicles ?? 'unlim'}`);
});

console.log('\n=== CLASSIC 10 LEVELS ===');
FIXED_SCENARIOS.forEach(s => {
  console.log(`Classic ${s.id} | Manifest: ${s.manifest.join('')} (len: ${s.manifest.length})`);
});
