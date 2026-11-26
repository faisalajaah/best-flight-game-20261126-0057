// Merapi Run — keyboard and mouse input. Held keys steer; one-shot presses
// (start, pause, view, mute, restart, mission choice) are queued as flags
// and taken once by the loop, so a press between frames is never lost.
// Mouse: moving the pointer steers pitch and roll; click starts / restarts.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_VIEW = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_MISSION_1 = 32;
export const ACTION_MISSION_2 = 64;
export const ACTION_MISSION_3 = 128;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const ROLL_LEFT = new Set(['ArrowLeft']);
const ROLL_RIGHT = new Set(['ArrowRight']);
const YAW_LEFT = new Set(['KeyA', 'KeyQ']);
const YAW_RIGHT = new Set(['KeyD', 'KeyE']);
const THROTTLE_UP = new Set(['ShiftLeft', 'ShiftRight']);
const THROTTLE_DOWN = new Set(['ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const VIEW = new Set(['KeyC', 'KeyV']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);
const MISSION_KEYS = new Map([['Digit1', ACTION_MISSION_1], ['Digit2', ACTION_MISSION_2], ['Digit3', ACTION_MISSION_3]]);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  // Mouse steering: pointer offset from centre, -1..1 on each axis.
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let mouseTimer = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (VIEW.has(event.code)) actions |= ACTION_VIEW;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    else if (MISSION_KEYS.has(event.code)) actions |= MISSION_KEYS.get(event.code);
    if (PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code) || ROLL_LEFT.has(event.code)
      || ROLL_RIGHT.has(event.code) || YAW_LEFT.has(event.code) || YAW_RIGHT.has(event.code)
      || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseActive = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    mouseActive = true;
    mouseTimer = 0;
  });
  canvas.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  function axis(neg, pos) {
    let value = 0;
    for (const code of neg) if (held.has(code)) value -= 1;
    for (const code of pos) if (held.has(code)) value += 1;
    return Math.max(-1, Math.min(1, value));
  }

  // Steering for this frame: keyboard first, mouse when it moved recently.
  function steer(dt) {
    mouseTimer += dt;
    if (mouseTimer > 2.5) mouseActive = false;
    let pitch = -axis(PITCH_UP, PITCH_DOWN);
    let roll = axis(ROLL_LEFT, ROLL_RIGHT);
    if (mouseActive && pitch === 0 && roll === 0) {
      pitch = -mouseY * 0.9;
      roll = mouseX * 0.9;
    }
    const yaw = axis(YAW_LEFT, YAW_RIGHT);
    let throttleDelta = 0;
    for (const code of THROTTLE_UP) if (held.has(code)) throttleDelta += 0.55;
    for (const code of THROTTLE_DOWN) if (held.has(code)) throttleDelta -= 0.55;
    return { pitch, roll, yaw, throttleDelta };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { steer, takeActions };
}
