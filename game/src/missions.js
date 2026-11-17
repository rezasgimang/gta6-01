// The Neon Tide courier jobs: three missions, each a pickup then one or two
// drops against a timer. Finish the third and Mara wins the crew's trust.
import { HEAT, MISSIONS, SPOTS } from './config.js';

export function createMissions() {
  return {
    index: 0,
    phase: 'pickup',
    drop: 0,
    timeLeft: 0,
    active: false,
    done: false,
    flash: 0,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] ?? null;
}

export function missionTarget(missions) {
  const mission = currentMission(missions);
  if (!mission || missions.done) return null;
  if (missions.phase === 'pickup') return SPOTS[mission.pickup];
  return SPOTS[mission.drops[missions.drop]];
}

export function missionLabel(missions) {
  const mission = currentMission(missions);
  if (!mission) return '';
  if (missions.done) return 'All jobs done — the crew trusts you.';
  if (missions.phase === 'pickup') return `Pick up: ${SPOTS[mission.pickup].name}`;
  return `Deliver: ${SPOTS[mission.drops[missions.drop]].name}`;
}

function atSpot(player, spot) {
  return Math.hypot(player.x - spot.x, player.y - spot.y) < 64;
}

export function stepMissions(state, dt) {
  const missions = state.missions;
  if (missions.done) return;
  const mission = currentMission(missions);
  if (!mission) return;
  const player = state.player;
  if (missions.phase === 'pickup') {
    if (atSpot(player, SPOTS[mission.pickup])) {
      missions.phase = 'deliver';
      missions.drop = 0;
      missions.timeLeft = mission.time;
      missions.active = true;
      missions.flash = 1;
      if (mission.pickupHeat) {
        state.heat = Math.min(HEAT.max, state.heat + mission.pickupHeat);
        state.heatTimer = 0;
      }
      state.events.push({ type: 'pickup', x: player.x, y: player.y, name: mission.name });
    }
    return;
  }
  missions.timeLeft -= dt;
  if (missions.timeLeft <= 0) {
    // Too slow: the job goes back to the pickup point, no penalty beyond time.
    missions.phase = 'pickup';
    missions.active = false;
    missions.flash = 1;
    state.events.push({ type: 'late', x: player.x, y: player.y });
    return;
  }
  const spot = SPOTS[mission.drops[missions.drop]];
  if (!atSpot(player, spot)) return;
  missions.drop += 1;
  missions.flash = 1;
  state.events.push({ type: 'drop', x: player.x, y: player.y });
  if (missions.drop < mission.drops.length) return;
  // Job complete: pay out and move on.
  player.cash += mission.reward;
  state.best = Math.max(state.best, player.cash);
  missions.index += 1;
  missions.phase = 'pickup';
  missions.active = false;
  missions.timeLeft = 0;
  if (missions.index >= MISSIONS.length) {
    missions.done = true;
    state.won = true;
  }
  state.events.push({ type: 'paid', x: player.x, y: player.y, amount: mission.reward });
}
