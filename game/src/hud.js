// Merapi Run — the HUD: altitude, speed and heading always on screen, plus
// throttle, fuel, score, mission objective, timer and warnings. Plain DOM
// text over the 3D view, rebuilt only when a value changes.
export function createHud(elements) {
  const cache = new Map();
  function set(id, text) {
    if (cache.get(id) !== text) {
      cache.set(id, text);
      const el = elements[id];
      if (el) el.textContent = text;
    }
  }
  function setBar(id, fraction) {
    const key = `${id}:${Math.round(fraction * 100)}`;
    if (cache.get(id) === key) return;
    cache.set(id, key);
    const el = elements[id];
    if (el) el.style.width = `${Math.max(0, Math.min(100, fraction * 100))}%`;
  }
  function setWarn(id, on) {
    const key = `${id}:warn:${on}`;
    if (cache.get(id) === key) return;
    cache.set(id, key);
    const el = elements[id];
    if (el) el.classList.toggle('warn', on);
  }

  function compassLetter(headingDeg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(headingDeg / 45) % 8];
  }

  // Paint the HUD for one frame of flight state and mission state.
  function draw(flight, mission, view, muted) {
    const headingDeg = ((flight.heading * 180) / Math.PI % 360 + 360) % 360;
    set('alt', `${Math.round(flight.altitude)} m`);
    set('speed', `${Math.round(flight.speed * 3.6)} km/h`);
    set('heading', `${String(Math.round(headingDeg)).padStart(3, '0')}° ${compassLetter(headingDeg)}`);
    set('throttleText', `${Math.round(flight.throttle * 100)}%`);
    setBar('throttleBar', flight.throttle);
    set('fuelText', `${Math.round(flight.fuel)}%`);
    setBar('fuelBar', flight.fuel / 100);
    setWarn('fuelText', flight.fuel < 20);
    set('score', String(mission.state.score));
    set('missionName', mission.state.def.name);
    set('objective', mission.objectiveLine(flight));
    set('timer', `${mission.state.elapsed.toFixed(1)} s`);
    set('view', view === 'cockpit' ? 'COCKPIT' : 'CHASE');
    set('mute', muted ? 'MUTED' : 'SOUND ON');
    const stall = flight.stalled && !flight.landed && !flight.crashed;
    setWarn('stallWarn', stall);
    if (elements.stallWarn) elements.stallWarn.style.display = stall ? 'block' : 'none';
    const next = mission.nextRingTarget();
    if (next) {
      const d = mission.distanceToNextRing(flight);
      set('ringDist', `NEXT RING ${Math.round(d)} m`);
    } else {
      set('ringDist', mission.state.def.id === 'landing' ? 'LAND ON THE RUNWAY' : 'COURSE COMPLETE');
    }
  }

  function showMessage(text) {
    set('message', text);
    if (elements.message) elements.message.style.opacity = text ? '1' : '0';
  }

  return { draw, showMessage };
}
