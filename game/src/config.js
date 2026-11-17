// Every tuning number, colour and place name for SOLMARA in one place.
// The city is a fixed 3600x2600 world; the camera follows the player, so no
// rule below depends on the window size.
export const STEP = 1 / 60;

export const CITY = { width: 3600, height: 2600 };

// Sea hugs the west edge and the south edge; a sand strip sits between sea and city.
export const SEA = { west: 260, south: 2420, beach: 90 };

// Avenues run north-south, streets east-west. Cars and traffic use these.
export const AVENUES = [500, 1100, 1700, 2300, 2900, 3350];
export const STREETS = [400, 950, 1500, 2050, 2320];
export const ROAD_W = 130;

export const PLAYER = {
  radius: 14,
  walkSpeed: 250,
  health: 100,
  punchRange: 46,
  punchCooldown: 0.45,
  punchCash: 5,
};

export const CAR = {
  length: 48,
  width: 24,
  radius: 24,
  maxSpeed: 540,
  accel: 420,
  brake: 700,
  reverseMax: 180,
  turnRate: 2.6,
  drag: 0.55,
};

// Wanted: heat 0..100, one star per 20 heat. Crimes add heat; it cools after
// four clean seconds.
export const HEAT = {
  steal: 26,
  punch: 10,
  runOver: 16,
  missionPickup: 34,
  coolDelay: 4,
  coolRate: 6,
  max: 100,
};

export const COP = {
  maxActive: 5,
  chaseSpeed: 560,
  ramDamage: 5,
  ramCooldown: 1.6,
  holdRadius: 48,
  holdTime: 1.2,
  spawnDistance: 700,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 24;
export const PARKED_COUNT = 10;

// Named places on the map. Missions run between them.
export const SPOTS = {
  diner: { name: 'Harbor Diner', x: 1100, y: 2050 },
  plaza: { name: 'Solmara Plaza', x: 1700, y: 950 },
  marina: { name: 'Marina', x: 2900, y: 2320 },
  villa: { name: 'Villa Sol', x: 2300, y: 400 },
  docks: { name: 'Docks', x: 500, y: 1500 },
};

export const MISSIONS = [
  {
    name: 'Diner Dash',
    pickup: 'diner',
    drops: ['plaza'],
    reward: 150,
    time: 100,
    blurb: 'Pick up the Neon Tide order at the Harbor Diner, run it to Solmara Plaza.',
  },
  {
    name: 'Marina Run',
    pickup: 'marina',
    drops: ['villa'],
    reward: 300,
    time: 130,
    pickupHeat: 34,
    blurb: 'Hot cargo at the Marina. The crew says the cops are already watching — take it to Villa Sol.',
  },
  {
    name: 'Dock Double',
    pickup: 'docks',
    drops: ['plaza', 'diner'],
    reward: 500,
    time: 170,
    blurb: 'Two drops, one run: Docks to the Plaza, then back to the Diner. Finish this and you are in.',
  },
];

export const PALETTE = {
  sea: '#0e4a5e',
  seaDeep: '#0a3547',
  sand: '#c9a86a',
  grass: '#1d2b1e',
  road: '#23232e',
  roadEdge: '#3a3a4a',
  lane: '#d8c95a',
  sidewalk: '#2f2f3d',
  building: '#2c2440',
  buildingTop: '#3a2f55',
  windowLit: '#ffd166',
  windowNeon: '#2ee6ff',
  windowPink: '#ff5da2',
  player: '#2ee6ff',
  playerCar: '#2ee6ff',
  traffic: ['#e8e8e8', '#ffb703', '#8ecae6', '#ff5da2', '#90be6d'],
  cop: '#1d4ed8',
  copLight: '#ff2e2e',
  ped: ['#f4a261', '#e76f51', '#a7c957', '#e9c46a', '#9b5de5'],
  marker: '#ffd166',
  text: '#eef1f5',
  muted: '#9aa3b2',
  danger: '#ff4d4d',
  panel: 'rgba(12, 12, 22, 0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmara.save.v1';
export const BEST_KEY = 'solmara.best.v1';
