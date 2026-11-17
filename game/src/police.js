// The wanted system: heat cools after a few clean seconds, stars follow heat,
// and police cars spawn, chase, ram, back off and — when Mara is on foot —
// hold her until she is busted.
import { CITY, COP, HEAT } from './config.js';
import { resolveBuildings } from './city.js';

export function wantedStars(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 20));
}

function spawnCop(state) {
  const player = state.player;
  const angle = Math.random() * Math.PI * 2;
  const x = player.x + Math.cos(angle) * COP.spawnDistance;
  const y = player.y + Math.sin(angle) * COP.spawnDistance;
  const cop = {
    x: Math.max(40, Math.min(CITY.width - 40, x)),
    y: Math.max(40, Math.min(CITY.height - 40, y)),
    angle: Math.atan2(player.y - y, player.x - x),
    speed: 0,
    color: 0,
    police: true,
    parked: false,
    driver: 'police',
    ramTimer: 0,
    backoff: 0,
    skid: 0,
  };
  state.cars.push(cop);
  state.cops.push(cop);
  return cop;
}

function steerToward(car, tx, ty, dt, maxTurn) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff));
  car.angle += turn;
}

export function stepPolice(state, dt) {
  const player = state.player;
  const stars = wantedStars(state.heat);
  state.stars = stars;
  // Keep the right number of cruisers on the road for the wanted level.
  while (state.cops.length < stars) spawnCop(state);
  while (state.cops.length > stars) {
    const cop = state.cops.pop();
    const index = state.cars.indexOf(cop);
    if (index >= 0) state.cars.splice(index, 1);
  }
  let closeHold = false;
  for (const cop of state.cops) {
    if (cop.ramTimer > 0) cop.ramTimer -= dt;
    if (cop.backoff > 0) cop.backoff -= dt;
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    const onFootClose = !player.inCar && dist < 90;
    if (cop.backoff > 0) {
      // After a ram, the cruiser swings wide and comes around again.
      steerToward(cop, cop.x + Math.cos(cop.angle + 2.4) * 200, cop.y + Math.sin(cop.angle + 2.4) * 200, dt, 2.2);
      cop.speed = Math.max(200, cop.speed - 300 * dt);
    } else if (onFootClose) {
      // Pull up alongside a runner on foot and stop: the hold can only work
      // when the cruiser stays close instead of driving straight through.
      steerToward(cop, player.x, player.y, dt, 3.2);
      if (dist < COP.holdRadius) {
        cop.speed = 0;
        closeHold = true;
      } else {
        cop.speed = Math.max(0, cop.speed - 900 * dt);
      }
    } else {
      steerToward(cop, player.x, player.y, dt, 2.4);
      cop.speed = Math.min(COP.chaseSpeed, cop.speed + 420 * dt);
    }
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    resolveBuildings(state.city, cop, 24);
    cop.x = Math.max(24, Math.min(CITY.width - 24, cop.x));
    cop.y = Math.max(24, Math.min(CITY.height - 24, cop.y));
    // Ramming the player's car hurts and slows it; the cruiser then backs off.
    if (player.inCar && dist < 52 && cop.ramTimer <= 0) {
      cop.ramTimer = COP.ramCooldown;
      cop.backoff = 1.1;
      player.health = Math.max(0, player.health - COP.ramDamage);
      player.inCar.speed *= 0.45;
      state.events.push({ type: 'ram', x: player.x, y: player.y });
      if (player.health <= 0) state.busted = 'wrecked';
    }
  }
  // The hold is one timer for the whole step: any cruiser close enough on foot
  // holds Mara, and it only decays when no cruiser is close at all.
  if (!player.inCar && closeHold) {
    state.holdTime += dt;
    if (state.holdTime >= COP.holdTime) state.busted = 'caught';
  } else {
    state.holdTime = Math.max(0, state.holdTime - dt * 2);
  }
}

export function stepHeat(state, dt) {
  if (state.heat <= 0) return;
  state.heatTimer += dt;
  if (state.heatTimer >= HEAT.coolDelay) {
    state.heat = Math.max(0, state.heat - HEAT.coolRate * dt);
  }
}
