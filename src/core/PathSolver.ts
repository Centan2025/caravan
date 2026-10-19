import {
  Direction,
  DIR_OFFSETS,
  getOppositeDir,
  TileData,
  TileGeometry,
  RouteStep,
  SimulationResult,
  FailureReason,
} from '../types';

export const BASE_CONNECTIONS: Record<TileGeometry, Direction[]> = {
  EMPTY: [],
  STRAIGHT: [0, 2],       // North & South
  ELBOW: [0, 1],          // North & East
  TEE: [3, 0, 1],         // West, North, East
  CROSS: [0, 1, 2, 3],    // All 4 directions
};

/**
 * Returns active connections for a given tile geometry and rotation.
 */
export function getTileConnections(geometry: TileGeometry, rotation: number): Direction[] {
  const base = BASE_CONNECTIONS[geometry] || [];
  const rot = ((rotation % 4) + 4) % 4;
  return base.map((dir) => ((dir + rot) % 4) as Direction);
}

/**
 * Deterministic junction resolution:
 * Rule:
 * 1. Caravan cannot go back the way it came (cannot exit through entrySide).
 * 2. Caravan prefers to go straight relative to incoming momentum (straight = opposite(entrySide)).
 * 3. If straight is not open, it checks clockwise priority:
 *    - Right: (straight + 1) % 4
 *    - Left:  (straight + 3) % 4
 */
export function chooseExitDirection(
  entrySide: Direction,
  availablePorts: Direction[]
): Direction | null {
  // Exclude reverse entry
  const forwardExits = availablePorts.filter((p) => p !== entrySide);
  if (forwardExits.length === 0) {
    return null; // Dead end
  }

  const straight = getOppositeDir(entrySide);
  if (forwardExits.includes(straight)) {
    return straight;
  }

  const right = ((straight + 1) % 4) as Direction;
  if (forwardExits.includes(right)) {
    return right;
  }

  const left = ((straight + 3) % 4) as Direction;
  if (forwardExits.includes(left)) {
    return left;
  }

  return null;
}

/**
 * Simulates path traversal from start tile with an initial exit direction.
 */
export function simulateRoute(
  tiles: TileData[],
  gridSize: number,
  startTile: { x: number; y: number; initialExitDir: Direction },
  maxSteps: number = 60
): SimulationResult {
  const tileMap = new Map<string, TileData>();
  for (const t of tiles) {
    tileMap.set(`${t.x},${t.y}`, t);
  }

  const steps: RouteStep[] = [];
  const visitedStates = new Set<string>();

  let curX = startTile.x;
  let curY = startTile.y;
  let curTile = tileMap.get(`${curX},${curY}`);

  if (!curTile) {
    return {
      success: false,
      status: 'DISCONNECTED',
      steps: [],
      errorMessage: 'Başlangıç karosu bulunamadı!',
      innVisited: false,
      marketReached: false,
      tilesTraversed: 0,
    };
  }

  // Initial step from Producer
  let curExitDir: Direction = startTile.initialExitDir;
  let curEntrySide: Direction = getOppositeDir(curExitDir); // Virtual entry for starting tile
  let innVisited = false;
  let marketReached = false;

  // Verify starting tile has the initialExitDir connected
  const startConnections = getTileConnections(curTile.geometry, curTile.rotation);
  if (!startConnections.includes(curExitDir)) {
    return {
      success: false,
      status: 'DEAD_END',
      steps: [
        {
          x: curX,
          y: curY,
          entrySide: curEntrySide,
          exitDir: curExitDir,
          stop: curTile.stop,
        },
      ],
      errorMessage: 'Üretici çıkış yönü karoya bağlı değil!',
      innVisited: false,
      marketReached: false,
      tilesTraversed: 0,
    };
  }

  steps.push({
    x: curX,
    y: curY,
    entrySide: curEntrySide,
    exitDir: curExitDir,
    stop: curTile.stop,
  });

  while (steps.length < maxSteps) {
    // 1. Move to next coordinate
    const offset = DIR_OFFSETS[curExitDir];
    const nextX = curX + offset.dx;
    const nextY = curY + offset.dy;

    // Check bounds
    if (nextX < 0 || nextX >= gridSize || nextY < 0 || nextY >= gridSize) {
      const errStep: RouteStep = {
        x: curX,
        y: curY,
        entrySide: curEntrySide,
        exitDir: curExitDir,
      };
      return {
        success: false,
        status: 'OUT_OF_BOUNDS',
        steps,
        errorStep: errStep,
        errorMessage: `Yol harita sınırlarının dışına çıktı! (${nextX}, ${nextY})`,
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }

    const nextTile = tileMap.get(`${nextX},${nextY}`);
    if (!nextTile || nextTile.geometry === 'EMPTY') {
      const errStep: RouteStep = {
        x: nextX,
        y: nextY,
        entrySide: getOppositeDir(curExitDir),
        exitDir: curExitDir,
      };
      return {
        success: false,
        status: 'DISCONNECTED',
        steps,
        errorStep: errStep,
        errorMessage: `Yol çölün ortasında bitti! (${nextX}, ${nextY}) boş arazi.`,
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }

    // 2. Check connection compatibility:
    // nextTile must have a port facing opposite(curExitDir)
    const nextEntrySide = getOppositeDir(curExitDir);
    const nextConnections = getTileConnections(nextTile.geometry, nextTile.rotation);

    if (!nextConnections.includes(nextEntrySide)) {
      const errStep: RouteStep = {
        x: nextX,
        y: nextY,
        entrySide: nextEntrySide,
        exitDir: curExitDir,
      };
      return {
        success: false,
        status: 'DISCONNECTED',
        steps,
        errorStep: errStep,
        errorMessage: `Yollar birbirine bağlanmıyor! (${nextX}, ${nextY}) karosunun girişi kapalı.`,
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }

    // 3. Process stop logic
    if (nextTile.stop === 'INN') {
      innVisited = true;
    } else if (nextTile.stop === 'MARKET') {
      if (!innVisited) {
        const errStep: RouteStep = {
          x: nextX,
          y: nextY,
          entrySide: nextEntrySide,
          exitDir: curExitDir,
          stop: 'MARKET',
        };
        return {
          success: false,
          status: 'WRONG_STOP_ORDER',
          steps,
          errorStep: errStep,
          errorMessage: 'Pazara ulaşıldı ancak Han (İpek Hanı) henüz ziyaret edilmedi! Ticaret zinciri bozuldu.',
          innVisited: false,
          marketReached: true,
          tilesTraversed: steps.length,
        };
      } else {
        // Success reached!
        marketReached = true;
        steps.push({
          x: nextX,
          y: nextY,
          entrySide: nextEntrySide,
          exitDir: curExitDir, // Reached final destination
          stop: 'MARKET',
        });
        return {
          success: true,
          status: 'SUCCESS',
          steps,
          errorMessage: 'Kervan tüm durakları sırasıyla başarıyla tamamladı!',
          innVisited: true,
          marketReached: true,
          tilesTraversed: steps.length,
        };
      }
    } else if (nextTile.stop === 'PRODUCER') {
      // Re-entering producer is not allowed
      const errStep: RouteStep = {
        x: nextX,
        y: nextY,
        entrySide: nextEntrySide,
        exitDir: curExitDir,
        stop: 'PRODUCER',
      };
      return {
        success: false,
        status: 'WRONG_STOP_ORDER',
        steps,
        errorStep: errStep,
        errorMessage: 'Kervan başladığı Üreticiye geri döndü!',
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }

    // 4. Closed loop check
    const stateKey = `${nextX},${nextY},${nextEntrySide},${innVisited ? 1 : 0}`;
    if (visitedStates.has(stateKey)) {
      const errStep: RouteStep = {
        x: nextX,
        y: nextY,
        entrySide: nextEntrySide,
        exitDir: curExitDir,
      };
      return {
        success: false,
        status: 'CLOSED_LOOP',
        steps,
        errorStep: errStep,
        errorMessage: 'Kervan kapalı bir döngüde sonsuz tura girdi!',
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }
    visitedStates.add(stateKey);

    // 5. Choose next exit using deterministic junction rules
    const nextExit = chooseExitDirection(nextEntrySide, nextConnections);
    if (nextExit === null) {
      const errStep: RouteStep = {
        x: nextX,
        y: nextY,
        entrySide: nextEntrySide,
        exitDir: curExitDir,
      };
      return {
        success: false,
        status: 'DEAD_END',
        steps,
        errorStep: errStep,
        errorMessage: `Çıkmaz sokak! (${nextX}, ${nextY}) karosunda ileriye açık yol yok.`,
        innVisited,
        marketReached,
        tilesTraversed: steps.length,
      };
    }

    // Record step
    steps.push({
      x: nextX,
      y: nextY,
      entrySide: nextEntrySide,
      exitDir: nextExit,
      stop: nextTile.stop,
    });

    curX = nextX;
    curY = nextY;
    curEntrySide = nextEntrySide;
    curExitDir = nextExit;
    curTile = nextTile;
  }

  return {
    success: false,
    status: 'CLOSED_LOOP',
    steps,
    errorMessage: 'Maksimum adım limitine ulaşıldı (döngü tespiti).',
    innVisited,
    marketReached,
    tilesTraversed: steps.length,
  };
}

/**
 * Checks a single step transition (for real-time Mode C checking).
 */
export function checkNextStep(
  curX: number,
  curY: number,
  exitDir: Direction,
  tiles: TileData[],
  gridSize: number,
  innAlreadyVisited: boolean
): {
  valid: boolean;
  reason?: FailureReason;
  message?: string;
  nextX: number;
  nextY: number;
  nextEntrySide: Direction;
  nextExitDir?: Direction;
  isInn: boolean;
  isMarket: boolean;
} {
  const offset = DIR_OFFSETS[exitDir];
  const nextX = curX + offset.dx;
  const nextY = curY + offset.dy;
  const nextEntrySide = getOppositeDir(exitDir);

  if (nextX < 0 || nextX >= gridSize || nextY < 0 || nextY >= gridSize) {
    return {
      valid: false,
      reason: 'OUT_OF_BOUNDS',
      message: 'Grid sınırlarının dışına çıkıldı!',
      nextX,
      nextY,
      nextEntrySide,
      isInn: false,
      isMarket: false,
    };
  }

  const targetTile = tiles.find((t) => t.x === nextX && t.y === nextY);
  if (!targetTile || targetTile.geometry === 'EMPTY') {
    return {
      valid: false,
      reason: 'DISCONNECTED',
      message: 'Önünüzde yol yok, boş araziye sapıldı!',
      nextX,
      nextY,
      nextEntrySide,
      isInn: false,
      isMarket: false,
    };
  }

  const ports = getTileConnections(targetTile.geometry, targetTile.rotation);
  if (!ports.includes(nextEntrySide)) {
    return {
      valid: false,
      reason: 'DISCONNECTED',
      message: 'Karonun girişi kapalı!',
      nextX,
      nextY,
      nextEntrySide,
      isInn: false,
      isMarket: false,
    };
  }

  const isInn = targetTile.stop === 'INN';
  const isMarket = targetTile.stop === 'MARKET';

  if (isMarket && !innAlreadyVisited && !isInn) {
    return {
      valid: false,
      reason: 'WRONG_STOP_ORDER',
      message: 'Han ziyaret edilmeden Pazara girilemez!',
      nextX,
      nextY,
      nextEntrySide,
      isInn,
      isMarket,
    };
  }

  if (isMarket && (innAlreadyVisited || isInn)) {
    return {
      valid: true,
      nextX,
      nextY,
      nextEntrySide,
      nextExitDir: exitDir,
      isInn,
      isMarket: true,
    };
  }

  const nextExit = chooseExitDirection(nextEntrySide, ports);
  if (nextExit === null) {
    return {
      valid: false,
      reason: 'DEAD_END',
      message: 'Çıkmaz sokak!',
      nextX,
      nextY,
      nextEntrySide,
      isInn,
      isMarket,
    };
  }

  return {
    valid: true,
    nextX,
    nextY,
    nextEntrySide,
    nextExitDir: nextExit,
    isInn,
    isMarket,
  };
}
