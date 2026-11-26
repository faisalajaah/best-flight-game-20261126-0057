// Merapi Run — the flight model: throttle, pitch, roll and yaw into speed,
// attitude and position, with a stall below flying speed, fuel burn and the
// ground. No rendering here: step() takes the pilot's inputs and returns
// what happened, so the game loop can react without knowing aerodynamics.
import { PLANE, WORLD } from './config.js';

export const EVENT_CRASH = 1;
export const EVENT_LANDED = 2;
export const EVENT_FUEL_EMPTY = 4;
export const EVENT_STALL = 8;

const RW = WORLD.runway;

function onRunway(x, z) {
  return Math.abs(x - RW.x) < RW.width / 2 + 2 && Math.abs(z - RW.z) < RW.length / 2;
}

export function createFlight(heightAt, start, fuel) {
  const state = {
    x: start.x,
    y: start.y,
    z: start.z,
    heading: start.heading,
    pitch: 0,
    roll: 0,
    speed: start.speed,
    throttle: 0.62,
    fuel,
    damage: 0,
    altitude: start.y,
    verticalSpeed: 0,
    stalled: false,
    landed: false,
    crashed: false,
    airtime: 0,
  };

  // One fixed step. input: { pitch: -1..1 (up positive), roll: -1..1 (right
  // positive), yaw: -1..1, throttleDelta } — already smoothed by the caller.
  function step(dt, input) {
    let events = 0;
    if (state.landed || state.crashed) return events;

    state.throttle = Math.min(1, Math.max(0, state.throttle + input.throttleDelta * dt));
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 0.3);

    // Attitude eases toward the stick, then the nose follows the bank.
    const targetPitch = input.pitch * 0.42;
    const targetRoll = input.roll * 0.85;
    state.pitch += (targetPitch - state.pitch) * Math.min(1, dt * PLANE.pitchRate * 2.2);
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * PLANE.rollRate * 2.2);
    state.heading += (-Math.sin(state.roll) * 0.9 + input.yaw * PLANE.yawRate) * dt;
    // A hard bank without speed bleeds lift: the turn tightens, the nose drops.
    const bankFactor = Math.cos(state.roll);

    state.stalled = state.speed < PLANE.minFlySpeed;
    const climb = state.speed * Math.sin(state.pitch) * bankFactor
      + (state.throttle - 0.45) * PLANE.climbRate * 0.35;
    // A stalled wing sinks, but the sink is capped: a slow approach stays
    // recoverable instead of turning into an unrecoverable plunge.
    const sink = state.stalled ? Math.min((PLANE.minFlySpeed - state.speed) * 0.6, 5) : 0;
    state.verticalSpeed = climb - sink;
    state.y += state.verticalSpeed * dt;
    const forwardX = Math.sin(state.heading);
    const forwardZ = -Math.cos(state.heading);
    state.x += forwardX * state.speed * Math.cos(state.pitch) * dt;
    state.z += forwardZ * state.speed * Math.cos(state.pitch) * dt;
    state.x = Math.max(-2600, Math.min(2600, state.x));
    state.z = Math.max(-2600, Math.min(2600, state.z));
    state.y = Math.min(WORLD.maxAltitude, state.y);
    state.airtime += dt;

    // Fuel burns with throttle; empty tanks mean a glide, not a pause.
    if (state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * (0.25 + state.throttle) * dt);
      if (state.fuel === 0) {
        state.throttle = 0;
        events |= EVENT_FUEL_EMPTY;
      }
    }
    if (state.stalled) events |= EVENT_STALL;

    // The ground: the island's height at this spot, from the same function
    // that built the mesh, so the collision matches the picture.
    const ground = heightAt(state.x, state.z);
    state.altitude = state.y - ground;
    if (state.y <= ground + 1.2) {
      state.y = ground + 1.2;
      const sinkRate = -state.verticalSpeed;
      const gentle = sinkRate <= PLANE.softSink && state.speed <= PLANE.softSpeed;
      if (onRunway(state.x, state.z) && gentle && state.speed > 8) {
        state.landed = true;
        state.speed = Math.max(0, state.speed - 30 * dt);
        events |= EVENT_LANDED;
      } else if (state.speed < 6 && sinkRate < 2) {
        // A slow roll-out on flat ground after a landing counts as landed.
        state.landed = true;
        events |= EVENT_LANDED;
      } else {
        state.crashed = true;
        state.damage = 100;
        events |= EVENT_CRASH;
      }
    }
    return events;
  }

  function reset(nextStart, nextFuel) {
    state.x = nextStart.x;
    state.y = nextStart.y;
    state.z = nextStart.z;
    state.heading = nextStart.heading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = nextStart.speed;
    state.throttle = 0.62;
    state.fuel = nextFuel;
    state.damage = 0;
    state.verticalSpeed = 0;
    state.stalled = false;
    state.landed = false;
    state.crashed = false;
    state.airtime = 0;
    state.altitude = nextStart.y;
  }

  return { state, step, reset };
}
