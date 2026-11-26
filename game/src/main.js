// Merapi Run — boot and the one loop: input is read every frame, the flight
// model and the missions advance in fixed 1/60 s steps, and the renderer,
// the instruments and the HUD paint what is there. The game moves between
// title, play, paused and end screens.
//
// ?shot=cockpit|chase|landing|title (with &seed=N) stages that scene for a
// screenshot instead of running the loop, and sets window.__shotReady.
import { MISSIONS, SHOT_SEED, WORLD } from './config.js';
import { createFlight, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_LANDED } from './flight.js';
import { EVENT_MISSION_DONE, EVENT_RING, createMission } from './missions.js';
import { createAudio } from './audio.js';
import {
  ACTION_CONFIRM, ACTION_MISSION_1, ACTION_MISSION_2, ACTION_MISSION_3,
  ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_VIEW, createInput,
} from './input.js';
import { createHud } from './hud.js';
import { createInstruments } from './instruments.js';
import { VIEW_CHASE, VIEW_COCKPIT, createRenderer } from './render.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD.seed;

const canvas = document.getElementById('game');
const panelCanvas = document.getElementById('panel');
const status = document.getElementById('status');
const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const pausedScreen = document.getElementById('paused-screen');

function el(id) {
  return document.getElementById(id);
}
const hudElements = {
  alt: el('hud-alt'), speed: el('hud-speed'), heading: el('hud-heading'),
  throttleText: el('hud-throttle-text'), throttleBar: el('hud-throttle-bar'),
  fuelText: el('hud-fuel-text'), fuelBar: el('hud-fuel-bar'),
  score: el('hud-score'), missionName: el('hud-mission'), objective: el('hud-objective'),
  timer: el('hud-timer'), view: el('hud-view'), mute: el('hud-mute'),
  stallWarn: el('stall-warn'), ringDist: el('hud-ring'), message: el('hud-message'),
};

const renderer = createRenderer(canvas, seed);
const terrain = renderer.terrain;
const audio = createAudio();
const hud = createHud(hudElements);
const instruments = createInstruments(panelCanvas);
const input = createInput(canvas);

let mission = createMission('rings', seed);
let flight = createFlight(terrain.heightAt, mission.state.def.start, mission.state.def.fuel);
terrain.buildRings(mission.state.rings);
terrain.paintRings(0);

let screen = 'title';
let view = VIEW_COCKPIT;
let muted = false;
let best = readBest();
let titleAngle = 0;
let messageTimer = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem('merapi-run-best') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem('merapi-run-best', String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}
function announce(message) {
  status.textContent = message;
}
function flash(message, seconds = 3) {
  hud.showMessage(message);
  messageTimer = seconds;
}

function raiseRings() {
  // A ring must clear the ground it hangs over: lift any gate that the
  // island's hills would swallow to 30 m above the terrain.
  for (const ring of mission.state.rings) {
    ring.y = Math.max(ring.y, terrain.heightAt(ring.x, ring.z) + 30);
  }
}

function startMission(missionId) {
  mission = createMission(missionId, seed);
  raiseRings();
  flight = createFlight(terrain.heightAt, mission.state.def.start, mission.state.def.fuel);
  terrain.buildRings(mission.state.rings);
  terrain.paintRings(0);
  screen = 'play';
  view = VIEW_COCKPIT;
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  pausedScreen.classList.add('hidden');
  audio.unlock();
  announce(`${mission.state.def.name}. ${mission.state.def.blurb}`);
  flash(mission.objectiveLine(flight.state), 4);
}

function endSortie(title, detail) {
  screen = 'over';
  if (mission.state.score > best) {
    best = mission.state.score;
    saveBest(best);
  }
  el('end-title').textContent = title;
  el('end-detail').textContent = detail;
  el('end-score').textContent = `Score ${mission.state.score} — Best ${best}`;
  endScreen.classList.remove('hidden');
  announce(`${title}. ${detail}`);
}

function showTitle() {
  screen = 'title';
  view = VIEW_CHASE;
  titleScreen.classList.remove('hidden');
  endScreen.classList.add('hidden');
  pausedScreen.classList.add('hidden');
  el('best-line').textContent = best > 0 ? `Best score: ${best}` : 'No flights logged yet — make the first one count.';
  announce('Merapi Run. Choose a mission and press Space to fly.');
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    muted = audio.toggleMute();
  }
  if (actions & ACTION_VIEW && screen === 'play') {
    view = view === VIEW_COCKPIT ? VIEW_CHASE : VIEW_COCKPIT;
  }
  if (actions & ACTION_RESTART && (screen === 'over' || screen === 'play')) {
    startMission(mission.state.def.id);
    return;
  }
  if (screen === 'title') {
    if (actions & ACTION_MISSION_1) startMission('rings');
    else if (actions & ACTION_MISSION_2) startMission('landing');
    else if (actions & ACTION_MISSION_3) startMission('circuit');
    else if (actions & ACTION_CONFIRM) startMission('rings');
  } else if (screen === 'play') {
    if (actions & ACTION_PAUSE) {
      screen = 'paused';
      pausedScreen.classList.remove('hidden');
      announce('Paused.');
    }
  } else if (screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = 'play';
      pausedScreen.classList.add('hidden');
      announce('Flying.');
    }
  } else if (screen === 'over') {
    if (actions & ACTION_CONFIRM) showTitle();
  }
}

function stepGame(dt) {
  if (screen === 'title') {
    // Attract mode: the hopper sits on the runway, nose turning slowly.
    titleAngle += dt * 0.12;
    flight.state.heading = titleAngle;
    flight.state.y = terrain.heightAt(WORLD.runway.x, WORLD.runway.z) + 1.2;
    flight.state.altitude = 1;
    flight.state.x = WORLD.runway.x;
    flight.state.z = WORLD.runway.z;
    flight.state.speed = 0;
    flight.state.throttle = 0;
    return;
  }
  if (screen !== 'play') return;
  const steer = input.steer(dt);
  const flightEvents = flight.step(dt, steer);
  const missionEvents = mission.step(dt, flight.state, flightEvents, { EVENT_LANDED, EVENT_CRASH, EVENT_FUEL_EMPTY });
  terrain.paintRings(mission.state.nextRing);
  if (missionEvents & EVENT_RING) {
    audio.ringChime();
    const left = mission.state.rings.length - mission.state.nextRing;
    flash(left > 0 ? `Ring ${mission.state.nextRing} of ${mission.state.rings.length} — ${left} to go` : 'Last ring!', 2.5);
  }
  if (flightEvents & EVENT_FUEL_EMPTY) flash('FUEL EMPTY — glide her home', 4);
  if (flightEvents & EVENT_CRASH) {
    audio.crashBang();
    endSortie('Crashed', mission.state.detail || 'The island claimed another plane.');
  } else if (flightEvents & EVENT_LANDED) {
    audio.touchdownThud();
    if (mission.state.done) {
      endSortie(mission.state.outcome, mission.state.detail);
    } else {
      mission.state.score += 200;
      endSortie('Landed on the runway', `Wheels down safely with ${mission.state.score} points banked.`);
    }
  } else if (missionEvents & EVENT_MISSION_DONE) {
    if (mission.state.def.id !== 'landing') {
      flash(`${mission.state.outcome} — land on the runway to finish`, 5);
    }
  }
  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) hud.showMessage('');
  }
  audio.setFlight(flight.state.throttle, flight.state.speed, !flight.state.landed);
}

// --- Screenshot staging: place the plane and camera for a real render. ---
function stageShot(name) {
  const s = SHOT_SEED;
  if (name === 'title') {
    showTitle();
    // Park the hopper on the runway for the title backdrop.
    flight.state.x = WORLD.runway.x;
    flight.state.z = WORLD.runway.z;
    flight.state.y = terrain.heightAt(WORLD.runway.x, WORLD.runway.z) + 1.2;
    flight.state.altitude = 1;
    flight.state.heading = 0.5;
    flight.state.speed = 0;
    flight.state.throttle = 0;
    renderer.snapChase(flight.state);
    return 'title';
  }
  if (name === 'chase') {
    startMission('rings');
    view = VIEW_CHASE;
    flight.state.x = 620;
    flight.state.y = 150;
    flight.state.z = 480;
    flight.state.heading = 0;
    flight.state.speed = 62;
    flight.state.throttle = 0.7;
    flight.state.pitch = 0.02;
    renderer.snapChase(flight.state);
    return 'play';
  }
  if (name === 'landing') {
    startMission('landing');
    view = VIEW_COCKPIT;
    flight.state.x = WORLD.runway.x;
    flight.state.y = 42;
    flight.state.z = WORLD.runway.z + 260;
    flight.state.heading = 0;
    flight.state.speed = 36;
    flight.state.throttle = 0.32;
    flight.state.pitch = -0.03;
    return 'play';
  }
  // Default: cockpit, airborne over the bay with the first ring ahead.
  startMission('rings');
  view = VIEW_COCKPIT;
  flight.state.x = 620;
  flight.state.y = 140;
  flight.state.z = 520;
  flight.state.heading = 0;
  flight.state.speed = 58;
  flight.state.throttle = 0.68;
  return 'play';
}

function runShot(name) {
  const staged = stageShot(name);
  screen = staged;
  let painted = 0;
  let simTime = 0;
  function paint() {
    // Let the world breathe for a second of sim before the shutter.
    for (let i = 0; i < 20; i += 1) {
      if (screen === 'play') {
        const ev = flight.step(STEP, { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0 });
        mission.step(STEP, flight.state, ev, { EVENT_LANDED, EVENT_CRASH, EVENT_FUEL_EMPTY });
      }
      simTime += STEP;
    }
    terrain.paintRings(mission.state.nextRing);
    renderer.draw(flight.state, view, STEP, simTime);
    instruments.draw(flight.state);
    hud.draw(flight.state, mission, view, muted);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  showTitle();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
      stepGame(STEP);
      accumulator -= STEP;
      time += STEP;
    }
    if (screen === 'paused' || screen === 'over') accumulator = 0;
    renderer.draw(flight.state, view, STEP, time);
    instruments.draw(flight.state);
    hud.draw(flight.state, mission, view, muted);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      pausedScreen.classList.remove('hidden');
      announce('Paused.');
    }
  });
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
