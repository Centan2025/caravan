import { GraphSwitchNetwork } from '../src/core/switch/graph/GraphSwitchNetwork';
import { SIDING_LEVELS } from '../src/core/switch/graph/SidingLevels';
import { SidingSolver } from '../src/core/switch/graph/SidingSolver';

console.log('=== FAZ 1: KANIT DOĞRULAMA ÇALIŞTIRILIYOR ===\n');

// 1. İZOMORFİZM DOĞRULAMASI (101 - 105)
console.log('--- 1. Çizge İzomorfizmi Kontrolü ---');
const topologies = SIDING_LEVELS.map((lvl) => {
  const top = typeof lvl.topology === 'string' ? null : lvl.topology;
  return {
    id: lvl.id,
    topId: top?.id,
    nodeCount: top?.nodes.length,
    edgeCount: top?.edges.length,
    switchCount: top?.switches.length,
    edges: top?.edges.map(e => `${e.from}->${e.to}${e.branch ? `(${e.branch})` : ''}`).sort(),
  };
});

topologies.forEach((t, i) => {
  console.log(`Lvl ${t.id} (${t.topId}): |V|=${t.nodeCount}, |E|=${t.edgeCount}, Switches=${t.switchCount}`);
});

const baseEdges = JSON.stringify(topologies[0].edges);
const allIsomorphic = topologies.every((t) => JSON.stringify(t.edges) === baseEdges);
console.log(`Bütün 101-105 ağları yapısal olarak birebir İZOMORF mu? ${allIsomorphic ? 'EVET (G_1 ≅ G_2 ≅ G_3 ≅ G_4 ≅ G_5)' : 'HAYIR'}`);

// 2. 102 vs 104 ÇÖZÜM DİZİLERİNİN KARŞILAŞTIRILMASI
console.log('\n--- 2. 102 vs 104 Karşılaştırması ---');
const sol102 = SidingSolver.solveLevel2();
const sol104 = SidingSolver.solveLevel4();
console.log(`102 Sonuç: won=${sol102.won}, ticks=${sol102.ticks}, strategy="${sol102.strategyUsed}"`);
console.log(`104 Sonuç: won=${sol104.won}, ticks=${sol104.ticks}, strategy="${sol104.strategyUsed}"`);
console.log('102 Manifest: [B, R]');
console.log('104 Manifest: [B, R, B, R]');

// 3. 105 PATH A ve PATH B SİMÜLASYON İZİ
console.log('\n--- 3. 105 Path A (Siding) vs Path B (Doğrudan Zamanlama) İzleri ---');

function runTrace105A() {
  const sc = SIDING_LEVELS[4];
  const net = new GraphSwitchNetwork(sc);
  net.start();
  net.toggleJunction('SW_SIDING'); // switch to SIDING
  const trace: string[] = [];
  trace.push(`Tick 0: Start. SW_SIDING set to SIDING, SW_STATION=RED`);

  for (let t = 1; t <= 35; t++) {
    const car1 = net.vehicles.find((v) => v.id === 1);
    const car2 = net.vehicles.find((v) => v.id === 2);

    if (car1 && car1.state === 'PARKED' && net.switches['SW_SIDING'] !== 'MAIN' && !net.isJunctionLocked('SW_SIDING')) {
      net.toggleJunction('SW_SIDING');
      trace.push(`Tick ${t}: ACTION toggle SW_SIDING -> MAIN (Car 1 parked)`);
    }

    if (car2 && (car2.currentNode === 'MERGE' || car2.toNode === 'SW_STATION')) {
      if (net.switches['SW_STATION'] !== 'BLUE' && !net.isJunctionLocked('SW_STATION')) {
        net.toggleJunction('SW_STATION');
        trace.push(`Tick ${t}: ACTION toggle SW_STATION -> BLUE (Car 2 approaching)`);
      }
    }

    if (car2 && car2.state === 'DELIVERED') {
      if (net.switches['SW_STATION'] !== 'RED' && !net.isJunctionLocked('SW_STATION')) {
        net.toggleJunction('SW_STATION');
        trace.push(`Tick ${t}: ACTION toggle SW_STATION -> RED`);
      }
      if (car1 && car1.state === 'PARKED') {
        net.releaseSiding('SIDING_BAY');
        trace.push(`Tick ${t}: ACTION releaseSiding SIDING_BAY (Car 1)`);
      }
    }

    net.tick();

    const activeInfo = net.vehicles.map(v => `V${v.id}(${v.color}):${v.state}@${v.currentNode}${v.toNode ? '->' + v.toNode : ''}`).join(' | ');
    trace.push(`Tick ${t}: status=${net.status}, vehicles=[${activeInfo}], corr=${net.correctCount}`);
    if (net.status === 'WON' || net.status === 'LOST') break;
  }
  return trace;
}

function runTrace105B() {
  const sc = SIDING_LEVELS[4];
  const net = new GraphSwitchNetwork(sc);
  net.start();
  const trace: string[] = [];
  trace.push(`Tick 0: Start. SW_SIDING remains MAIN throughout! SW_STATION=RED`);

  for (let t = 1; t <= 35; t++) {
    for (const v of net.vehicles) {
      if (v.state === 'WAITING' && v.currentNode === 'SW_STATION') {
        const needed = v.targetStation === 'RED' ? 'RED' : 'BLUE';
        if (net.switches['SW_STATION'] !== needed && !net.isJunctionLocked('SW_STATION')) {
          net.toggleJunction('SW_STATION');
          trace.push(`Tick ${t}: ACTION toggle SW_STATION -> ${needed} for V${v.id}(${v.color})`);
        }
      }
    }

    net.tick();

    const activeInfo = net.vehicles.map(v => `V${v.id}(${v.color}):${v.state}@${v.currentNode}${v.toNode ? '->' + v.toNode : ''}`).join(' | ');
    trace.push(`Tick ${t}: status=${net.status}, vehicles=[${activeInfo}], corr=${net.correctCount}`);
    if (net.status === 'WON' || net.status === 'LOST') break;
  }
  return trace;
}

console.log('--- Path A Trace (Özet) ---');
const traceA = runTrace105A();
traceA.slice(0, 15).forEach(line => console.log(line));
console.log(`... Toplam ${traceA.length} adım.`);

console.log('\n--- Path B Trace (Özet) ---');
const traceB = runTrace105B();
traceB.slice(0, 15).forEach(line => console.log(line));
console.log(`... Toplam ${traceB.length} adım.`);
