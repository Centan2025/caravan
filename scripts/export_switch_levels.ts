import * as fs from 'fs';
import * as path from 'path';
import { FIXED_SCENARIOS } from '../src/core/switch/SwitchNetwork';
import { PROGRESSIVE_LEVELS } from '../src/core/switch/SwitchLevels';
import { ScenarioDefinition } from '../src/core/switch/SwitchTypes';

const BASE_DIR = path.resolve('levels', 'switch_rush');
const CLASSIC_DIR = path.join(BASE_DIR, 'classic');
const PROGRESSIVE_DIR = path.join(BASE_DIR, 'progressive');

fs.mkdirSync(CLASSIC_DIR, { recursive: true });
fs.mkdirSync(PROGRESSIVE_DIR, { recursive: true });

// Schema for engine-agnostic deserialization
const SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SwitchRushLevelDefinition",
  "description": "Engine-agnostic level definition for Switch Rush (Classic & 2.0 Progressive)",
  "type": "object",
  "required": [
    "id",
    "title",
    "manifest",
    "mode",
    "tickDurationMs",
    "spawnCadenceTicks",
    "activeJunctions",
    "initialJ1",
    "initialJ2",
    "initialJ3",
    "maxMistakes"
  ],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "title": { "type": "string" },
    "mode": { "type": "string", "enum": ["classic", "progressive"] },
    "district": { "type": ["string", "null"], "enum": ["suburb", "downtown", "industrial", "harbor", "night_express", null] },
    "levelFamily": { "type": ["string", "null"], "enum": ["learning", "timing", "priority", "route_selection", "traffic", "mastery", null] },
    "primaryChallenge": { "type": ["string", "null"] },
    "manifest": {
      "type": "array",
      "items": { "type": "string", "enum": ["R", "B", "G", "Y"] }
    },
    "tickDurationMs": { "type": "integer", "default": 700 },
    "spawnCadenceTicks": { "type": "integer", "default": 2 },
    "activeJunctions": {
      "type": "array",
      "items": { "type": "string", "enum": ["J1", "J2", "J3"] }
    },
    "initialJ1": { "type": "string", "enum": ["LEFT", "RIGHT"], "default": "LEFT" },
    "initialJ2": { "type": "string", "enum": ["RED", "BLUE"], "default": "RED" },
    "initialJ3": { "type": "string", "enum": ["GREEN", "YELLOW"], "default": "GREEN" },
    "maxMistakes": { "type": "integer", "default": 3 },
    "maxConcurrentVehicles": { "type": ["integer", "null"] },
    "spawnPreparationMs": { "type": ["integer", "null"] },
    "hint": { "type": ["string", "null"] }
  }
};

fs.writeFileSync(path.join(BASE_DIR, 'schema.json'), JSON.stringify(SCHEMA, null, 2), 'utf-8');

function formatClassicLevel(sc: ScenarioDefinition) {
  return {
    id: sc.id,
    title: sc.title ?? `Senaryo ${sc.id}`,
    mode: 'classic',
    district: null,
    levelFamily: null,
    primaryChallenge: null,
    manifest: [...sc.manifest],
    tickDurationMs: sc.tickDurationMs ?? 700,
    spawnCadenceTicks: sc.spawnCadenceTicks ?? 2,
    activeJunctions: sc.activeJunctions ? [...sc.activeJunctions] : ['J1', 'J2', 'J3'],
    initialJ1: sc.initialJ1 ?? 'LEFT',
    initialJ2: sc.initialJ2 ?? 'RED',
    initialJ3: sc.initialJ3 ?? 'GREEN',
    maxMistakes: sc.maxMistakes ?? 3,
    maxConcurrentVehicles: sc.maxConcurrentVehicles ?? null,
    spawnPreparationMs: sc.spawnPreparationMs ?? null,
    hint: sc.hint ?? null
  };
}

function formatProgressiveLevel(sc: ScenarioDefinition) {
  return {
    id: sc.id,
    title: sc.title ?? `Seviye ${sc.id}`,
    mode: 'progressive',
    district: sc.district ?? null,
    levelFamily: sc.levelFamily ?? null,
    primaryChallenge: sc.primaryChallenge ?? null,
    manifest: [...sc.manifest],
    tickDurationMs: sc.tickDurationMs ?? 700,
    spawnCadenceTicks: sc.spawnCadenceTicks ?? 2,
    activeJunctions: sc.activeJunctions ? [...sc.activeJunctions] : ['J1', 'J2', 'J3'],
    initialJ1: sc.initialJ1 ?? 'LEFT',
    initialJ2: sc.initialJ2 ?? 'RED',
    initialJ3: sc.initialJ3 ?? 'GREEN',
    maxMistakes: sc.maxMistakes ?? 3,
    maxConcurrentVehicles: sc.maxConcurrentVehicles ?? null,
    spawnPreparationMs: sc.spawnPreparationMs ?? null,
    hint: sc.hint ?? null
  };
}

const classicList = FIXED_SCENARIOS.map(formatClassicLevel);
const progressiveList = PROGRESSIVE_LEVELS.map(formatProgressiveLevel);

classicList.forEach((lvl) => {
  const fileName = `scenario_${String(lvl.id).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(CLASSIC_DIR, fileName), JSON.stringify(lvl, null, 2), 'utf-8');
});

progressiveList.forEach((lvl) => {
  const fileName = `level_${String(lvl.id).padStart(2, '0')}.json`;
  fs.writeFileSync(path.join(PROGRESSIVE_DIR, fileName), JSON.stringify(lvl, null, 2), 'utf-8');
});

fs.writeFileSync(path.join(BASE_DIR, 'classic_all.json'), JSON.stringify(classicList, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE_DIR, 'progressive_all.json'), JSON.stringify(progressiveList, null, 2), 'utf-8');

console.log(`✅ Exported ${classicList.length} classic levels to levels/switch_rush/classic/`);
console.log(`✅ Exported ${progressiveList.length} progressive levels to levels/switch_rush/progressive/`);
console.log(`✅ Exported classic_all.json, progressive_all.json, and schema.json`);
