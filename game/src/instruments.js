// Merapi Run — the lit instrument panel: six canvas-drawn gauges that reflect
// real flight state every frame (artificial horizon, altimeter, airspeed,
// compass, fuel and vertical speed), glowing amber on a dark panel so the
// cockpit reads as flown, not drawn.
export function createInstruments(canvas) {
  const ctx = canvas.getContext('2d');
  const AMBER = '#ffb347';
  const GREEN = '#7dff9a';
  const RED = '#ff5a4e';
  const PANEL = '#14181d';
  const FACE = '#0d1116';

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function gaugeFace(cx, cy, r, label) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = FACE;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = AMBER;
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r - 7);
  }

  function needle(cx, cy, r, angle, color, width) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * (r - 8), cy - Math.cos(angle) * (r - 8));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function ticks(cx, cy, r, count, majorEvery) {
    ctx.fillStyle = AMBER;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const major = i % majorEvery === 0;
      const r1 = r - (major ? 9 : 5);
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
      ctx.lineTo(cx + Math.sin(a) * (r - 2), cy - Math.cos(a) * (r - 2));
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = major ? 2 : 1;
      ctx.stroke();
    }
  }

  // Artificial horizon: a clipped disc, sky above the horizon line, earth
  // below, rotated by bank and shifted by pitch — the pilot's main attitude cue.
  function drawHorizon(cx, cy, r, pitch, roll) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const shift = pitch * r * 0.9;
    ctx.fillStyle = '#3f7fb8';
    ctx.fillRect(-r, -r + shift, r * 2, r);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-r, shift, r * 2, r);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r, shift - 1, r * 2, 2);
    ctx.fillStyle = AMBER;
    ctx.fillRect(-r * 0.55, shift - 2, r * 0.3, 4);
    ctx.fillRect(r * 0.25, shift - 2, r * 0.3, 4);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = AMBER;
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATT', cx, cy + r - 7);
  }

  // Compass: a rotating rose with cardinal letters and the heading bug.
  function drawCompass(cx, cy, r, headingDeg) {
    gaugeFace(cx, cy, r, 'HDG');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-headingDeg * Math.PI / 180);
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const marks = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
    for (const [letter, deg] of marks) {
      const a = deg * Math.PI / 180;
      ctx.fillText(letter, Math.sin(a) * (r - 16), -Math.cos(a) * (r - 16) + 4);
    }
    for (let d = 0; d < 360; d += 30) {
      const a = d * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (r - 6), -Math.cos(a) * (r - 6));
      ctx.lineTo(Math.sin(a) * (r - 2), -Math.cos(a) * (r - 2));
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - r + 2);
    ctx.lineTo(cx + 6, cy - r + 2);
    ctx.lineTo(cx, cy - r + 12);
    ctx.fill();
  }

  function drawAltimeter(cx, cy, r, altitude) {
    gaugeFace(cx, cy, r, 'ALT m');
    ticks(cx, cy, r, 12, 3);
    const frac = altitude / 1000;
    needle(cx, cy, r, frac * Math.PI * 2, GREEN, 2);
    needle(cx, cy, r * 0.62, (altitude % 1000) / 100 * Math.PI * 2, AMBER, 3);
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(altitude)), cx, cy + 16);
  }

  function drawAirspeed(cx, cy, r, speed) {
    gaugeFace(cx, cy, r, 'IAS m/s');
    ticks(cx, cy, r, 12, 3);
    const frac = Math.min(speed, 120) / 120;
    needle(cx, cy, r, -Math.PI * 0.75 + frac * Math.PI * 1.5, GREEN, 3);
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(speed)), cx, cy + 16);
  }

  function drawFuel(cx, cy, r, fuel) {
    gaugeFace(cx, cy, r, 'FUEL');
    ticks(cx, cy, r, 8, 2);
    const frac = Math.max(0, Math.min(1, fuel / 100));
    const color = frac < 0.2 ? RED : frac < 0.4 ? AMBER : GREEN;
    needle(cx, cy, r, -Math.PI * 0.75 + frac * Math.PI * 1.5, color, 3);
    ctx.fillStyle = color;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(fuel)}%`, cx, cy + 16);
  }

  function drawVerticalSpeed(cx, cy, r, vs) {
    gaugeFace(cx, cy, r, 'V/S m/s');
    ticks(cx, cy, r, 10, 5);
    const frac = Math.max(-1, Math.min(1, vs / 15));
    needle(cx, cy, r, frac * Math.PI * 0.75, vs < -6 ? RED : GREEN, 3);
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${vs >= 0 ? '+' : ''}${vs.toFixed(1)}`, cx, cy + 16);
  }

  // Paint all six gauges for the current flight state. The panel canvas is
  // laid out by its CSS size: six gauges in a row, centred at the bottom.
  function draw(state) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,179,71,0.12)';
    ctx.fillRect(0, 0, w, 3);
    const r = Math.min(46, (h - 14) / 2);
    const cy = h / 2 + 2;
    const gap = w / 6;
    const headingDeg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
    drawHorizon(gap * 0.5, cy, r, state.pitch, state.roll);
    drawAltimeter(gap * 1.5, cy, r, state.altitude);
    drawAirspeed(gap * 2.5, cy, r, state.speed);
    drawCompass(gap * 3.5, cy, r, headingDeg);
    drawFuel(gap * 4.5, cy, r, state.fuel);
    drawVerticalSpeed(gap * 5.5, cy, r, state.verticalSpeed);
  }

  return { draw, resize };
}
