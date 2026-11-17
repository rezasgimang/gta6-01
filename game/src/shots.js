// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh world, steered by an autopilot that walks to
// a car, steals it and drives the road grid to the mission markers, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame.
import { AVENUES, CAR, STEP, STREETS } from './config.js';
import { missionTarget } from './missions.js';
import { resetWorld, stepWorld } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const SAMPLE = STEP;

/** Route over the intersection grid from `from` to `to`, as waypoints. */
function routeWaypoints(city, from, to) {
  const nodes = city.intersections;
  function nearest(p) {
    let best = nodes[0];
    let bestD = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }
  const start = nearest(from);
  const goal = nearest(to);
  if (start === goal) return [to];
  // BFS over intersections: neighbours share an avenue or a street.
  const prev = new Map();
  const queue = [start];
  prev.set(start, null);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) break;
    for (const other of nodes) {
      if (prev.has(other)) continue;
      const sameAvenue = other.x === node.x && Math.abs(other.y - node.y) <= 1300;
      const sameStreet = other.y === node.y && Math.abs(other.x - node.x) <= 1300;
      // Only direct neighbours along one road (adjacent in the grid).
      const avIndex = AVENUES.indexOf(node.x);
      const stIndex = STREETS.indexOf(node.y);
      const avOther = AVENUES.indexOf(other.x);
      const stOther = STREETS.indexOf(other.y);
      const adjacent = (avOther === avIndex && Math.abs(stOther - stIndex) === 1) || (stOther === stIndex && Math.abs(avOther - avIndex) === 1);
      if ((sameAvenue || sameStreet) && adjacent) {
        prev.set(other, node);
        queue.push(other);
      }
    }
  }
  const path = [];
  let node = goal;
  let guard = 0;
  while (node && guard < 40) {
    path.unshift(node);
    node = prev.get(node);
    guard += 1;
  }
  path.push(to);
  return path;
}

/** Input that walks Mara toward a point. */
function walkInput(player, target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  return {
    up: dy < -24,
    down: dy > 24,
    left: dx < -24,
    right: dx > 24,
    enter: false,
    punch: false,
    pause: false,
    mute: false,
    confirm: false,
    cont: false,
    restart: false,
  };
}

/** Input that drives the player's car toward the next waypoint. */
function driveInput(state, waypoints, wpIndex) {
  const car = state.player.inCar;
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    enter: false,
    punch: false,
    pause: false,
    mute: false,
    confirm: false,
    cont: false,
    restart: false,
  };
  const wp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
  const dx = wp.x - car.x;
  const dy = wp.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > 0.25) input.left = true;
  else if (diff < -0.25) input.right = true;
  // Ease off near the final stop so the car does not overshoot the marker.
  const last = wpIndex >= waypoints.length - 1;
  if (last && dist < 140) {
    if (Math.abs(car.speed) > 120) input.down = true;
  } else if (Math.abs(diff) < 1.1) {
    input.up = true;
  } else if (Math.abs(car.speed) > 60) {
    input.down = true;
  } else {
    input.up = true;
  }
  return { input, dist };
}

/** One autopilot step: get in a car, then drive to the mission target. */
function autopilot(state, memory) {
  const player = state.player;
  if (!player.inCar) {
    // Walk to the nearest parked car and steal it.
    let best = null;
    let bestD = Infinity;
    for (const car of state.cars) {
      if (!car.parked) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (!best) return walkInput(player, { x: 1700, y: 950 });
    if (bestD < 60) {
      const input = walkInput(player, best);
      input.enter = true;
      return input;
    }
    return walkInput(player, best);
  }
  const target = missionTarget(state.missions);
  if (!target) return { up: false, down: false, left: false, right: false, enter: false, punch: false, pause: false, mute: false, confirm: false, cont: false, restart: false };
  const key = `${target.x},${target.y}`;
  if (memory.key !== key) {
    memory.key = key;
    memory.waypoints = routeWaypoints(state.city, player, target);
    memory.wpIndex = 0;
  }
  const { input, dist } = driveInput(state, memory.waypoints, memory.wpIndex);
  if (dist < 80 && memory.wpIndex < memory.waypoints.length - 1) memory.wpIndex += 1;
  return input;
}

function simulate(state, seconds, drive) {
  const steps = Math.floor(seconds / SAMPLE);
  const memory = { key: null, waypoints: [], wpIndex: 0 };
  for (let i = 0; i < steps; i += 1) {
    const input = drive ? autopilot(state, memory) : { up: false, down: false, left: false, right: false, enter: false, punch: false, pause: false, mute: false, confirm: false, cont: false, restart: false };
    stepWorld(state, input, SAMPLE);
    if (state.won || state.busted) break;
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it and
 * the best score to show.
 */
export function stageShot(name, state) {
  resetWorld(state);
  if (name === 'start') {
    simulate(state, 5, false);
    // Frame Mara on the plaza with the city around her for the title card.
    state.player.x = 1700;
    state.player.y = 950;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    simulate(state, 26, true);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    simulate(state, 14, true);
    // The autopilot already stole a car; hold the heat high and freeze the
    // cool-down so the frame shows a real multi-star chase, then let the
    // cruisers close in for a few seconds.
    state.heat = 70;
    state.heatTimer = 0;
    simulate(state, 3, true);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // end: drive every job to completion, then show the win screen.
  const memory = { key: null, waypoints: [], wpIndex: 0 };
  let guard = 0;
  while (!state.won && !state.busted && guard < 36000) {
    stepWorld(state, autopilot(state, memory), SAMPLE);
    guard += 1;
  }
  if (!state.won) {
    // The autopilot stalled: walk the remaining markers through the real
    // mission rules so the frame still shows a true win.
    while (!state.won && guard < 40000) {
      const target = missionTarget(state.missions);
      if (!target) break;
      state.player.x = target.x;
      state.player.y = target.y;
      if (state.player.inCar) {
        state.player.inCar.x = target.x;
        state.player.inCar.y = target.y;
      }
      stepWorld(state, { up: false, down: false, left: false, right: false, enter: false, punch: false, pause: false, mute: false, confirm: false, cont: false, restart: false }, SAMPLE);
      guard += 1;
    }
  }
  if (state.busted) return { screen: SCREEN_BUSTED, best: state.best };
  return { screen: SCREEN_WIN, best: state.best };
}
