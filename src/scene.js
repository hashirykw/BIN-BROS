/* Bin Bros — 3D wheelie bin scene
   Procedural model (no external model files): tapered body, lime lid on a hinge,
   wheels, handle, decal, grime overlay, soap bubbles, hot-water spray, steam, sparkles.
   Everything is driven by a plain `state` object that the scroll timeline writes to. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const C = {
  blue: 0x0150b4,
  blueDeep: 0x01398a,
  navy: 0x032e73,
  lime: 0x9fce10,
  limeDeep: 0x7fae00,
  rubber: 0x12161f,
};

const W = 1.0, H = 1.36, D = 1.04;           // bin top size
const TAPER = 0.84;                            // bottom scale
const taper = (y) => TAPER + (1 - TAPER) * ((y + H / 2) / H);

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

// Remove the flat top face so the bin is open inside
function openTop(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const keepP = [], keepN = [], keepU = [];
  const top = H / 2 - 1e-4;
  for (let i = 0; i < pos.count; i += 3) {
    const allTop = pos.getY(i) > top && pos.getY(i + 1) > top && pos.getY(i + 2) > top;
    if (allTop) continue;
    for (let k = 0; k < 3; k++) {
      keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      keepN.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
      if (uv) keepU.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
  if (uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
  return out;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedRectPath(w, h, r) {
  const s = new THREE.Path();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- canvas textures ---------- */
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function decalTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    try { g.fontStretch = 'expanded'; } catch (e) {}
    // emblem
    g.save(); g.translate(w / 2, h * 0.30);
    g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2);
    g.fillStyle = '#9FCE10'; g.fill();
    g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#032E73'; g.font = '900 120px Archivo, Arial Black, sans-serif';
    g.fillText('BB', 0, 8);
    g.restore();
    // wordmark
    g.fillStyle = '#ffffff';
    let fs = 168; g.font = `900 ${fs}px Archivo, Arial Black, sans-serif`;
    while (g.measureText('BIN BROS').width > w * 0.8 && fs > 60) { fs -= 4; g.font = `900 ${fs}px Archivo, Arial Black, sans-serif`; }
    g.fillText('BIN BROS', w / 2, h * 0.585);
    g.fillStyle = '#9FCE10'; g.font = 'italic 800 92px "Barlow Condensed", Arial Narrow, sans-serif';
    g.fillText('SPICK AND SPAN', w / 2, h * 0.735);
    // speed lines
    g.fillStyle = '#9FCE10';
    [[-1, 1], [1, -1]].forEach(([d]) => {
      g.save(); g.translate(w / 2 + d * 345, h * 0.735);
      g.beginPath(); g.moveTo(-60 * d, -6); g.lineTo(60 * d, -10); g.lineTo(60 * d, 10); g.lineTo(-60 * d, 6); g.fill();
      g.restore();
    });
  });
}

function grimeTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) {
      const x = rnd() * w, y = h * (0.25 + rnd() * 0.8), r = 6 + rnd() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.25 + rnd() * 0.5;
      gr.addColorStop(0, `rgba(58,44,22,${a})`);
      gr.addColorStop(1, 'rgba(58,44,22,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // drips
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h * 0.4, l = 40 + rnd() * 160;
      const gr = g.createLinearGradient(0, y, 0, y + l);
      gr.addColorStop(0, 'rgba(48,38,18,.55)'); gr.addColorStop(1, 'rgba(48,38,18,0)');
      g.fillStyle = gr; g.fillRect(x, y, 3 + rnd() * 6, l);
    }
    // bottom crust band
    const b = g.createLinearGradient(0, h, 0, h * 0.6);
    b.addColorStop(0, 'rgba(40,30,14,.75)'); b.addColorStop(1, 'rgba(40,30,14,0)');
    g.fillStyle = b; g.fillRect(0, h * 0.6, w, h * 0.4);
  });
}

function dotTexture() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,.65)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}

function starTexture() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(c, 4); g.quadraticCurveTo(c, c, w - 4, c); g.quadraticCurveTo(c, c, c, w - 4);
    g.quadraticCurveTo(c, c, 4, c); g.quadraticCurveTo(c, c, c, 4); g.fill();
  }, false);
}

function shadowTexture() {
  return canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(1,14,40,.75)');
    gr.addColorStop(0.5, 'rgba(1,14,40,.28)');
    gr.addColorStop(1, 'rgba(1,14,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, false);
}

/* ---------- particle material ---------- */
function particleMaterial(map, color, additive = true) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: new THREE.Color(color) }, opacity: { value: 1 }, pr: { value: 1 } },
    vertexShader: `
      attribute float size; attribute float alpha;
      varying float vA; uniform float pr;
      void main(){
        vA = alpha;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * pr * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 color; uniform float opacity; varying float vA;
      void main(){
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(color, t.a * vA * opacity);
        if (gl_FragColor.a < 0.004) discard;
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export async function initScene(canvas, state) {
  const isSmall = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, isSmall ? 1.6 : 1.8);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.35, 6.4);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x032e73, 0.55));
  const key = new THREE.DirectionalLight(0xfff6e8, 2.4); key.position.set(3.5, 4.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 2.2); rim.position.set(-4, 2.5, -3); scene.add(rim);
  const limeKick = new THREE.PointLight(0xb8e33a, 6, 6, 1.6); limeKick.position.set(1.6, 1.6, 1.4); scene.add(limeKick);

  /* ---------- bin ---------- */
  const root = new THREE.Group();          // positioned in viewport space
  const bin = new THREE.Group();           // rotates / bobs
  root.add(bin); scene.add(root);

  const plastic = new THREE.MeshPhysicalMaterial({
    color: C.blue, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.2, envMapIntensity: 0.55,
  });
  const plasticInner = new THREE.MeshStandardMaterial({ color: C.blueDeep, roughness: 0.6, side: THREE.BackSide });
  const limeMat = new THREE.MeshPhysicalMaterial({ color: C.lime, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.6 });
  const limeDeepMat = new THREE.MeshPhysicalMaterial({ color: C.limeDeep, roughness: 0.38, clearcoat: 0.8, envMapIntensity: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: C.rubber, roughness: 0.85 });
  const hubMat = new THREE.MeshPhysicalMaterial({ color: C.navy, roughness: 0.3, clearcoat: 0.7 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x0b2350, roughness: 0.5 });

  const bodyGeo = openTop(taperGeometry(new RoundedBoxGeometry(W, H, D, 6, 0.09)));
  const body = new THREE.Mesh(bodyGeo, plastic);
  bin.add(body);

  const inner = new THREE.Mesh(bodyGeo.clone(), plasticInner);
  inner.scale.set(0.93, 0.97, 0.93); inner.position.y = -0.02;
  bin.add(inner);

  // Grime overlay
  const grimeMat = new THREE.MeshStandardMaterial({
    map: grimeTexture(), transparent: true, opacity: 0, roughness: 0.95, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const grime = new THREE.Mesh(bodyGeo, grimeMat);
  grime.scale.setScalar(1.012);
  bin.add(grime);

  // Ribs on the front: two shallow vertical channels for realism
  const ribGeo = new RoundedBoxGeometry(0.06, H * 0.62, 0.03, 2, 0.012);
  [-0.36, 0.36].forEach((x) => {
    const rib = new THREE.Mesh(ribGeo, plastic);
    const yMid = -0.05, zFront = (D / 2) * taper(yMid);
    rib.position.set(x * taper(yMid), yMid, zFront + 0.006);
    rib.rotation.x = Math.atan(((1 - TAPER) * D / 2) / H);
    bin.add(rib);
  });

  // Rim / lip
  const rimShape = roundedRectShape(W + 0.06, D + 0.06, 0.1);
  rimShape.holes.push(roundedRectPath(W * 0.9, D * 0.9, 0.06));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 8 });
  rimGeo.rotateX(-Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeo, plastic);
  rimMesh.position.y = H / 2 - 0.035;
  bin.add(rimMesh);

  // Decal
  const decalTex = decalTexture();
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.74),
    new THREE.MeshPhysicalMaterial({ map: decalTex, transparent: true, roughness: 0.35, clearcoat: 0.5, polygonOffset: true, polygonOffsetFactor: -4 })
  );
  {
    const y = 0.02, z = (D / 2) * taper(y) + 0.012;
    decal.position.set(0, y, z);
    decal.rotation.x = -Math.atan(((1 - TAPER) * D / 2) / H) * -1;
  }
  bin.add(decal);

  // Lid on hinge
  const hinge = new THREE.Group();
  hinge.position.set(0, H / 2 + 0.04, -(D / 2 + 0.05));
  bin.add(hinge);
  const lidGeo = new RoundedBoxGeometry(W + 0.1, 0.075, D + 0.12, 4, 0.03);
  const lid = new THREE.Mesh(lidGeo, limeMat);
  lid.position.set(0, 0.0375, (D + 0.12) / 2);
  hinge.add(lid);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(W * 0.74, 0.03, D * 0.66, 3, 0.012), limeDeepMat);
  panel.position.set(0, 0.075, (D + 0.12) / 2 + 0.02);
  hinge.add(panel);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(W * 0.46, 0.08, 0.06, 2, 0.02), limeMat);
  lip.position.set(0, -0.01, D + 0.12 - 0.01);
  hinge.add(lip);

  // Handle + hinge block
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, W * 0.78, 20), darkPlastic);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, H / 2 - 0.1, -(D / 2 + 0.13));
  bin.add(handle);
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.1, 0.15, 2, 0.02), plastic);
    arm.position.set(s * W * 0.36, H / 2 - 0.09, -(D / 2 + 0.06));
    bin.add(arm);
  });

  // Wheels + axle
  const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.09, 32);
  const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.1, 24);
  const bz = -(D / 2) * TAPER + 0.02, by = -H / 2 + 0.1;
  [-1, 1].forEach((s) => {
    const wgrp = new THREE.Group();
    wgrp.position.set(s * ((W / 2) * TAPER + 0.03), by, bz);
    const wh = new THREE.Mesh(wheelGeo, rubber); wh.rotation.z = Math.PI / 2;
    const hb = new THREE.Mesh(hubGeo, hubMat); hb.rotation.z = Math.PI / 2; hb.position.x = s * 0.006;
    wgrp.add(wh, hb); bin.add(wgrp);
  });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, W * TAPER + 0.1, 12), darkPlastic);
  axle.rotation.z = Math.PI / 2; axle.position.set(0, by, bz); bin.add(axle);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(W * 0.5, 0.06, 0.12, 2, 0.02), darkPlastic);
  foot.position.set(0, -H / 2 - 0.02, (D / 2) * TAPER - 0.1); bin.add(foot);

  bin.position.y = 0.05;
  const washLight = new THREE.PointLight(0xcdeaff, 0, 2.2, 1.5); washLight.position.set(0, H / 2 + 0.1, 0.1); bin.add(washLight);

  // Contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.16;
  root.add(shadow);

  /* ---------- bubbles ---------- */
  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, depthWrite: false,
    iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 560,
    clearcoat: 1, envMapIntensity: 2.2, specularIntensity: 1,
  });
  bubbleMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
       float bf = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.2);
       gl_FragColor.rgb += vec3(0.55, 0.75, 1.0) * bf * 0.35;
       gl_FragColor.a = mix(0.05, 0.92, bf);`
    );
  };
  const bubbleGeo = new THREE.SphereGeometry(1, isSmall ? 20 : 28, isSmall ? 14 : 20);
  const NB = isSmall ? 26 : 40, NBURST = 40;
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, NB + NBURST);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.frustumCulled = false;
  root.add(bubbles);

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const amb = [];
  for (let i = 0; i < NB; i++) {
    const ang = rnd() * Math.PI * 2, rad = 0.85 + rnd() * 0.75;
    amb.push({
      ang, rad, y: -1.2 + rnd() * 2.8, speed: 0.08 + rnd() * 0.18, r: 0.022 + Math.pow(rnd(), 2.6) * 0.12,
      wob: rnd() * 10, orbit: (rnd() - 0.5) * 0.12,
    });
  }
  const burst = [];
  for (let i = 0; i < NBURST; i++) {
    const a = rnd() * Math.PI * 2, el = 0.4 + rnd() * 1.0;
    burst.push({ dir: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), dist: 0.7 + rnd() * 1.4, r: 0.03 + rnd() * 0.1, delay: rnd() * 0.35 });
  }

  /* ---------- water spray ---------- */
  const dot = dotTexture();
  const NS = isSmall ? 420 : 700;
  const sprayGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(NS * 3), sSize = new Float32Array(NS), sAlpha = new Float32Array(NS);
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sprayGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
  sprayGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1));
  const sprayMat = particleMaterial(dot, 0xcfe8ff);
  const spray = new THREE.Points(sprayGeo, sprayMat);
  spray.frustumCulled = false;
  bin.add(spray);
  const sp = Array.from({ length: NS }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1 }));
  let spawnAcc = 0;

  /* ---------- steam ---------- */
  const NT = 48;
  const steamGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(NT * 3), tSize = new Float32Array(NT), tAlpha = new Float32Array(NT);
  steamGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  steamGeo.setAttribute('size', new THREE.BufferAttribute(tSize, 1));
  steamGeo.setAttribute('alpha', new THREE.BufferAttribute(tAlpha, 1));
  const steamMat = particleMaterial(dot, 0xffffff, false);
  const steam = new THREE.Points(steamGeo, steamMat);
  steam.frustumCulled = false;
  bin.add(steam);
  const st = Array.from({ length: NT }, (_, i) => ({ life: i / NT, x: 0, z: 0, drift: 0 }));

  /* ---------- sparkles ---------- */
  const NK = 26;
  const kGeo = new THREE.BufferGeometry();
  const kPos = new Float32Array(NK * 3), kSize = new Float32Array(NK), kAlpha = new Float32Array(NK);
  const kPhase = [];
  for (let i = 0; i < NK; i++) {
    const a = rnd() * Math.PI * 2, r = 0.75 + rnd() * 0.9;
    kPos[i * 3] = Math.cos(a) * r; kPos[i * 3 + 1] = -0.6 + rnd() * 1.9; kPos[i * 3 + 2] = Math.sin(a) * r * 0.6 + 0.3;
    kSize[i] = 0.45 + rnd() * 0.6; kPhase.push(rnd() * 6.28);
  }
  kGeo.setAttribute('position', new THREE.BufferAttribute(kPos, 3));
  kGeo.setAttribute('size', new THREE.BufferAttribute(kSize, 1));
  kGeo.setAttribute('alpha', new THREE.BufferAttribute(kAlpha, 1));
  const starTex = starTexture();
  const kMatW = particleMaterial(starTex, 0xffffff);
  const sparkles = new THREE.Points(kGeo, kMatW);
  sparkles.frustumCulled = false;
  root.add(sparkles);
  const limeStars = new THREE.Points(kGeo.clone(), particleMaterial(starTex, 0xb8e33a));
  limeStars.frustumCulled = false; limeStars.rotation.y = 1.7; limeStars.scale.setScalar(1.15);
  root.add(limeStars);

  [sprayMat, steamMat, kMatW, limeStars.material].forEach((m) => (m.uniforms.pr.value = DPR));

  /* ---------- loop ---------- */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let vw = 1, vh = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    vh = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    vw = vh * camera.aspect;
  }
  addEventListener('resize', resize); resize();

  let prev = performance.now();
  let running = false, t = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame() {
    const now = performance.now(); const dt = Math.min((now - prev) / 1000, 1 / 20); prev = now;
    t += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    // root placement in viewport space
    root.position.set(state.xf * vw, state.yf * vh, 0);
    root.scale.setScalar(state.scale);

    const idle = reduce ? 0 : 1;
    bin.position.y = 0.05 + Math.sin(t * 1.3) * 0.045 * idle;
    bin.rotation.y = state.spin + (Math.sin(t * 0.45) * 0.28 * idle) + mouse.x * 0.32 - 0.45;
    bin.rotation.x = 0.06 + mouse.y * 0.08 + state.tilt;
    bin.rotation.z = Math.sin(t * 0.9) * 0.015 * idle;
    shadow.scale.setScalar(1 - Math.sin(t * 1.3) * 0.04 * idle);

    hinge.rotation.x = -state.lid * 2.08;
    washLight.intensity = state.spray * 9;
    grimeMat.opacity = state.grime;
    plastic.color.setHex(C.blue).lerp(new THREE.Color(0x2b3f5c), state.grime * 0.55);
    limeMat.color.setHex(C.lime).lerp(new THREE.Color(0x6b7a3a), state.grime * 0.5);
    limeKick.intensity = 6 + state.sparkle * 10;

    // ambient bubbles
    let idx = 0;
    for (let i = 0; i < NB; i++) {
      const b = amb[i];
      b.y += b.speed * dt * (1 + state.burst * 1.5) * (reduce ? 0 : 1);
      if (b.y > 1.8) b.y = -1.3;
      b.ang += b.orbit * dt;
      const wob = Math.sin(t * 1.4 + b.wob) * 0.06;
      v.set(Math.cos(b.ang) * b.rad + wob, b.y, Math.sin(b.ang) * b.rad * 0.7 - 0.1);
      const fade = THREE.MathUtils.smoothstep(b.y, -1.3, -0.9) * (1 - THREE.MathUtils.smoothstep(b.y, 1.45, 1.8));
      const s = b.r * fade * state.bubbles;
      sc.set(s, s * (1 + Math.sin(t * 3 + b.wob) * 0.04), s);
      m4.compose(v, q, sc); bubbles.setMatrixAt(idx++, m4);
    }
    // burst bubbles (deterministic on state.burst so scrubbing works both ways)
    for (let i = 0; i < NBURST; i++) {
      const b = burst[i];
      const p = THREE.MathUtils.clamp((state.burst - b.delay) / (1 - b.delay), 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      v.copy(b.dir).multiplyScalar(e * b.dist);
      v.y += H / 2 + 0.1 + e * 0.5 + Math.sin(t * 2 + i) * 0.03 * p;
      const s = b.r * Math.sin(Math.min(p * 1.15, 1) * Math.PI) * (p > 0 ? 1 : 0);
      sc.setScalar(Math.max(s, 0.0001));
      v.y += bin.position.y;
      m4.compose(v, q, sc); bubbles.setMatrixAt(idx++, m4);
    }
    bubbles.instanceMatrix.needsUpdate = true;

    // spray
    const rate = state.spray * (isSmall ? 520 : 900);
    spawnAcc += rate * dt;
    for (let i = 0; i < NS && spawnAcc >= 1; i++) {
      const p = sp[i];
      if (p.alive) continue;
      spawnAcc -= 1;
      const arm = t * 7 + (i % 4) * (Math.PI / 2);
      const spread = 0.25 + Math.random() * 0.55;
      p.alive = true; p.life = 0; p.max = 1.0 + Math.random() * 0.7; p.s = 0.18 + Math.random() * 0.22;
      p.x = Math.cos(arm) * 0.08; p.z = Math.sin(arm) * 0.08; p.y = -0.25;
      p.vx = Math.cos(arm) * spread; p.vz = Math.sin(arm) * spread * 0.85;
      p.vy = 4.1 + Math.random() * 1.3;
    }
    spawnAcc = Math.min(spawnAcc, 50);
    for (let i = 0; i < NS; i++) {
      const p = sp[i];
      if (p.alive) {
        p.life += dt;
        p.vy -= 6.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        // splash back inside walls when below the rim
        if (p.y < H / 2) {
          const lim = (W / 2) * 0.86;
          if (Math.abs(p.x) > lim) { p.vx *= -0.4; p.x = Math.sign(p.x) * lim; }
          if (Math.abs(p.z) > lim) { p.vz *= -0.4; p.z = Math.sign(p.z) * lim; }
        }
        if (p.life > p.max || p.y < -0.55) p.alive = false;
      }
      sPos[i * 3] = p.x; sPos[i * 3 + 1] = p.y; sPos[i * 3 + 2] = p.z;
      sSize[i] = p.alive ? p.s : 0;
      sAlpha[i] = p.alive ? (1 - p.life / p.max) * 0.85 : 0;
    }
    sprayGeo.attributes.position.needsUpdate = true;
    sprayGeo.attributes.size.needsUpdate = true;
    sprayGeo.attributes.alpha.needsUpdate = true;

    // steam
    for (let i = 0; i < NT; i++) {
      const s = st[i];
      s.life += dt * 0.42;
      if (s.life > 1) { s.life = 0; s.x = (Math.random() - 0.5) * 0.8; s.z = (Math.random() - 0.5) * 0.6; s.drift = (Math.random() - 0.5) * 1.1; }
      tPos[i * 3] = s.x + s.drift * s.life; tPos[i * 3 + 1] = H / 2 + 0.1 + s.life * 1.2; tPos[i * 3 + 2] = s.z + 0.25 + s.life * 0.3;
      tSize[i] = 1.4 + s.life * 3.2;
      tAlpha[i] = Math.sin(s.life * Math.PI) * 0.2 * state.steam;
    }
    steamGeo.attributes.position.needsUpdate = true;
    steamGeo.attributes.size.needsUpdate = true;
    steamGeo.attributes.alpha.needsUpdate = true;

    // sparkles
    const kA = kGeo.attributes.alpha.array, kA2 = limeStars.geometry.attributes.alpha.array;
    for (let i = 0; i < NK; i++) {
      const tw = Math.pow(Math.max(0, Math.sin(t * 2.2 + kPhase[i])), 6);
      kA[i] = tw * state.sparkle;
      kA2[i] = Math.pow(Math.max(0, Math.sin(t * 1.7 + kPhase[i] * 1.3)), 6) * state.sparkle;
    }
    kGeo.attributes.alpha.needsUpdate = true;
    limeStars.geometry.attributes.alpha.needsUpdate = true;
    sparkles.rotation.y = t * 0.08; limeStars.rotation.y = 1.7 - t * 0.06;

    camera.position.z = 6.4 * state.zoom;
    renderer.render(scene, camera);
  }

  function loop() { if (!running) return; frame(); requestAnimationFrame(loop); }
  // Compile + first frame before revealing
  renderer.compile(scene, camera);
  frame();

  return {
    start() { if (running) return; running = true; prev = performance.now(); requestAnimationFrame(loop); },
    stop() { running = false; },
    resize,
  };
}
