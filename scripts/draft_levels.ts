import { LevelDefinition } from '../src/core/chain/ChainTypes';
import { ChainSolver } from '../src/core/chain/ChainSolver';
import * as fs from 'fs';
import * as path from 'path';

export const LEVELS: LevelDefinition[] = [
  // LEVEL 1: Introductory straight column
  {
    id: 1,
    title: 'Seviye 1: İlk Kıvılcım (Tanıtım)',
    grid: [
      '....G',
      '....U',
      '....U',
      '....U',
      '....U',
    ],
    maxIgnitions: 1,
    hint: 'En alttaki oku ateşleyerek zinciri başlatın.',
  },

  // LEVEL 2: Simple turn with decoy
  {
    id: 2,
    title: 'Seviye 2: Köşeyi Dönmek',
    grid: [
      'R..DG',
      '.....',
      'R...U',
      '.....',
      'L....',
    ],
    // If tap (0, 0) -> R -> travels right -> hits D at (3, 0) -> travels down -> hits G at (4, 0)?
    // Wait, D at (3,0) moves DOWN: (3,1), (3,2)...
    // Let's design carefully:
    // (0,0) R -> goes right to (3,0) D -> goes down to (3,2) R -> goes right to (4,2) G!
    // And decoy tap at (0,4) L -> goes left offboard (losing opening)!
    maxIgnitions: 1,
    hint: 'Hedefe doğru dönen oku bulun.',
  },
];
