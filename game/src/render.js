// Merapi Run — the renderer: the three.js scene, sky and sun, the cockpit
// and chase cameras, and the plane placed in the world each frame. The camera
// never fights the pilot: cockpit view looks straight out of the nose, chase
// view trails smoothly behind the tail.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { createTerrain } from './terrain.js';
import { createAircraft } from './aircraft.js';

export const VIEW_COCKPIT = 'cockpit';
export const VIEW_CHASE = 'chase';

export function createRenderer(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9fc3dd, 900, 4200);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 9000);
  camera.position.set(0, 80, 200);

  // Day light: warm sun from the south-west, soft sky fill from above.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
  sun.position.set(800, 900, 600);
  scene.add(sun);
  const skyFill = new THREE.HemisphereLight(0xbdd8ee, 0x9a8f7a, 1.1);
  scene.add(skyFill);

  // A big sky dome gradient and a bright sun disc, so the horizon reads.
  const skyGeo = new THREE.SphereGeometry(6000, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x87b5d9, side: THREE.BackSide, fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  sunDisc.position.set(2400, 2600, 1800);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const terrain = createTerrain(THREE, seed);
  scene.add(terrain.group);
  const aircraft = createAircraft(THREE);
  scene.add(aircraft.group);

  // The cockpit frame: a slim dashboard bar low in the frame and a faint
  // propeller disc, so the cockpit view has a machine around the pilot
  // without the airframe blocking the sky. The aircraft mesh itself is
  // hidden in cockpit view — its canopy would fill the screen.
  const cockpitGroup = new THREE.Group();
  cockpitGroup.name = 'cockpit-frame';
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.7 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.4), dashMat);
  dash.position.set(0, -0.85, -2.4);
  cockpitGroup.add(dash);
  cockpitGroup.visible = false;
  scene.add(cockpitGroup);

  const chaseOffset = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const smoothedChase = new THREE.Vector3(0, 80, 200);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Place the plane mesh from flight state and point the cameras.
  function draw(flight, view, dt, time) {
    aircraft.group.position.set(flight.x, flight.y, flight.z);
    aircraft.group.rotation.order = 'YXZ';
    aircraft.group.rotation.y = flight.heading;
    aircraft.group.rotation.x = -flight.pitch;
    aircraft.group.rotation.z = -flight.roll;
    aircraft.update(dt, flight.throttle, !flight.landed);

    const forward = new THREE.Vector3(Math.sin(flight.heading), 0, -Math.cos(flight.heading));
    if (view === VIEW_COCKPIT) {
      cockpitGroup.visible = true;
      aircraft.group.visible = false;
      cockpitGroup.position.set(flight.x, flight.y, flight.z);
      cockpitGroup.rotation.order = 'YXZ';
      cockpitGroup.rotation.y = flight.heading;
      cockpitGroup.rotation.x = -flight.pitch;
      cockpitGroup.rotation.z = -flight.roll;
      camera.position.set(
        flight.x + forward.x * 1.2,
        flight.y + 0.9,
        flight.z + forward.z * 1.2,
      );
      lookTarget.set(
        flight.x + forward.x * 60 + Math.sin(flight.roll) * -8,
        flight.y + Math.sin(flight.pitch) * 40 - Math.sin(flight.roll) * 4,
        flight.z + forward.z * 60,
      );
      camera.up.set(Math.sin(flight.roll), Math.cos(flight.roll), 0);
      camera.lookAt(lookTarget);
    } else {
      cockpitGroup.visible = false;
      aircraft.group.visible = true;
      chaseOffset.copy(forward).multiplyScalar(-13);
      chaseOffset.y = 4.5;
      const desired = new THREE.Vector3(flight.x + chaseOffset.x, flight.y + chaseOffset.y, flight.z + chaseOffset.z);
      smoothedChase.lerp(desired, Math.min(1, dt * 6));
      camera.position.copy(smoothedChase);
      camera.up.set(0, 1, 0);
      lookTarget.set(flight.x + forward.x * 30, flight.y + Math.sin(flight.pitch) * 12, flight.z + forward.z * 30);
      camera.lookAt(lookTarget);
    }
    terrain.update(dt, time);
    renderer.render(scene, camera);
  }

  // Snap the chase camera behind the plane at once (screenshot staging and
  // mission starts should not wait for the smoothing to catch up).
  function snapChase(flight) {
    const forward = new THREE.Vector3(Math.sin(flight.heading), 0, -Math.cos(flight.heading));
    smoothedChase.set(flight.x - forward.x * 13, flight.y + 4.5, flight.z - forward.z * 13);
  }

  return { draw, resize, terrain, snapChase };
}
