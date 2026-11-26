// Merapi Run — the aircraft: a single-prop island hopper built from primitives
// (fuselage, wings, tail, spinning propeller, landing gear, nav lights), so it
// reads as a built machine from every angle, never a flat triangle.
export function createAircraft(THREE) {
  const plane = new THREE.Group();
  plane.name = 'aircraft';

  const redPaint = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.45, metalness: 0.25 });
  const creamPaint = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.5, metalness: 0.15 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.4, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.4 });

  // Fuselage: a tapered cylinder along the forward axis (-Z is forward here).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 7.2, 12), redPaint);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.4;
  plane.add(fuselage);

  // Nose cone and cockpit canopy.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.6, 12), creamPaint);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.9;
  plane.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), glassMat);
  canopy.scale.set(1, 0.75, 1.9);
  canopy.position.set(0, 0.75, -1.4);
  plane.add(canopy);

  // Main wing and tailplane: flat boxes with a slight taper via a second box.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), creamPaint);
  wing.position.set(0, 0.1, -0.6);
  plane.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.7), redPaint);
  wingTipL.position.set(-5.9, 0.1, -0.6);
  plane.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.9;
  plane.add(wingTipR);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.2), creamPaint);
  tailplane.position.set(0, 0.25, 3.6);
  plane.add(tailplane);

  // Vertical fin with the island's volcano stripe.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 1.5), redPaint);
  fin.position.set(0, 1.0, 3.7);
  plane.add(fin);
  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.5), creamPaint);
  finStripe.position.set(0, 1.35, 3.7);
  plane.add(finStripe);

  // Propeller: hub plus two blades, spun every frame by update().
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0, -4.8);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), darkMetal);
  hub.rotation.x = -Math.PI / 2;
  propGroup.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.28, 2.6, 0.1);
  const bladeA = new THREE.Mesh(bladeGeo, darkMetal);
  propGroup.add(bladeA);
  const bladeB = new THREE.Mesh(bladeGeo, darkMetal);
  bladeB.rotation.z = Math.PI / 2;
  propGroup.add(bladeB);
  plane.add(propGroup);

  // Landing gear: two fixed wheels and a tail wheel.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181a1c, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), darkMetal);
    strut.position.set(side * 1.1, -0.9, -1.2);
    plane.add(strut);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.45, -1.2);
    plane.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10), wheelMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, 3.9);
  plane.add(tailWheel);

  // Navigation lights: red port, green starboard, white tail — emissive so they glow.
  function navLight(color, x, y, z) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 }),
    );
    lamp.position.set(x, y, z);
    plane.add(lamp);
  }
  navLight(0xff2222, -5.9, 0.1, -0.6);
  navLight(0x22ff66, 5.9, 0.1, -0.6);
  navLight(0xffffff, 0, 0.4, 4.2);

  let spin = 0;
  function update(dt, throttle, flying) {
    spin += dt * (4 + throttle * 55) * (flying ? 1 : 0.4);
    propGroup.rotation.z = spin;
  }

  return { group: plane, update };
}
