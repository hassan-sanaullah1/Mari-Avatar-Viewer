/**
 * A .glb viewer that stands your model in the Mari kiosk's studio.
 *
 * The camera rig, the six lights and the reflection panels are the kiosk's own
 * (see ./tuning.js, copied from the kiosk's tuning.ts), so a face that reads
 * badly here reads badly on the kiosk. There is no speech, no lipsync and no
 * backend — the model's own animation clips are the only thing that moves.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyKioskMaterials } from "./materials.js";
import {
  CAMERA,
  DARK_LIGHTING,
  ENVIRONMENT,
  LIGHT_COLORS,
  LIGHT_PLACEMENT,
  LIGHT_STATES,
  PRESENTERS,
} from "./tuning.js";

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// RENDERER AND SCENE
// ---------------------------------------------------------------------------

const screen = $("screen");
const frame = $("frame");
// Transparent, like the kiosk's: its artwork is a real <img> behind the canvas
// (here a CSS background on #bg), and the scene draws only the presenter.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
frame.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);

/**
 * The reflection panels, baked once into an environment map.
 *
 * The kiosk builds these with drei's <Environment> over three <Lightformer>
 * panels and no `background`, so they only ever show up as reflections in skin
 * and cloth. This is the same thing by hand, down to how drei does it: a
 * Lightformer is a 1×1 plane with an unlit double-sided material whose colour is
 * multiplied by its intensity, turned to face the origin; <Environment> renders
 * them once through a CubeCamera into a half-float cube target and hands that to
 * `scene.environment`, where three's own PMREM pass picks it up.
 *
 * Rendering it through PMREMGenerator directly instead gave a visibly different
 * rig, so this follows drei exactly rather than taking the shorter route.
 */
function buildEnvironment() {
  const panels = new THREE.Scene();
  for (const panel of ENVIRONMENT.lightformers) {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    material.color.set(panel.color).multiplyScalar(panel.intensity);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    plane.position.set(...panel.position);
    plane.scale.set(panel.scale[0], panel.scale[1], 1);
    plane.lookAt(0, 0, 0);
    panels.add(plane);
  }
  const target = new THREE.WebGLCubeRenderTarget(ENVIRONMENT.resolution);
  target.texture.type = THREE.HalfFloatType;
  const cubeCamera = new THREE.CubeCamera(0.1, 1000, target);
  const autoClear = renderer.autoClear;
  renderer.autoClear = true;
  cubeCamera.update(renderer, panels);
  renderer.autoClear = autoClear;
  return target.texture;
}
scene.environment = buildEnvironment();

// ---------------------------------------------------------------------------
// THE LIGHT RIG — the kiosk's, light for light
// ---------------------------------------------------------------------------

const lights = {
  ambient: new THREE.AmbientLight(0xffffff, DARK_LIGHTING.ambient),
  key: new THREE.DirectionalLight(LIGHT_COLORS.key, LIGHT_PLACEMENT.key.intensity),
  fill: new THREE.DirectionalLight(LIGHT_COLORS.fill, LIGHT_PLACEMENT.fill.intensity),
  top: new THREE.SpotLight(LIGHT_COLORS.top),
  rim: new THREE.SpotLight(LIGHT_COLORS.rim),
  kick: new THREE.SpotLight(LIGHT_COLORS.kick),
  face: new THREE.SpotLight(LIGHT_COLORS.face),
};
for (const [name, light] of Object.entries(lights)) {
  const placement = LIGHT_PLACEMENT[name];
  if (placement) {
    light.position.set(...placement.position);
    if (placement.angle !== undefined) light.angle = placement.angle;
    if (placement.penumbra !== undefined) light.penumbra = placement.penumbra;
    if (placement.distance !== undefined) light.distance = placement.distance;
    if (placement.decay !== undefined) light.decay = placement.decay;
    light.intensity = placement.intensity;
  }
  scene.add(light);
  // A spotLight's target is a bare Object3D outside the scene graph, so it has
  // to be added before its matrix means anything.
  if (light.isSpotLight) scene.add(light.target);
}

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

const ui = {
  presenter: "female",
  theme: "dark",
  lightState: "idle",
  sway: true,
  orbit: false,
  materialFix: true,
  wireframe: false,
  speed: 1,
};

/** The loaded rig: its scene, its clips and what we measured off it. */
let model = null;
let mixer = null;
let action = null;
let objectUrl = null;
let playing = true;
let scrubbing = false;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

/**
 * Frame timing. Hand-rolled rather than THREE.Clock, which three 0.183
 * deprecates, and the mixer only ever wants a delta in seconds.
 */
const time = { last: performance.now() / 1000, elapsed: 0, delta: 0 };
function advanceTime() {
  const now = performance.now() / 1000;
  // Clamped so a backgrounded tab does not hand the mixer a ten-second step.
  time.delta = Math.min(now - time.last, 0.1);
  time.last = now;
  time.elapsed += time.delta;
}

function presenter() {
  return PRESENTERS[ui.presenter];
}
/** The active rig's tuning, under the name the material pass uses for it. */
const config = presenter;
function lighting() {
  const rig = presenter();
  return ui.theme === "light" ? rig.lightThemeLighting : rig.darkThemeLighting;
}
function modelHeight() {
  return model?.height ?? presenter().fallbackHeight;
}

// ---------------------------------------------------------------------------
// FRAMING — the kiosk's, driven by the canvas box rather than the window
// ---------------------------------------------------------------------------

let centerY = 1.26;

/**
 * The window IS the kiosk screen, so there is nothing to size here: the kiosk's
 * own CSS (copied into index.html, including its 6:5 portrait switch) decides
 * how big the presenter's box is, and the renderer just follows that box. The
 * framing below then sees the same shape of canvas the kiosk's framing sees.
 */
function resize() {
  renderer.setSize(frame.clientWidth, frame.clientHeight, false);
  applyFraming();
}

/**
 * Top of the frame just above the head, and a fixed slice of the RIG — not of
 * the world — filling the canvas height, so the model reads at the same size
 * whatever shape the stage is.
 */
function applyFraming() {
  const rig = presenter();
  const size = new THREE.Vector2();
  renderer.getSize(size);
  if (size.x <= 0 || size.y <= 0) return;

  const topY = modelHeight() * (1 + CAMERA.headRoom);
  // Never frame more than the whole rig — past the feet there is only empty
  // floor to show.
  const frameHeight = Math.min(CAMERA.frameHeightM, topY);
  centerY = topY - frameHeight / 2;

  // three's film gauge applies to the larger side of the frame, which is
  // Blender's Sensor Fit: Auto — so this fov matches Blender's for the same
  // lens on the same shape of frame.
  camera.aspect = size.x / size.y;
  camera.filmGauge = CAMERA.sensorMm;
  camera.setFocalLength(rig.lensMm);
  const distance =
    rig.cameraDistanceM ??
    frameHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // The squeeze: claiming a wider frame than the canvas really is fits more
  // world into the same pixels across, so everything draws narrower.
  camera.aspect = size.x / size.y / rig.widthSqueeze;
  camera.position.set(0, centerY, distance);
  camera.lookAt(0, centerY, 0);
  camera.updateProjectionMatrix();

  controls.target.set(0, centerY, 0);
  controls.update();

  lights.face.target.position.set(0, rig.headTargetY, 0);
  lights.face.target.updateMatrixWorld();
}

function applyLighting() {
  const rig = presenter();
  const theme = lighting();
  const state = LIGHT_STATES[ui.lightState];
  lights.key.intensity = state.key;
  lights.fill.intensity = state.fill * theme.fill;
  lights.rim.intensity = state.rim * rig.backLight.rim;
  lights.kick.intensity = state.kick * rig.backLight.kick;
  lights.top.intensity = state.top;
  lights.ambient.intensity = theme.ambient;
  renderer.toneMappingExposure = theme.exposure;
  scene.environmentIntensity = theme.environment;
  // The backdrop is artwork, not a clear colour. The kiosk picks one image per
  // theme and viewport off `data-theme` on the root element and a media query,
  // so setting the same attribute here runs the same rules.
  document.documentElement.dataset.theme = ui.theme;
}

// ---------------------------------------------------------------------------
// LOADING
// ---------------------------------------------------------------------------

const draco = new DRACOLoader().setDecoderPath("./vendor/examples/jsm/libs/draco/gltf/");
const ktx2 = new KTX2Loader().setTranscoderPath("./vendor/examples/jsm/libs/basis/");
const loader = new GLTFLoader()
  .setDRACOLoader(draco)
  .setKTX2Loader(ktx2.detectSupport(renderer))
  .setMeshoptDecoder(MeshoptDecoder);

function disposeModel() {
  if (!model) return;
  scene.remove(model.scene);
  model.scene.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    for (const material of [].concat(child.material)) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
  mixer?.stopAllAction();
  mixer = null;
  action = null;
  model = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

async function loadFile(file) {
  $("filename").textContent = `Loading ${file.name}…`;
  disposeModel();
  objectUrl = URL.createObjectURL(file);
  let gltf;
  try {
    gltf = await loader.loadAsync(objectUrl);
  } catch (error) {
    $("filename").textContent = `Could not load ${file.name}: ${error.message ?? error}`;
    console.error(error);
    return;
  }

  const box = new THREE.Box3().setFromObject(gltf.scene);
  model = {
    scene: gltf.scene,
    animations: gltf.animations,
    // The kiosk frames on Box3.max.y, so measure it the same way — including
    // that it ignores where the feet are.
    height: box.max.y,
    box,
    name: file.name,
    sizeMb: file.size / 1e6,
    extensions: gltf.parser?.json?.extensionsUsed ?? [],
  };
  scene.add(gltf.scene);

  applyMaterialPass();
  applyWireframe();
  applyFraming();

  mixer = new THREE.AnimationMixer(gltf.scene);
  buildClipList(gltf.animations);
  report();
  $("filename").textContent = `${file.name} — ${model.sizeMb.toFixed(1)} MB`;
  $("drop").classList.add("hidden");
  console.log(
    `[viewer] ${file.name}: height ${model.height.toFixed(3)}m, ` +
      `${gltf.animations.length} clip(s): ${gltf.animations.map((c) => c.name).join(", ")}`,
  );
}

/**
 * The kiosk's material pass over the loaded rig — see ./materials.js.
 *
 * Keyed by material name, exactly as the kiosk keys it, so an export that keeps
 * the shipped rigs' material names is treated exactly as the kiosk treats them
 * and one that renames them is not. What matched is kept for the Checks panel.
 */
function applyMaterialPass() {
  if (!model) return;
  model.materials = applyKioskMaterials(model.scene, {
    config: presenter(),
    renderer,
    enabled: ui.materialFix,
  });
}

function applyWireframe() {
  model?.scene.traverse((child) => {
    if (!child.isMesh) return;
    for (const material of [].concat(child.material)) material.wireframe = ui.wireframe;
  });
}

// ---------------------------------------------------------------------------
// ANIMATION
// ---------------------------------------------------------------------------

function buildClipList(animations) {
  const select = $("clip");
  select.innerHTML = "";
  const has = animations.length > 0;
  for (const [i, clip] of animations.entries()) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${clip.name || `clip ${i}`} — ${clip.duration.toFixed(2)}s`;
    select.appendChild(option);
  }
  if (!has) {
    const option = document.createElement("option");
    option.textContent = "no clips in this file";
    select.appendChild(option);
  }
  select.disabled = !has;
  $("play").disabled = !has;
  $("rewind").disabled = !has;
  $("scrub").disabled = !has;
  if (has) playClip(0);
}

function playClip(index) {
  if (!mixer || !model?.animations[index]) return;
  action?.stop();
  action = mixer.clipAction(model.animations[index]);
  action.reset();
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.timeScale = ui.speed;
  action.play();
  playing = true;
  $("play").textContent = "Pause";
  // One update at 0 so the first painted frame is the posed rig rather than
  // whatever bind pose the file was exported in.
  mixer.update(0);
}

// ---------------------------------------------------------------------------
// WHAT LOADED, AND WHAT LOOKS WRONG
// ---------------------------------------------------------------------------

/** The ARKit shape the kiosk's lipsync drives — present means the rig can speak. */
const ARKIT_PROBE = "jawOpen";

function report() {
  if (!model) return;
  let triangles = 0;
  let meshes = 0;
  let morphTargets = 0;
  let skinned = 0;
  let hasArkit = false;
  const materials = new Set();
  const textures = new Set();
  const flatMaterials = [];
  const hotSpecular = [];
  let transparentCards = 0;
  let maxTexture = 0;

  model.scene.traverse((child) => {
    if (child.isBone) return;
    if (!child.isMesh) return;
    meshes += 1;
    if (child.isSkinnedMesh) skinned += 1;
    const index = child.geometry.index;
    triangles += (index ? index.count : child.geometry.attributes.position?.count ?? 0) / 3;
    if (child.morphTargetDictionary) {
      const names = Object.keys(child.morphTargetDictionary);
      morphTargets += names.length;
      if (names.some((n) => n.toLowerCase() === ARKIT_PROBE.toLowerCase())) hasArkit = true;
    }
    for (const material of [].concat(child.material)) {
      if (materials.has(material)) continue;
      materials.add(material);
      if (material.transparent) transparentCards += 1;
      // glTF defaults a missing roughnessFactor to 1.0 — fully matte, which
      // returns no specular, and the cyan rim and green kick read as coloured
      // edges on cloth mostly through that specular term.
      if (material.isMeshStandardMaterial && material.roughness === 1) {
        flatMaterials.push(material.name || "(unnamed)");
      }
      if (material.specularColor && material.specularColor.r > 1) {
        hotSpecular.push(material.name || "(unnamed)");
      }
      for (const value of Object.values(material)) {
        if (value && value.isTexture && value.image) {
          textures.add(value);
          maxTexture = Math.max(maxTexture, value.image.width ?? 0, value.image.height ?? 0);
        }
      }
    }
  });

  const size = new THREE.Vector3();
  model.box.getSize(size);
  const stats = {
    "File size": `${model.sizeMb.toFixed(1)} MB`,
    "Height (max Y)": `${model.height.toFixed(3)} m`,
    "Feet at Y": `${model.box.min.y.toFixed(3)} m`,
    "Width × depth": `${size.x.toFixed(2)} × ${size.z.toFixed(2)} m`,
    Meshes: `${meshes} (${skinned} skinned)`,
    Triangles: Math.round(triangles).toLocaleString(),
    Materials: materials.size,
    Textures: `${textures.size}, max ${maxTexture}px`,
    "Morph targets": morphTargets,
    Clips: model.animations.length,
    Extensions: model.extensions.length ? model.extensions.join(", ") : "none",
  };
  $("stats").innerHTML = Object.entries(stats)
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");

  const rig = presenter();
  const checks = [];
  const push = (warn, text) => checks.push({ warn, text });

  const drift = model.height - rig.fallbackHeight;
  push(
    Math.abs(drift) > 0.15,
    `Height ${model.height.toFixed(2)}m against the ${ui.presenter} rig's ${rig.fallbackHeight}m` +
      (Math.abs(drift) > 0.15 ? ` — ${drift > 0 ? "taller" : "shorter"} by ${Math.abs(drift).toFixed(2)}m, so the head sits off the framing` : ""),
  );
  push(
    Math.abs(model.box.min.y) > 0.05,
    Math.abs(model.box.min.y) > 0.05
      ? `Feet are ${model.box.min.y.toFixed(2)}m off the floor — export with the feet at Z=0 in Blender`
      : "Feet sit on the floor",
  );
  const offCentre = Math.max(Math.abs(model.box.min.x + model.box.max.x) / 2, Math.abs(model.box.min.z + model.box.max.z) / 2);
  push(
    offCentre > 0.1,
    offCentre > 0.1
      ? `Off centre by ${offCentre.toFixed(2)}m — the camera always looks at X=0, Z=0`
      : "Centred on the camera axis",
  );
  push(!model.animations.length, model.animations.length ? `${model.animations.length} animation clip(s)` : "No animation clips in the file");
  push(
    !hasArkit,
    hasArkit
      ? "Carries the ARKit face shapes, so kiosk lipsync will work"
      : `No "${ARKIT_PROBE}" morph target — lipsync has nothing to drive (fine if this rig is not meant to speak)`,
  );
  if (flatMaterials.length) {
    push(
      true,
      `Roughness 1.0 (no roughnessFactor exported) on ${flatMaterials.length}: ${flatMaterials.slice(0, 4).join(", ")}` +
        (flatMaterials.length > 4 ? "…" : "") +
        " — fully matte, so the cyan rim and green kick stop reading as edges on cloth",
    );
  }
  if (hotSpecular.length) {
    push(true, `Specular above 1.0 on ${hotSpecular.join(", ")} — reflects more light than arrives, which reads as a hot sheen`);
  }
  if (maxTexture > 2048) {
    push(true, `A ${maxTexture}px texture — the kiosk draws the head about 110px tall, so 2048 is already generous`);
  }
  // What the kiosk's own material pass found in this file. A rig it cannot
  // match is not broken, but it will not get the kiosk's skin lift or tints,
  // which is the single most useful thing to know before sending a file over.
  const matched = model.materials;
  if (matched) {
    const skin = matched.skin;
    if (skin.matched.length) {
      push(
        skin.missing.length > 0,
        `Kiosk skin lift applies to ${skin.matched.join(", ")}` +
          (skin.missing.length ? ` — but not to ${skin.missing.join(", ")}, which this file does not have` : ""),
      );
    } else {
      push(
        true,
        `None of the ${ui.presenter} rig's skin materials (${config().skinMaterials.join(", ")}) are in this file — ` +
          "the kiosk brightens skin by material name, so renaming them loses that lift",
      );
    }
    if (matched.face.name) {
      push(
        !matched.face.matched,
        matched.face.matched
          ? `Makeup toning applies to ${matched.face.name}`
          : `No "${matched.face.name}" material — the kiosk's makeup toning will not apply`,
      );
    }
    if (matched.tint.missing.length) {
      push(true, `Kiosk albedo tints expect ${matched.tint.missing.join(", ")}, which this file does not have`);
    }
    push(false, `${matched.transparent} transparent material(s) — the alpha-card cut applies to these`);
  }
  if (model.sizeMb > 25) {
    push(true, `${model.sizeMb.toFixed(0)} MB is a slow first load — the kiosk gzips and strips unused keyframes, but smaller is better`);
  }

  $("checks").innerHTML = checks
    .map((c) => `<li class="${c.warn ? "warn" : ""}">${c.text}</li>`)
    .join("");
}

// ---------------------------------------------------------------------------
// WIRING
// ---------------------------------------------------------------------------

$("upload").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) loadFile(file);
});

for (const type of ["dragenter", "dragover"]) {
  screen.addEventListener(type, (event) => {
    event.preventDefault();
    screen.classList.add("dragover");
  });
}
for (const type of ["dragleave", "drop"]) {
  screen.addEventListener(type, (event) => {
    event.preventDefault();
    screen.classList.remove("dragover");
  });
}
screen.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

/**
 * Switching rig is not one setting changing value: the camera distance, the
 * lens, the width squeeze, the back lights, the theme lighting and the material
 * corrections are all per-rig, so all of them are re-applied here.
 */
function setPresenter(id) {
  ui.presenter = id;
  $("presenterFemale").classList.toggle("is-on", id === "female");
  $("presenterMale").classList.toggle("is-on", id === "male");
  applyLighting();
  applyFraming();
  // Keyed to the chosen rig's material names, so the other rig's corrections
  // have to come off and this one's go on.
  applyMaterialPass();
  report();
}
$("presenterFemale").addEventListener("click", () => setPresenter("female"));
$("presenterMale").addEventListener("click", () => setPresenter("male"));
$("theme").addEventListener("change", (event) => {
  ui.theme = event.target.value;
  applyLighting();
});
$("lightState").addEventListener("change", (event) => {
  ui.lightState = event.target.value;
  applyLighting();
});
$("clip").addEventListener("change", (event) => playClip(Number(event.target.value)));
$("play").addEventListener("click", () => {
  if (!action) return;
  playing = !playing;
  action.paused = !playing;
  $("play").textContent = playing ? "Pause" : "Play";
});
$("rewind").addEventListener("click", () => {
  if (!action) return;
  action.time = 0;
  mixer.update(0);
});
$("speed").addEventListener("input", (event) => {
  ui.speed = Number(event.target.value);
  $("speedLabel").textContent = `${ui.speed.toFixed(2)}×`;
  if (action) action.timeScale = ui.speed;
});
const scrub = $("scrub");
scrub.addEventListener("pointerdown", () => {
  scrubbing = true;
});
window.addEventListener("pointerup", () => {
  scrubbing = false;
});
scrub.addEventListener("input", (event) => {
  if (!action) return;
  action.paused = true;
  playing = false;
  $("play").textContent = "Play";
  action.time = Number(event.target.value) * action.getClip().duration;
  mixer.update(0);
});

$("orbit").addEventListener("change", (event) => {
  ui.orbit = event.target.checked;
  controls.enabled = ui.orbit;
  if (!ui.orbit) applyFraming();
});
$("matfix").addEventListener("change", (event) => {
  ui.materialFix = event.target.checked;
  applyMaterialPass();
});
$("sway").addEventListener("change", (event) => {
  ui.sway = event.target.checked;
  if (!ui.sway) applyFraming();
});
$("wire").addEventListener("change", (event) => {
  ui.wireframe = event.target.checked;
  applyWireframe();
});
$("reset").addEventListener("click", () => {
  $("orbit").checked = false;
  ui.orbit = false;
  controls.enabled = false;
  applyFraming();
});

window.addEventListener("resize", resize);
// dvh and the 6:5 switch both move when a phone's address bar slides away or a
// window crosses the aspect boundary, and neither fires a plain resize reliably.
new ResizeObserver(resize).observe(frame);

function setPanel(visible) {
  document.body.classList.toggle("panel-hidden", !visible);
}
$("hidePanel").addEventListener("click", () => setPanel(false));
$("panelToggle").addEventListener("click", () => setPanel(true));
window.addEventListener("keydown", (event) => {
  if (event.key === "h" || event.key === "H") {
    if (event.target instanceof HTMLInputElement) return;
    setPanel(document.body.classList.contains("panel-hidden"));
  }
});

// ---------------------------------------------------------------------------
// THE LOOP
// ---------------------------------------------------------------------------

function tick() {
  advanceTime();
  if (mixer && playing) mixer.update(time.delta);

  if (ui.orbit) {
    controls.update();
  } else if (ui.sway) {
    // The kiosk's very slow sway, which keeps the shot from reading as a still
    // image — a couple of pixels of parallax at this framing.
    camera.position.x =
      Math.sin(time.elapsed * CAMERA.sway.speed) * CAMERA.sway.amplitude;
    camera.lookAt(0, centerY, 0);
  }

  if (action && !scrubbing) {
    const duration = action.getClip().duration;
    if (duration > 0) scrub.value = String((action.time % duration) / duration);
  }

  renderer.render(scene, camera);
  const size = new THREE.Vector2();
  renderer.getSize(size);
  $("hud").textContent =
    `${ui.presenter} · ${presenter().lensMm}mm · ${camera.position.z.toFixed(2)}m · ` +
    `${size.x}×${size.y}` +
    (action ? ` · ${action.time.toFixed(2)}s` : "");
  requestAnimationFrame(tick);
}

applyLighting();
resize();
tick();
