// The city itself: roads, blocks, buildings, parked cars and the intersection
// grid the autopilot routes over. Built once from a seed, then read-only.
import { AVENUES, CITY, PARKED_COUNT, ROAD_W, SEA, SPOTS, STREETS } from './config.js';

function roadSpans() {
  const vertical = AVENUES.map((x) => ({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: CITY.height }));
  const horizontal = STREETS.map((y) => ({ x: 0, y: y - ROAD_W / 2, w: CITY.width, h: ROAD_W }));
  return { vertical, horizontal };
}

function pointOnRoad(x, y, margin) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + margin) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + margin) return true;
  return false;
}

function rectOverlapsRoad(rect, margin) {
  return (
    pointOnRoad(rect.x + rect.w / 2, rect.y + rect.h / 2, margin) ||
    pointOnRoad(rect.x, rect.y, margin) ||
    pointOnRoad(rect.x + rect.w, rect.y, margin) ||
    pointOnRoad(rect.x, rect.y + rect.h, margin) ||
    pointOnRoad(rect.x + rect.w, rect.y + rect.h, margin)
  );
}

function makeBuildings(random) {
  const buildings = [];
  // Walk the block grid between avenues and streets; drop 1-3 buildings per block.
  const xs = [SEA.west + SEA.beach, ...AVENUES, CITY.width];
  const ys = [0, ...STREETS, SEA.south];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 24;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 24;
      const y0 = ys[bj] + ROAD_W / 2 + 24;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 24;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const count = random.int(1, 3);
      for (let k = 0; k < count; k += 1) {
        const w = random.range(90, Math.min(260, x1 - x0));
        const h = random.range(90, Math.min(220, y1 - y0));
        const x = random.range(x0, Math.max(x0, x1 - w));
        const y = random.range(y0, Math.max(y0, y1 - h));
        const rect = { x, y, w, h, hue: random.pick([0, 1, 2]) };
        if (rectOverlapsRoad(rect, 8)) continue;
        // Keep mission spots clear so the player can always reach them.
        let clear = true;
        for (const spot of Object.values(SPOTS)) {
          if (spot.x > rect.x - 70 && spot.x < rect.x + rect.w + 70 && spot.y > rect.y - 70 && spot.y < rect.y + rect.h + 70) {
            clear = false;
          }
        }
        if (!clear) continue;
        buildings.push(rect);
      }
    }
  }
  return buildings;
}

function makeParkedCars(random) {
  const cars = [];
  let guard = 0;
  while (cars.length < PARKED_COUNT && guard < 400) {
    guard += 1;
    const vertical = random.next() < 0.5;
    const road = vertical ? random.pick(AVENUES) : random.pick(STREETS);
    const along = random.range(300, vertical ? CITY.height - 300 : CITY.width - 300);
    const side = random.pick([-1, 1]);
    const x = vertical ? road + side * (ROAD_W / 2 - 22) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 - 22);
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
    if (pointOnRoad(x, y, 0) === false) continue;
    let nearSpot = false;
    for (const spot of Object.values(SPOTS)) {
      if (Math.hypot(spot.x - x, spot.y - y) < 120) nearSpot = true;
    }
    if (nearSpot) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 130)) continue;
    cars.push({ x, y, angle, color: random.pick([0, 1, 2, 3, 4]), parked: true, speed: 0 });
  }
  return cars;
}

/** Intersections of every avenue with every street, for routing. */
function makeIntersections() {
  const nodes = [];
  for (const ax of AVENUES) {
    for (const sy of STREETS) nodes.push({ x: ax, y: sy });
  }
  return nodes;
}

export function createCity(random) {
  const roads = roadSpans();
  const buildings = makeBuildings(random);
  const parkedCars = makeParkedCars(random);
  const intersections = makeIntersections();
  return { roads, buildings, parkedCars, intersections };
}

/** True when the point is inside any building (with a small margin). */
export function hitsBuilding(city, x, y, margin) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function resolveBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nx;
    const dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      body.x = nx + (dx / d) * radius;
      body.y = ny + (dy / d) * radius;
    } else {
      // Centre inside the block: shove out along the shallowest side.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - radius;
      else if (m === right) body.x = b.x + b.w + radius;
      else if (m === top) body.y = b.y - radius;
      else body.y = b.y + b.h + radius;
    }
  }
  return hit;
}

/** Nearest road centre line to a point, and whether it is a vertical avenue. */
export function nearestRoad(x, y) {
  let best = { x: AVENUES[0], y, vertical: true, dist: Math.abs(x - AVENUES[0]) };
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < best.dist) best = { x: ax, y, vertical: true, dist: d };
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < best.dist) best = { x, y: sy, vertical: false, dist: d };
  }
  return best;
}
