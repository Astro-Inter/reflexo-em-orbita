import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** Procedural reconstruction of the four supplied official poses. +Z is the face. */
export function createAstrinho() {
  const root = new THREE.Group();
  const porcelain = new THREE.MeshPhysicalMaterial({
    color: "#fff8f0",
    roughness: 0.4,
    metalness: 0,
    clearcoat: 0.24,
  });
  const seam = new THREE.MeshStandardMaterial({
    color: "#d0cbd5",
    roughness: 0.42,
    metalness: 0.25,
  });
  const purple = new THREE.MeshPhysicalMaterial({
    color: "#5706d1",
    roughness: 0.43,
    metalness: 0.04,
    clearcoat: 0.3,
  });
  const groove = new THREE.MeshStandardMaterial({
    color: "#330365",
    roughness: 0.5,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#080912",
    roughness: 0.3,
    metalness: 0.02,
    clearcoat: 0.45,
  });
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    toneMapped: false,
  });
  const engineMaterial = new THREE.MeshBasicMaterial({
    color: "#ac45ff",
    toneMapped: false,
  });
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent = root,
    position: [number, number, number] = [0, 0, 0],
  ) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    parent.add(object);
    return object;
  }
  function box(
    w: number,
    h: number,
    d: number,
    radius: number,
    material: THREE.Material,
    parent = root,
    position: [number, number, number] = [0, 0, 0],
  ) {
    // Separate the face corner radius from depth; a shallow visor still needs
    // the large curved corners seen in the reference, rather than a square slab.
    const bevel = Math.min(d * 0.3, radius * 0.72);
    const x = w / 2 - bevel,
      y = h / 2 - bevel,
      r = radius - bevel;
    const shape = new THREE.Shape();
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y);
    shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r);
    shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y);
    shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r);
    shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 16,
      steps: 1,
      curveSegments: 24,
    });
    geometry.translate(0, 0, -(d - 2 * bevel) / 2);
    // Weld the extrusion's duplicate vertices so its bevels shade as a continuous
    // porcelain surface instead of a stack of visible flat bands.
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    const smooth = mergeVertices(geometry);
    smooth.computeVertexNormals();
    geometry.dispose();
    return mesh(smooth, material, parent, position);
  }
  box(2.32, 2.62, 1.04, 0.48, porcelain);
  box(1.84, 1.12, 0.15, 0.27, glass, root, [0, 0.46, 0.535]);
  const eyes = [-0.44, 0.44].map((x) => {
    const eye = mesh(new THREE.SphereGeometry(1, 40, 32), eyeMaterial, root, [
      x,
      0.47,
      0.624,
    ]);
    eye.scale.set(0.19, 0.265, 0.025);
    return eye;
  });
  const happyEyes = [-0.44, 0.44].map((x) => {
    const expression = new THREE.Group();
    expression.position.set(x, 0.47, 0.638);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.16, -0.055, 0),
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0.16, -0.055, 0),
    );
    mesh(
      new THREE.TubeGeometry(curve, 32, 0.043, 14, false),
      eyeMaterial,
      expression,
    );
    for (const side of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.043, 24, 16), eyeMaterial, expression, [
        side * 0.16,
        -0.055,
        0,
      ]);
    }
    expression.visible = false;
    root.add(expression);
    return expression;
  });
  // The official chest mark is an embossed graphic, not a ball inside a hoop.
  // Its back arc must disappear behind the blue disk, while the front arc and
  // fine white inner edge cross in front of its lower hemisphere (all four poses).
  const badge = new THREE.Group();
  badge.position.set(0, -0.63, 0.535);
  root.add(badge);
  const ink = new THREE.MeshBasicMaterial({
    color: "#6509d9",
    toneMapped: false,
  });
  const whiteInk = new THREE.MeshBasicMaterial({
    color: "#fffaf5",
    toneMapped: false,
  });
  function badgeArc(
    inner: number,
    outer: number,
    start: number,
    length: number,
    lift: number,
    material: THREE.Material,
  ) {
    const geometry = new THREE.RingGeometry(inner, outer, 96, 1, start, length);
    const positions = geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index++) {
      const y = positions.getY(index);
      positions.setY(index, y * 0.23);
      positions.setZ(index, 0.049 - (y / 0.68) * 0.04 + lift);
    }
    geometry.computeVertexNormals();
    return mesh(geometry, material, badge);
  }
  // A continuous inclined band avoids a seam at either tip of the ellipse.
  badgeArc(0.515, 0.68, 0, Math.PI * 2, 0, ink);
  const planetGeometry = new THREE.SphereGeometry(0.39, 48, 32);
  const positions = planetGeometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const topBlue = new THREE.Color("#0349ed");
  const bottomBlue = new THREE.Color("#001fa8");
  for (let index = 0; index < positions.count; index++) {
    const color = bottomBlue
      .clone()
      .lerp(topBlue, (positions.getY(index) / 0.39 + 1) / 2);
    color.toArray(colors, index * 3);
  }
  planetGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const planet = mesh(
    planetGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    badge,
    [0, 0, 0.032],
  );
  planet.scale.z = 0.115;
  badgeArc(0.489, 0.515, Math.PI, Math.PI, 0.002, whiteInk);
  mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 0.17, 32),
    purple,
    root,
    [0, 1.38, 0],
  );
  mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.58, 24),
    seam,
    root,
    [0, 1.72, 0],
  );
  const dish = mesh(
    new THREE.SphereGeometry(1, 32, 20),
    porcelain,
    root,
    [0, 1.7, 0],
  );
  dish.scale.set(0.47, 0.085, 0.35);
  mesh(new THREE.SphereGeometry(0.18, 24, 20), porcelain, root, [0, 2.04, 0]);
  const nozzleProfile = [
    [0, -0.22],
    [0.36, -0.22],
    [0.41, -0.19],
    [0.44, -0.04],
    [0.46, 0.02],
    [0.56, 0.04],
    [0.6, 0.09],
    [0.62, 0.24],
    [0.59, 0.28],
    [0, 0.28],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  mesh(new THREE.LatheGeometry(nozzleProfile, 48), seam, root, [0, -1.5, 0]);
  const core = mesh(
    new THREE.SphereGeometry(1, 32, 16),
    engineMaterial,
    root,
    [0, -1.725, 0],
  );
  core.scale.set(0.35, 0.055, 0.35);
  const glow = new THREE.PointLight("#a03cff", 1.8, 2.2);
  glow.position.set(0, -1.9, 0.2);
  root.add(glow);
  const wings = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    wing.position.set(side * 1.15, -0.05, 0);
    root.add(wing);
    const axle = mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.23, 24),
      seam,
      wing,
      [side * 0.07, 0, 0],
    );
    axle.rotation.z = Math.PI / 2;
    const panel = new THREE.Group();
    panel.position.x = side * 0.7;
    wing.add(panel);
    box(1.03, 1.43, 0.2, 0.15, porcelain, panel);
    box(0.81, 1.21, 0.045, 0.08, purple, panel, [0, 0, 0.112]);
    for (const x of [-0.135, 0.135]) {
      mesh(new THREE.BoxGeometry(0.012, 1.15, 0.006), groove, panel, [
        x,
        0,
        0.138,
      ]);
    }
    for (const y of [-0.3025, 0, 0.3025]) {
      mesh(new THREE.BoxGeometry(0.76, 0.012, 0.006), groove, panel, [
        0,
        y,
        0.138,
      ]);
    }
    return wing;
  });
  return { root, wings, eyes, happyEyes, eyeMaterial, engineMaterial };
}
