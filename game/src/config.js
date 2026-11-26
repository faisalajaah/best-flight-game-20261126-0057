// Merapi Run — configuration: every tunable number for the island, the plane
// and the three missions lives here, so balancing never touches game logic.
export const WORLD = {
  seed: 1337,
  islandRadius: 1400,
  seaLevel: 0,
  volcano: { x: -260, z: -420, height: 340, radius: 420 },
  town: { x: 420, z: 380 },
  // The runway sits on the flat coastal shelf east of town, pointing north.
  runway: { x: 620, z: 120, heading: 0, length: 420, width: 26 },
  maxAltitude: 900,
};

export const PLANE = {
  maxSpeed: 95, // m/s at full throttle
  cruiseSpeed: 55,
  minFlySpeed: 26, // below this the wing stalls and the nose drops
  climbRate: 16, // m/s at full throttle, level pitch
  rollRate: 1.9, // rad/s at full stick
  pitchRate: 1.1,
  yawRate: 0.55,
  fuelCapacity: 100,
  fuelBurn: 1.6, // units per second at full throttle
  startFuel: 100,
  // A touchdown counts as a landing when the sink rate and speed are under these.
  softSink: 6,
  softSpeed: 42,
};

export const MISSIONS = [
  {
    id: 'rings',
    key: '1',
    name: 'Ring Run',
    blurb: 'Fly through 8 glowing rings in order, against the clock.',
    rings: 8,
    fuel: 100,
    start: { x: 620, z: 560, y: 135, heading: 0, speed: 55 },
  },
  {
    id: 'landing',
    key: '2',
    name: 'Island Landing',
    blurb: 'Take off from the east strip, circle the bay and land gently on the runway. Fuel is limited.',
    rings: 0,
    fuel: 55,
    start: { x: 620, z: 560, y: 135, heading: 0, speed: 55 },
  },
  {
    id: 'circuit',
    key: '3',
    name: 'Volcano Circuit',
    blurb: 'One fast lap around smoking Merapi through 6 rings. Best lap wins.',
    rings: 6,
    fuel: 100,
    start: { x: 620, z: 560, y: 165, heading: 0, speed: 60 },
  },
];

export const RING_POINTS = 250;
export const LANDING_POINTS = 1000;
export const LAP_POINTS = 500;

export const BEST_KEY = 'merapi-run-best';
export const SHOT_SEED = 7;
