// Merapi Run — the island: one procedural volcanic island with a smoking
// volcano, a sea, beaches, rice fields, a town and a lit runway. The same
// heightAt() function feeds the terrain mesh and the flight model, so the
// ground the pilot sees is the ground the pilot can hit.
import { WORLD } from './config.js';
import { makeNoise2D } from './random.js';

const ISLAND_R = WORLD.islandRadius;
const VOLC = WORLD.volcano;
const RW = WORLD.runway;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Height of the island at (x, z), in metres. Sea level is 0; the runway shelf
// is flattened to 2 m so a landing there is a landing, not a hillside.
export function makeHeightAt(seed) {
  const noise = makeNoise2D(seed);
  const hills = makeNoise2D(seed + 101);
  return function heightAt(x, z) {
    const distCentre = Math.hypot(x, z);
    // Island dome: high in the middle, falling to the sea at the shore.
    let h = 95 * (1 - smoothstep(700, ISLAND_R, distCentre));
    h += 26 * noise(x * 0.004, z * 0.004) + 10 * hills(x * 0.012, z * 0.012);
    // The volcano cone, with a crater dip at its very top.
    const dv = Math.hypot(x - VOLC.x, z - VOLC.z);
    const cone = Math.max(0, 1 - dv / VOLC.radius);
    h += VOLC.height * cone * cone;
    if (dv < 55) h -= 45 * (1 - dv / 55);
    // Flatten the runway shelf on the east coast.
    const dr = Math.hypot(x - RW.x, z - RW.z);
    const flat = 1 - smoothstep(260, 700, dr);
    h = h * (1 - flat) + 2 * flat;
    // The town shelf, gentler.
    const dt = Math.hypot(x - WORLD.town.x, z - WORLD.town.z);
    const townFlat = 1 - smoothstep(120, 300, dt);
    h = h * (1 - townFlat * 0.7) + 6 * townFlat * 0.7;
    return Math.max(h, -6);
  };
}

function terrainColour(h, slope, noise) {
  // Sand at the waterline, green fields, dark jungle on the slopes,
  // grey rock and ash near the volcano's top.
  if (h < 3.5) return [0.86, 0.78, 0.55];
  if (h < 14) return [0.45, 0.66, 0.32];
  if (h < 90) return [0.28, 0.5, 0.24];
  if (h < 190) return [0.22, 0.38, 0.2];
  if (h < 260) return [0.32, 0.3, 0.28];
  return [0.45, 0.42, 0.4];
}

export function createTerrain(THREE, seed) {
  const heightAt = makeHeightAt(seed);
  const noise = makeNoise2D(seed + 7);
  const group = new THREE.Group();
  group.name = 'island';

  // --- Ground mesh: a displaced plane with a colour per vertex. ---
  const SEG = 110;
  const size = ISLAND_R * 2 + 400;
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = noise(x * 0.01, z * 0.01) * 0.06;
    const c = terrainColour(h, 0, n);
    colours[i * 3] = c[0] + n;
    colours[i * 3 + 1] = c[1] + n;
    colours[i * 3 + 2] = c[2] + n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  ground.name = 'ground';
  group.add(ground);

  // --- Sea: a flat blue sheet just under the shore. ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    new THREE.MeshStandardMaterial({ color: 0x1e6f9e, roughness: 0.35, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevel;
  sea.name = 'sea';
  group.add(sea);

  // --- The runway: dark strip, white centre dashes, glowing edge lights. ---
  const runwayGroup = new THREE.Group();
  runwayGroup.name = 'runway';
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RW.width, 0.6, RW.length),
    new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.9 }),
  );
  strip.position.set(RW.x, 2.4, RW.z);
  runwayGroup.add(strip);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.6 });
  for (let d = -RW.length / 2 + 20; d < RW.length / 2; d += 40) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 18), dashMat);
    dash.position.set(RW.x, 2.8, RW.z + d);
    runwayGroup.add(dash);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc861, emissiveIntensity: 2.2 });
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 8);
  for (let d = -RW.length / 2; d <= RW.length / 2; d += 35) {
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(RW.x + side * (RW.width / 2 + 2), 3.2, RW.z + d);
      runwayGroup.add(lamp);
    }
  }
  // Threshold bars at both ends.
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x66ff99, emissiveIntensity: 1.6 });
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(RW.width, 0.7, 3), barMat);
    bar.position.set(RW.x, 2.8, RW.z + end * (RW.length / 2 - 4));
    runwayGroup.add(bar);
  }
  group.add(runwayGroup);

  // --- The town: a cluster of small houses with coloured roofs and a pier. ---
  const townGroup = new THREE.Group();
  townGroup.name = 'town';
  const wallCols = [0xe8dcc8, 0xf2e6d0, 0xd8c8a8, 0xcfd8dc];
  const roofCols = [0xb3402f, 0x2f6db3, 0x3f7d4e, 0xc47f2f];
  const rng = { i: 0 };
  function townRand() {
    rng.i += 1;
    const s = Math.sin(rng.i * 127.1 + seed) * 43758.5453;
    return s - Math.floor(s);
  }
  for (let i = 0; i < 46; i += 1) {
    const hx = WORLD.town.x + (townRand() - 0.5) * 260;
    const hz = WORLD.town.z + (townRand() - 0.5) * 220;
    const w = 8 + townRand() * 10;
    const d = 8 + townRand() * 10;
    const hgt = 5 + townRand() * 7;
    const base = heightAt(hx, hz);
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, hgt, d),
      new THREE.MeshStandardMaterial({ color: wallCols[i % wallCols.length], roughness: 0.9 }),
    );
    walls.position.set(hx, base + hgt / 2, hz);
    townGroup.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.5, 4),
      new THREE.MeshStandardMaterial({ color: roofCols[i % roofCols.length], roughness: 0.8 }),
    );
    roof.position.set(hx, base + hgt + 1.7, hz);
    roof.rotation.y = Math.PI / 4;
    townGroup.add(roof);
  }
  // A pier reaching into the bay.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1, 120),
    new THREE.MeshStandardMaterial({ color: 0x8a6b46, roughness: 1 }),
  );
  pier.position.set(WORLD.town.x + 150, 1.5, WORLD.town.z + 180);
  townGroup.add(pier);
  group.add(townGroup);

  // --- Clouds: soft white puffs drifting over the island. ---
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const cloudSpots = [];
  for (let i = 0; i < 14; i += 1) {
    const puff = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j += 1) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(14 + ((i * 7 + j * 13) % 16), 10, 8), cloudMat);
      ball.position.set(j * 16 - n * 8, (j % 2) * 5, (j % 3) * 10 - 10);
      ball.scale.y = 0.45;
      puff.add(ball);
    }
    const a = (i / 14) * Math.PI * 2;
    const r = 500 + ((i * 173) % 800);
    puff.position.set(Math.cos(a) * r, 260 + (i % 4) * 35, Math.sin(a) * r);
    clouds.add(puff);
    cloudSpots.push(puff);
  }
  group.add(clouds);

  // --- Volcano smoke: grey puffs that rise and fade above the crater. ---
  const smoke = new THREE.Group();
  smoke.name = 'smoke';
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1, transparent: true, opacity: 0.55 });
  const smokePuffs = [];
  for (let i = 0; i < 10; i += 1) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(10 + (i % 4) * 4, 8, 8), smokeMat);
    ball.scale.y = 0.7;
    smoke.add(ball);
    smokePuffs.push(ball);
  }
  group.add(smoke);

  // --- Target rings: glowing torus gates, one mesh each, shown per mission. ---
  const ringGroup = new THREE.Group();
  ringGroup.name = 'rings';
  const ringGeo = new THREE.TorusGeometry(16, 1.6, 10, 28);
  const ringMatNext = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9500, emissiveIntensity: 2.4 });
  const ringMatDone = new THREE.MeshStandardMaterial({ color: 0x37d67a, emissive: 0x1fae5f, emissiveIntensity: 1.6 });
  const ringMatLater = new THREE.MeshStandardMaterial({ color: 0x8fa8c0, emissive: 0x335577, emissiveIntensity: 0.9 });
  const ringMeshes = [];
  function buildRings(positions) {
    for (const m of ringMeshes) ringGroup.remove(m);
    ringMeshes.length = 0;
    for (const p of positions) {
      const ring = new THREE.Mesh(ringGeo, ringMatLater);
      ring.position.set(p.x, p.y, p.z);
      ring.rotation.y = p.heading ?? 0;
      ringGroup.add(ring);
      ringMeshes.push(ring);
    }
  }
  function paintRings(nextIndex) {
    for (let i = 0; i < ringMeshes.length; i += 1) {
      ringMeshes[i].material = i < nextIndex ? ringMatDone : i === nextIndex ? ringMatNext : ringMatLater;
    }
  }
  group.add(ringGroup);

  const craterTop = heightAt(VOLC.x, VOLC.z);
  function update(dt, t) {
    for (let i = 0; i < cloudSpots.length; i += 1) {
      cloudSpots[i].position.x += dt * (2 + (i % 3));
      if (cloudSpots[i].position.x > 1600) cloudSpots[i].position.x = -1600;
    }
    for (let i = 0; i < smokePuffs.length; i += 1) {
      const cycle = ((t * 0.12 + i / smokePuffs.length) % 1);
      const p = smokePuffs[i];
      p.position.set(VOLC.x + Math.sin(i * 2.3 + t * 0.3) * 8 * cycle, craterTop + 12 + cycle * 90, VOLC.z + Math.cos(i * 1.7) * 8 * cycle);
      const s = 0.6 + cycle * 1.8;
      p.scale.set(s, s * 0.7, s);
      p.material.opacity = 0.55 * (1 - cycle);
    }
    for (let i = 0; i < ringMeshes.length; i += 1) {
      ringMeshes[i].rotation.z = t * 0.25 + i;
    }
  }

  return { group, heightAt, buildRings, paintRings, update };
}
