// Traffic cars that follow their lane down one road, and pedestrians who walk
// the sidewalks, flee from danger and get knocked down by speeding cars.
import { AVENUES, CAR, CITY, HEAT, PED_COUNT, ROAD_W, STREETS, TRAFFIC_COUNT } from './config.js';
import { resolveBuildings } from './city.js';

function laneOffset(random) {
  return random.pick([-1, 1]) * (ROAD_W / 4);
}

export function createTraffic(random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const vertical = random.next() < 0.5;
    const road = vertical ? random.pick(AVENUES) : random.pick(STREETS);
    const along = random.range(200, vertical ? CITY.height - 200 : CITY.width - 200);
    const dir = random.pick([-1, 1]);
    cars.push({
      x: vertical ? road + laneOffset(random) : along,
      y: vertical ? along : road + laneOffset(random),
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      speed: random.range(120, 200),
      baseSpeed: 0,
      color: random.pick([0, 1, 2, 3, 4]),
      vertical,
      dir,
      police: false,
      parked: false,
      driver: 'traffic',
      skid: 0,
    });
  }
  for (const car of cars) car.baseSpeed = car.speed;
  return cars;
}

export function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.police || car.driver === 'player' || car.parked) continue;
    // Ease back to cruising speed after being slowed by a near miss.
    car.speed += (car.baseSpeed - car.speed) * Math.min(1, dt * 0.8);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the far end of its road so traffic never runs dry.
    if (car.vertical) {
      if (car.y < -60) car.y = CITY.height + 60;
      if (car.y > CITY.height + 60) car.y = -60;
    } else {
      if (car.x < -60) car.x = CITY.width + 60;
      if (car.x > CITY.width + 60) car.x = -60;
    }
    // Nudge apart from any car ahead in the same lane instead of overlapping.
    for (const other of state.cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 56 && d > 0.01) {
        const push = (56 - d) / 2;
        car.x -= (dx / d) * push;
        car.y -= (dy / d) * push;
        car.speed = Math.min(car.speed, other.speed);
      }
    }
  }
}

export function createPeds(random) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const vertical = random.next() < 0.5;
    const road = vertical ? random.pick(AVENUES) : random.pick(STREETS);
    const along = random.range(200, vertical ? CITY.height - 200 : CITY.width - 200);
    const side = random.pick([-1, 1]) * (ROAD_W / 2 + 26);
    peds.push({
      x: vertical ? road + side : along,
      y: vertical ? along : road + side,
      angle: random.range(0, Math.PI * 2),
      speed: random.range(36, 70),
      color: random.pick([0, 1, 2, 3, 4]),
      down: 0,
      flee: 0,
      wander: random.range(1, 4),
    });
  }
  return peds;
}

function nearestThreat(state, ped) {
  let best = null;
  let bestD = 170;
  const cars = state.cars.filter((c) => !c.parked);
  for (const car of cars) {
    if (Math.abs(car.speed) < 60) continue;
    const d = Math.hypot(car.x - ped.x, car.y - ped.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  const player = state.player;
  if (!player.inCar) {
    const d = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (d < 60 && player.punchAnim > 0) {
      best = player;
      bestD = d;
    }
  }
  return best;
}

export function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    const threat = nearestThreat(state, ped);
    if (threat) ped.flee = 1;
    else if (ped.flee > 0) ped.flee = Math.max(0, ped.flee - dt * 0.25);
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = Math.random() * 3 + 1;
      ped.angle = Math.random() * Math.PI * 2;
    }
    let speed = ped.speed;
    if (ped.flee > 0) {
      speed = ped.speed * 2.6;
      if (threat) {
        const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
        ped.angle = away;
      }
    }
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    resolveBuildings(state.city, ped, 12);
    ped.x = Math.max(12, Math.min(CITY.width - 12, ped.x));
    ped.y = Math.max(12, Math.min(CITY.height - 12, ped.y));
    // A fast car that touches a pedestrian knocks them down and raises heat.
    for (const car of state.cars) {
      if (car.parked || Math.abs(car.speed) < 120) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 34) {
        ped.down = 3;
        ped.flee = 1;
        if (car.driver === 'player') {
          state.heat = Math.min(HEAT.max, state.heat + HEAT.runOver);
          state.heatTimer = 0;
          state.events.push({ type: 'runover', x: ped.x, y: ped.y });
        }
      }
    }
  }
}
