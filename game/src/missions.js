// Merapi Run — the missions: three sorties with different goals over the same
// island. Ring Run threads 8 gates in order against the clock; Island Landing
// asks for one gentle touchdown on the runway with limited fuel; Volcano
// Circuit is a timed lap around smoking Merapi. Rings are laid out from the
// mission and the seed, so every flight of a mission flies the same course.
import { LAP_POINTS, LANDING_POINTS, MISSIONS, RING_POINTS, WORLD } from './config.js';
import { createRandom } from './random.js';

export const EVENT_RING = 1;
export const EVENT_MISSION_DONE = 2;

function ringCourse(mission, seed) {
  const random = createRandom(seed + mission.id.length * 31);
  const rings = [];
  if (mission.id === 'rings') {
    // A tour of the island: out over the bay, past the town, up the volcano's
    // shoulder and home to the runway, each gate facing the next.
    const stops = [
      [620, 150, 180], [300, 170, -60], [-40, 210, -260], [-260, 320, -420],
      [-480, 280, -140], [-300, 200, 160], [80, 170, 330], [620, 140, 300],
    ];
    for (let i = 0; i < stops.length; i += 1) {
      const next = stops[(i + 1) % stops.length];
      const [x, y, z] = stops[i];
      rings.push({ x, y, z, heading: Math.atan2(next[0] - x, -(next[2] - z)) });
    }
  } else if (mission.id === 'circuit') {
    // A ring around the volcano at increasing heights, closing the lap.
    const cx = WORLD.volcano.x;
    const cz = WORLD.volcano.z;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const r = 560 + random.range(-30, 30);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const y = 210 + (i % 3) * 45;
      const nextA = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      rings.push({ x, y, z, heading: Math.atan2(Math.cos(nextA) - Math.cos(a), -(Math.sin(nextA) - Math.sin(a))) });
    }
  }
  return rings;
}

export function createMission(missionId, seed) {
  const def = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  const rings = ringCourse(def, seed);
  const state = {
    def,
    rings,
    nextRing: 0,
    score: 0,
    elapsed: 0,
    done: false,
    outcome: '',
    detail: '',
    bestLap: null,
  };

  function start() {
    state.nextRing = 0;
    state.score = 0;
    state.elapsed = 0;
    state.done = false;
    state.outcome = '';
    state.detail = '';
  }

  function nextRingTarget() {
    return state.nextRing < rings.length ? rings[state.nextRing] : null;
  }

  function distanceToNextRing(flight) {
    const target = nextRingTarget();
    if (!target) return null;
    return Math.hypot(target.x - flight.x, target.y - flight.y, target.z - flight.z);
  }

  // One step of mission logic. Returns EVENT_RING when a gate is flown
  // through, EVENT_MISSION_DONE when the sortie's goal is met.
  function step(dt, flight, flightEvents, flightModule) {
    let events = 0;
    if (state.done) return events;
    state.elapsed += dt;

    const target = nextRingTarget();
    if (target) {
      const d = Math.hypot(target.x - flight.x, target.y - flight.y, target.z - flight.z);
      if (d < 17) {
        state.nextRing += 1;
        state.score += RING_POINTS;
        events |= EVENT_RING;
        if (state.nextRing >= rings.length) {
          state.done = true;
          if (def.id === 'circuit') {
            state.score += LAP_POINTS;
            state.outcome = 'Lap complete';
            state.detail = `Volcano circuit in ${state.elapsed.toFixed(1)} s — ${state.score} points.`;
          } else {
            state.outcome = 'All rings flown';
            state.detail = `Ring Run cleared in ${state.elapsed.toFixed(1)} s — ${state.score} points.`;
          }
          events |= EVENT_MISSION_DONE;
        }
      }
    }

    if (flightEvents & flightModule.EVENT_LANDED) {
      if (def.id === 'landing') {
        state.done = true;
        state.score += LANDING_POINTS;
        state.outcome = 'Landed safely';
        state.detail = `Gentle touchdown on the runway in ${state.elapsed.toFixed(1)} s — ${state.score} points.`;
        events |= EVENT_MISSION_DONE;
      } else if (def.id === 'rings' && state.nextRing >= rings.length) {
        // Already finished by the rings; the landing is a bonus flourish.
        state.detail += ' Landed on the runway too.';
      }
    }
    if (flightEvents & flightModule.EVENT_CRASH) {
      state.done = true;
      state.outcome = 'Crashed';
      state.detail = `The island claimed another plane after ${state.elapsed.toFixed(1)} s. Score ${state.score}.`;
    }
    if (flightEvents & flightModule.EVENT_FUEL_EMPTY && def.id === 'landing' && !state.done) {
      state.detail = 'Fuel empty — glide her home.';
    }
    return events;
  }

  function objectiveLine(flight) {
    if (state.done) return state.outcome;
    if (def.id === 'landing') return 'Land gently on the runway — fuel is limited';
    const target = nextRingTarget();
    if (!target) return 'Course complete — land on the runway';
    const d = distanceToNextRing(flight);
    return `Ring ${state.nextRing + 1} of ${rings.length} — ${Math.round(d)} m ahead`;
  }

  return { state, start, step, nextRingTarget, distanceToNextRing, objectiveLine };
}
