// The world: one state object and one fixed step that runs every system in
// order. Nothing here draws or reads input — it only advances the simulation.
import { SPOTS } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { createPeds, createTraffic, stepPeds, stepTraffic } from './traffic.js';
import { stepHeat, stepPolice } from './police.js';
import { createMissions, stepMissions } from './missions.js';
import { readBest } from './save.js';

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const cars = [...city.parkedCars];
  const traffic = createTraffic(random);
  for (const car of traffic) cars.push(car);
  const state = {
    seed,
    city,
    cars,
    cops: [],
    peds: createPeds(random),
    player: createPlayer(SPOTS.plaza),
    missions: createMissions(),
    heat: 0,
    heatTimer: 0,
    stars: 0,
    holdTime: 0,
    enterLatch: false,
    busted: null,
    won: false,
    best: readBest(),
    hasSave: false,
    particles: [],
    events: [],
    time: 0,
  };
  return state;
}

/** Reset the world to a fresh run with the same seed. */
export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

function spawnParticles(state, event) {
  const colors = { pickup: '#ffd166', paid: '#4ade80', drop: '#2ee6ff', ram: '#ff4d4d', steal: '#ff5da2', punch: '#ffffff', runover: '#ff4d4d', late: '#ff4d4d' };
  state.particles.push({ x: event.x, y: event.y, life: 0.6, maxLife: 0.6, color: colors[event.type] ?? '#ffffff' });
}

export function stepWorld(state, input, dt) {
  state.time += dt;
  state.events.length = 0;
  for (const p of state.particles) p.life -= dt;
  state.particles = state.particles.filter((p) => p.life > 0);
  stepPlayer(state, input, dt);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepMissions(state, dt);
  stepHeat(state, dt);
  stepPolice(state, dt);
  for (const event of state.events) spawnParticles(state, event);
  if (state.missions.flash > 0) state.missions.flash -= dt;
}
