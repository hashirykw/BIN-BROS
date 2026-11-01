/* Bin Bros: realistic 3D wheelie cart, studio-lit
   Real 96-gal cart proportions, textured HDPE plastic, domed lid with skirt,
   molded handle, treaded wheels, logo die-cut sticker, real floor shadows,
   wet sheen while washing, high-pressure water streaks, mist and foam.
   Everything is driven by the `state` object the scroll timeline writes to. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const W = 1.0, H = 1.48, D = 1.12;   // body top size (world units)
const TAPER = 0.8;                    // bottom scale
const FLOOR = -H / 2 - 0.08;          // wheels + feet rest here
const taper = (y) => TAPER + (1 - TAPER) * ((y + H / 2) / H);
export const BIN_HEIGHT = H + 0.08 + 0.16; // floor to lid top

/* ---------- geometry helpers ---------- */
function taperGeometry(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = taper(p.getY(i));
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * s);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function openTop(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const P = [], N = [], U = [];
  const top = H / 2 - 1e-4;
  for (let i = 0; i < pos.count; i += 3) {
    if (pos.getY(i) > top && pos.getY(i + 1) > top && pos.getY(i + 2) > top) continue;
    for (let k = 0; k < 3; k++) {
      P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      N.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
      if (uv) U.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return out;
}

function rr(w, h, r, Ctor = THREE.Shape) {
  const s = new Ctor();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- textures ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function grainTexture() {   // fine HDPE grain for bump
  const t = canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h), r = rng(3);
    for (let i = 0; i < w * h; i++) {
      const v = 118 + r() * 22 + (r() < 0.02 ? 30 : 0);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4);
  return t;
}

function grimeTexture(seed = 7) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    for (let i = 0; i < 170; i++) {
      const x = r() * w, y = h * (0.15 + r() * 0.9), rad = 4 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.18 + r() * 0.45;
      gr.addColorStop(0, `rgba(54,42,24,${a})`); gr.addColorStop(1, 'rgba(54,42,24,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 34; i++) {        // drips running down
      const x = r() * w, y = r() * h * 0.35, l = 40 + r() * 200, wd = 2 + r() * 5;
      const gr = g.createLinearGradient(0, y, 0, y + l);
      gr.addColorStop(0, 'rgba(44,34,18,.5)'); gr.addColorStop(1, 'rgba(44,34,18,0)');
      g.fillStyle = gr; g.fillRect(x, y, wd, l);
    }
    const b = g.createLinearGradient(0, h, 0, h * 0.55);
    b.addColorStop(0, 'rgba(36,28,14,.7)'); b.addColorStop(1, 'rgba(36,28,14,0)');
    g.fillStyle = b; g.fillRect(0, h * 0.55, w, h * 0.45);
  });
}

function labelTexture() {   // service sticker under the logo
  return canvasTex(1024, 300, (g, w, h) => {
    const r = 34;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, r); g.fill();
    g.fillStyle = '#9FCE10';
    g.beginPath(); g.roundRect(6, 6, w - 12, 110, [r, r, 0, 0]); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    try { g.fontStretch = 'expanded'; } catch (e) {}
    g.fillStyle = '#032E73'; g.font = 'italic 800 76px "Barlow Condensed", Arial Narrow, sans-serif';
    g.fillText('SANITIZED BY BIN BROS', w / 2, 64);
    g.font = '800 92px Archivo, Arial, sans-serif';
    g.fillText('(757) 240-8445', w / 2, 204);
  });
}

function softDot() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}
function aoTexture() {
  return canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,10,30,.85)'); gr.addColorStop(0.45, 'rgba(0,10,30,.35)'); gr.addColorStop(1, 'rgba(0,10,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}

function pointsMaterial(map, color, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Color(color) }, pr: { value: 1 } },
    vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float pr;
      void main(){ vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*pr*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
      void main(){ vec4 t=texture2D(map,gl_PointCoord); float a=t.a*vA; if(a<0.004) discard; gl_FragColor=vec4(color,a); }`,
    transparent: true, depthWrite: false, ...(additive ? ADD : {}),
  });
}
// Additive colour without writing alpha: correct on a transparent canvas over the page
const ADD = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};

/* ================================================================ */
export async function initScene(canvas, state, opts = {}) {
  const small = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, small ? 1.75 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const CAM = new THREE.Vector3(0, 0.95, 7.2);
  camera.position.copy(CAM);
  camera.lookAt(0, 0.05, 0);

  // Studio lighting: soft key with shadows, cool fill, rim to separate from the backdrop
  scene.add(new THREE.HemisphereLight(0xe6f0ff, 0x0b2a66, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.6);
  key.position.set(3.2, 6.5, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 6;
  scene.add(key); scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.7); fill.position.set(-4, 2, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xdcecff, 2.0); rim.position.set(-2.5, 3.5, -4.5); scene.add(rim);

  /* ---------- hierarchy: root (viewport place) > turn (spin) > tip (axle pivot) > bin ---------- */
  const root = new THREE.Group(); scene.add(root);
  const turn = new THREE.Group(); root.add(turn);
  const axleY = FLOOR + 0.2, axleZ = -(D / 2) * TAPER + 0.03;
  const tip = new THREE.Group(); tip.position.set(0, axleY, axleZ); turn.add(tip);
  const bin = new THREE.Group(); bin.position.set(0, -axleY, -axleZ); tip.add(bin);

  /* ---------- materials ---------- */
  const grain = grainTexture();
  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0x0150b4, roughness: 0.56, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.4,
    bumpMap: grain, bumpScale: 0.6, envMapIntensity: 0.7,
  });
  const plasticInner = new THREE.MeshStandardMaterial({ color: 0x013a86, roughness: 0.7, side: THREE.BackSide, bumpMap: grain, bumpScale: 0.4 });
  const plasticDark = new THREE.MeshPhysicalMaterial({ color: 0x013f92, roughness: 0.6, bumpMap: grain, bumpScale: 0.5, envMapIntensity: 0.6 });
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fce10, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4, bumpMap: grain, bumpScale: 0.6, envMapIntensity: 0.7,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.55, metalness: 0.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.9 });
  const shadowCasters = [];
  const add = (mesh, parent = bin, cast = true, receive = true) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh);
    if (cast) shadowCasters.push(mesh);
    return mesh;
  };

  /* ---------- body ---------- */
  const bodyGeo = openTop(taperGeometry(new RoundedBoxGeometry(W, H, D, 8, 0.11)));
  add(new THREE.Mesh(bodyGeo, plastic));
  const inner = new THREE.Mesh(bodyGeo.clone(), plasticInner);
  inner.scale.set(0.92, 0.97, 0.92); inner.position.y = -0.02; add(inner, bin, false, true);

  // grime overlay (body)
  const grimeMat = new THREE.MeshStandardMaterial({
    map: grimeTexture(7), transparent: true, opacity: 0, roughness: 0.95, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const grime = new THREE.Mesh(bodyGeo, grimeMat); grime.scale.setScalar(1.006); bin.add(grime);

  // top skirt band (thick molded rim like a real cart)
  const skirtShape = rr(W + 0.07, D + 0.07, 0.13);
  skirtShape.holes.push(rr(W * 0.9, D * 0.9, 0.08, THREE.Path));
  const skirtGeo = new THREE.ExtrudeGeometry(skirtShape, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 3, curveSegments: 10 });
  skirtGeo.rotateX(-Math.PI / 2);
  const skirt = add(new THREE.Mesh(skirtGeo, plastic)); skirt.position.y = H / 2 - 0.13;

  // vertical ribs + front lift bar
  const slope = Math.atan(((1 - TAPER) * D / 2) / H);
  const ribGeo = new RoundedBoxGeometry(0.055, H * 0.66, 0.035, 2, 0.014);
  [-0.37, 0.37].forEach((x) => {
    const y = -0.08, rib = add(new THREE.Mesh(ribGeo, plastic));
    rib.position.set(x * taper(y), y, (D / 2) * taper(y) + 0.008); rib.rotation.x = slope;
  });
  const lift = add(new THREE.Mesh(new RoundedBoxGeometry(W * 0.74, 0.06, 0.05, 2, 0.02), plasticDark));
  { const y = H / 2 - 0.2; lift.position.set(0, y, (D / 2) * taper(y) + 0.02); lift.rotation.x = slope; }

  // front feet
  [-1, 1].forEach((s) => {
    const f = add(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.12, 2, 0.03), plasticDark));
    f.position.set(s * 0.26, FLOOR + 0.05, (D / 2) * TAPER - 0.12);
  });

  // handle (molded bar at the back) + arms
  const handle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, W * 0.84, 24), plastic));
  handle.rotation.z = Math.PI / 2; handle.position.set(0, H / 2 - 0.02, -(D / 2 + 0.16));
  [-1, 1].forEach((s) => {
    const arm = add(new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.13, 0.2, 3, 0.03), plastic));
    arm.position.set(s * W * 0.41, H / 2 - 0.04, -(D / 2 + 0.08));
  });

  // wheel wells + wheels (lathe tire with rounded shoulders)
  const tireProfile = [];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI; tireProfile.push(new THREE.Vector2(0.17 + Math.cos(a) * 0.035, Math.sin(a) * 0.05)); }
  tireProfile.unshift(new THREE.Vector2(0.11, -0.05)); tireProfile.push(new THREE.Vector2(0.11, 0.05));
  const tireGeo = new THREE.LatheGeometry(tireProfile, 40); tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.09, 32); hubGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20); capGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  [-1, 1].forEach((s) => {
    const g = new THREE.Group();
    g.position.set(s * ((W / 2) * TAPER + 0.065), axleY, axleZ);
    add(new THREE.Mesh(tireGeo, rubber), g); add(new THREE.Mesh(hubGeo, hubMat), g);
    const cap = add(new THREE.Mesh(capGeo, steel), g, false); cap.position.x = s * 0.01;
    // spokes
    for (let k = 0; k < 3; k++) {
      const spk = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.21, 0.024), hubMat), g, false);
      spk.position.x = s * 0.05; spk.rotation.x = (k / 3) * Math.PI;
    }
    bin.add(g); wheels.push(g);
  });
  const axle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, W * TAPER + 0.2, 12), steel), bin, true, false);
  axle.rotation.z = Math.PI / 2; axle.position.set(0, axleY, axleZ);

  // sticker: real logo (die-cut) + service label
  const texLoader = new THREE.TextureLoader();
  const logoTex = await new Promise((res) => texLoader.load(opts.logo || 'assets/logo-400.webp', res, undefined, () => res(null)));
  const stickerY = 0.2;
  if (logoTex) {
    logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
    const sw = 0.5, sh = sw * (logoTex.image.height / logoTex.image.width);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshPhysicalMaterial({ map: logoTex, transparent: true, alphaTest: 0.35, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, polygonOffset: true, polygonOffsetFactor: -4 }));
    logo.position.set(0, stickerY, (D / 2) * taper(stickerY) + 0.004); logo.rotation.x = slope;
    logo.receiveShadow = true; bin.add(logo);
  }
  const labelY = -0.24;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.164),
    new THREE.MeshPhysicalMaterial({ map: labelTexture(), transparent: true, roughness: 0.35, clearcoat: 0.5, polygonOffset: true, polygonOffsetFactor: -4 }));
  label.position.set(0, labelY, (D / 2) * taper(labelY) + 0.004); label.rotation.x = slope;
  label.receiveShadow = true; bin.add(label);

  /* ---------- lid ---------- */
  const hinge = new THREE.Group();
  hinge.position.set(0, H / 2 + 0.02, -(D / 2 + 0.07));
  bin.add(hinge);
  const LW = W + 0.11, LD = D + 0.16;
  const lidGeo = new THREE.ExtrudeGeometry(rr(LW, LD, 0.12), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.022, bevelSegments: 4, curveSegments: 12 });
  lidGeo.rotateX(-Math.PI / 2);
  { // gentle dome
    const p = lidGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); if (y < 0.03) continue;
      const nx = p.getX(i) / (LW / 2), nz = p.getZ(i) / (LD / 2);
      p.setY(i, y + 0.035 * Math.max(0, 1 - nx * nx) * Math.max(0, 1 - nz * nz));
    }
    lidGeo.computeVertexNormals();
  }
  const lidSkirtShape = rr(LW + 0.01, LD + 0.01, 0.125);
  lidSkirtShape.holes.push(rr(LW - 0.05, LD - 0.05, 0.1, THREE.Path));
  const lidSkirtGeo = new THREE.ExtrudeGeometry(lidSkirtShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 12 });
  lidSkirtGeo.rotateX(-Math.PI / 2);
  const lidGroup = new THREE.Group(); lidGroup.position.set(0, 0.012, LD / 2 - 0.02); hinge.add(lidGroup);
  const lidMesh = add(new THREE.Mesh(lidGeo, lidMat), lidGroup);
  const lidSkirt = add(new THREE.Mesh(lidSkirtGeo, lidMat), lidGroup); lidSkirt.position.y = -0.06;
  const lidHandle = add(new THREE.Mesh(new RoundedBoxGeometry(W * 0.42, 0.05, 0.08, 3, 0.022), lidMat), lidGroup);
  lidHandle.position.set(0, -0.025, LD / 2 + 0.03);
  // two molded ribs on the lid top
  [-0.22, 0.22].forEach((z) => {
    const r = add(new THREE.Mesh(new RoundedBoxGeometry(W * 0.8, 0.02, 0.05, 2, 0.01), lidMat), lidGroup);
    r.position.set(0, 0.085, z);
  });
  const lidGrimeMat = grimeMat.clone(); lidGrimeMat.map = grimeTexture(19);
  const lidGrime = new THREE.Mesh(lidGeo, lidGrimeMat); lidGrime.scale.setScalar(1.004); lidGroup.add(lidGrime);
  // hinge pins
  [-1, 1].forEach((s) => {
    const pin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), plasticDark), hinge);
    pin.rotation.z = Math.PI / 2; pin.position.set(s * W * 0.32, 0.01, 0);
  });

  /* ---------- floor: shadow catcher + contact AO ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true;
  root.add(floor);
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: aoTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
  ao.rotation.x = -Math.PI / 2; ao.position.y = FLOOR + 0.002; root.add(ao);

  /* ---------- foam bubbles (small, iridescent, only while washing) ---------- */
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transparent: true, depthWrite: false,
    iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 620,
    clearcoat: 1, envMapIntensity: 2.4,
  });
  bubbleMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      float bf = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
      gl_FragColor.a = mix(0.03, 0.85, bf);`);
  };
  const NF = small ? 46 : 70;
  const foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), bubbleMat, NF);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foam.frustumCulled = false;
  bin.add(foam);
  const fr = rng(41);
  const fb = Array.from({ length: NF }, () => ({ x: (fr() - 0.5) * 0.8, z: (fr() - 0.5) * 0.8, r: 0.014 + Math.pow(fr(), 2) * 0.05, t: fr(), sp: 0.18 + fr() * 0.3, wob: fr() * 6, drift: (fr() - 0.5) * 0.6, out: fr() }));

  /* ---------- water: droplets + streaks + mist ---------- */
  const dot = softDot();
  const NS = small ? 380 : 620;
  const sp = Array.from({ length: NS }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1 }));
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(NS * 3), dSize = new Float32Array(NS), dAlpha = new Float32Array(NS);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  dGeo.setAttribute('alpha', new THREE.BufferAttribute(dAlpha, 1));
  const dMat = pointsMaterial(dot, 0xe2f1ff, true);
  const drops = new THREE.Points(dGeo, dMat); drops.frustumCulled = false; bin.add(drops);
  const lPos = new Float32Array(NS * 6), lCol = new Float32Array(NS * 6);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  lGeo.setAttribute('color', new THREE.BufferAttribute(lCol, 3));
  const streaks = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, ...ADD }));
  streaks.frustumCulled = false; bin.add(streaks);
  let spawnAcc = 0;

  const NM = 40;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array(NM * 3), mSize = new Float32Array(NM), mAlpha = new Float32Array(NM);
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('size', new THREE.BufferAttribute(mSize, 1));
  mGeo.setAttribute('alpha', new THREE.BufferAttribute(mAlpha, 1));
  const mMat = pointsMaterial(dot, 0xffffff, false);
  const mist = new THREE.Points(mGeo, mMat); mist.frustumCulled = false; bin.add(mist);
  const ms = Array.from({ length: NM }, (_, i) => ({ life: i / NM, x: 0, z: 0, d: 0 }));
  [dMat, mMat].forEach((m) => (m.uniforms.pr.value = DPR));

  /* ---------- interaction / sizing ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  let vw = 1, vh = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vh = 2 * CAM.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    vw = vh * camera.aspect;
  }
  addEventListener('resize', resize); resize();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cBlue = new THREE.Color(0x0150b4), cDirtyBlue = new THREE.Color(0x2c3f58);
  const cLime = new THREE.Color(0x9fce10), cDirtyLime = new THREE.Color(0x6e7a3e);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let prev = performance.now(), t = 0, running = false;

  function frame() {
    const now = performance.now(), dt = Math.min((now - prev) / 1000, 1 / 20); prev = now; t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

    // placement: the camera looks slightly down, so place the floor point
    root.position.set(state.xf * vw, state.yf * vh, 0);
    root.scale.setScalar(state.scale);
    key.target.position.copy(root.position); key.position.set(root.position.x + 3.2, root.position.y + 6.5, 4.2);
    const idle = reduce ? 0 : 1;
    turn.rotation.y = -0.55 + state.spin + Math.sin(t * 0.35) * 0.16 * idle + mouse.x * 0.28;
    tip.rotation.x = -state.tip * 0.42;
    root.rotation.x = mouse.y * 0.03;
    // wheels roll a touch when tipping (looks like rolling to the curb)
    wheels.forEach((w) => (w.rotation.x = -state.tip * 2.2));

    hinge.rotation.x = -state.lid * 1.95;
    grimeMat.opacity = state.grime; lidGrimeMat.opacity = state.grime * 0.8;
    plastic.color.copy(cBlue).lerp(cDirtyBlue, state.grime * 0.45);
    lidMat.color.copy(cLime).lerp(cDirtyLime, state.grime * 0.45);
    // wet sheen after washing
    const wet = state.wet;
    plastic.roughness = 0.56 - wet * 0.42; plastic.clearcoat = 0.12 + wet * 0.85; plastic.clearcoatRoughness = 0.4 - wet * 0.32;
    lidMat.roughness = 0.5 - wet * 0.38; lidMat.clearcoat = 0.15 + wet * 0.8; lidMat.clearcoatRoughness = 0.4 - wet * 0.32;

    // foam bubbles rising out of the bin while washing, drifting out on the finish
    for (let i = 0; i < NF; i++) {
      const b = fb[i];
      b.t += dt * b.sp * (reduce ? 0 : 1); if (b.t > 1) b.t -= 1;
      const life = b.t;
      const outward = state.burst * b.out;
      v.set(b.x * (1 + outward * 1.8) + Math.sin(t * 2 + b.wob) * 0.03 + b.drift * life * outward,
        H / 2 - 0.1 + life * (0.6 + outward * 0.9),
        b.z * (1 + outward * 1.8) + 0.05);
      const vis = Math.max(state.foam, state.burst * 0.9);
      const s = b.r * vis * Math.sin(Math.min(life * 1.2, 1) * Math.PI);
      sc.setScalar(Math.max(s, 0.0001));
      m4.compose(v, q, sc); foam.setMatrixAt(i, m4);
    }
    foam.instanceMatrix.needsUpdate = true;

    // high-pressure water
    spawnAcc += state.spray * (small ? 480 : 820) * dt;
    for (let i = 0; i < NS && spawnAcc >= 1; i++) {
      const p = sp[i]; if (p.alive) continue;
      spawnAcc -= 1;
      const arm = t * 8 + (i % 3) * (Math.PI * 2 / 3);
      const spread = 0.2 + Math.random() * 0.5;
      p.alive = true; p.life = 0; p.max = 0.9 + Math.random() * 0.6; p.s = 0.06 + Math.random() * 0.12;
      p.x = Math.cos(arm) * 0.06; p.z = Math.sin(arm) * 0.06; p.y = -0.2;
      p.vx = Math.cos(arm) * spread; p.vz = Math.sin(arm) * spread * 0.85; p.vy = 4.2 + Math.random() * 1.3;
    }
    spawnAcc = Math.min(spawnAcc, 40);
    for (let i = 0; i < NS; i++) {
      const p = sp[i];
      if (p.alive) {
        p.life += dt; p.vy -= 7 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < H / 2) {
          const lim = (W / 2) * 0.86;
          if (Math.abs(p.x) > lim) { p.vx *= -0.35; p.x = Math.sign(p.x) * lim; }
          if (Math.abs(p.z) > lim) { p.vz *= -0.35; p.z = Math.sign(p.z) * lim; }
        }
        if (p.life > p.max || p.y < -0.5) p.alive = false;
      }
      const a = p.alive ? (1 - p.life / p.max) : 0;
      dPos[i * 3] = p.x; dPos[i * 3 + 1] = p.y; dPos[i * 3 + 2] = p.z;
      dSize[i] = p.alive ? p.s : 0; dAlpha[i] = a * 0.7;
      // streak = current pos to pos minus velocity * dt-ish
      const k = 0.035;
      lPos[i * 6] = p.x; lPos[i * 6 + 1] = p.y; lPos[i * 6 + 2] = p.z;
      lPos[i * 6 + 3] = p.x - p.vx * k; lPos[i * 6 + 4] = p.y - p.vy * k; lPos[i * 6 + 5] = p.z - p.vz * k;
      const c = a * 0.75;
      lCol[i * 6] = lCol[i * 6 + 3] = c * 0.82; lCol[i * 6 + 1] = lCol[i * 6 + 4] = c * 0.92; lCol[i * 6 + 2] = lCol[i * 6 + 5] = c;
    }
    dGeo.attributes.position.needsUpdate = true; dGeo.attributes.size.needsUpdate = true; dGeo.attributes.alpha.needsUpdate = true;
    lGeo.attributes.position.needsUpdate = true; lGeo.attributes.color.needsUpdate = true;

    for (let i = 0; i < NM; i++) {
      const m = ms[i];
      m.life += dt * 0.4;
      if (m.life > 1) { m.life = 0; m.x = (Math.random() - 0.5) * 0.8; m.z = (Math.random() - 0.5) * 0.6; m.d = (Math.random() - 0.5) * 1.0; }
      mPos[i * 3] = m.x + m.d * m.life; mPos[i * 3 + 1] = H / 2 + 0.15 + m.life * 1.1; mPos[i * 3 + 2] = m.z + 0.2 + m.life * 0.3;
      mSize[i] = 1.2 + m.life * 3.0; mAlpha[i] = Math.sin(m.life * Math.PI) * 0.17 * state.steam;
    }
    mGeo.attributes.position.needsUpdate = true; mGeo.attributes.size.needsUpdate = true; mGeo.attributes.alpha.needsUpdate = true;

    camera.position.set(CAM.x, CAM.y, CAM.z * state.zoom);
    renderer.render(scene, camera);
  }

  function loop() { if (!running) return; frame(); requestAnimationFrame(loop); }
  renderer.compile(scene, camera);
  frame();

  return {
    start() { if (running) return; running = true; prev = performance.now(); requestAnimationFrame(loop); },
    stop() { running = false; },
    resize,
    /** world-units-per-viewport-height at the bin plane, used for layout fitting */
    viewHeight: () => vh,
    binHeight: BIN_HEIGHT,
    floorOffset: FLOOR,
  };
}
