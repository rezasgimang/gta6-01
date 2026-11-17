// Mara, the courier: on foot with WASD, in a car with steering and throttle,
// E to steal or enter a parked car, F to punch. All movement is per fixed step.
import { CAR, CITY, HEAT, PLAYER } from './config.js';
import { resolveBuildings } from './city.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    cash: 0,
    inCar: null,
    punchTimer: 0,
    punchAnim: 0,
    speed: 0,
  };
}

function clampToCity(body, radius) {
  body.x = Math.max(radius, Math.min(CITY.width - radius, body.x));
  body.y = Math.max(radius, Math.min(CITY.height - radius, body.y));
}

function stepOnFoot(state, player, input, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.x += mx * PLAYER.walkSpeed * dt;
    player.y += my * PLAYER.walkSpeed * dt;
    player.angle = Math.atan2(my, mx);
    player.speed = PLAYER.walkSpeed;
  } else {
    player.speed = 0;
  }
  resolveBuildings(state.city, player, PLAYER.radius);
  clampToCity(player, PLAYER.radius);
}

function stepDriving(state, player, input, dt) {
  const car = player.inCar;
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  // Steering only bites while rolling, and flips when reversing.
  const rolling = Math.max(0.25, Math.abs(car.speed) / CAR.maxSpeed);
  car.angle += steer * CAR.turnRate * rolling * (car.speed >= 0 ? 1 : -1) * dt;
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 20 ? CAR.brake : CAR.accel * 0.6) * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  resolveBuildings(state.city, car, CAR.radius);
  clampToCity(car, CAR.radius);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  car.skid = Math.abs(steer) > 0 && Math.abs(car.speed) > 260 ? 1 : 0;
}

/** Try to enter the nearest stealable car; returns the car or null. */
function tryEnterCar(state, player) {
  let best = null;
  let bestD = 70;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return null;
  if (best.parked) {
    best.parked = false;
    state.heat = Math.min(HEAT.max, state.heat + HEAT.steal);
    state.heatTimer = 0;
    state.events.push({ type: 'steal', x: best.x, y: best.y });
  }
  best.driver = 'player';
  player.inCar = best;
  return best;
}

function exitCar(state, player) {
  const car = player.inCar;
  car.driver = null;
  // Step out to the driver's side so Mara is never stuck inside the car.
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.inCar = null;
  player.speed = 0;
}

/** Punch the nearest pedestrian in reach; returns the ped or null. */
function tryPunch(state, player) {
  if (player.punchTimer > 0) return null;
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  if (!best) return null;
  player.punchTimer = PLAYER.punchCooldown;
  player.punchAnim = 0.22;
  best.down = 2.5;
  best.flee = 1;
  player.cash += PLAYER.punchCash;
  state.heat = Math.min(HEAT.max, state.heat + HEAT.punch);
  state.heatTimer = 0;
  state.events.push({ type: 'punch', x: best.x, y: best.y });
  return best;
}

export function stepPlayer(state, input, dt) {
  const player = state.player;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;
  if (input.enter && !state.enterLatch) {
    state.enterLatch = true;
    if (player.inCar) exitCar(state, player);
    else tryEnterCar(state, player);
  }
  if (!input.enter) state.enterLatch = false;
  if (input.punch && !player.inCar) tryPunch(state, player);
  if (player.inCar) stepDriving(state, player, input, dt);
  else stepOnFoot(state, player, input, dt);
}
