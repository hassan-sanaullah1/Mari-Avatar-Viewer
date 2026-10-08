/**
 * Regenerates src/kiosk-tuning.generated.js from the kiosk's own tuning.ts.
 *
 * The viewer only means anything if its studio is the kiosk's studio, and a
 * hand-copy drifts the moment someone retunes the kiosk (it did: the camera's
 * frame height moved from 1.15 to 1.45 within an hour of this viewer being
 * written, and the viewer went on drawing the presenter too large). So the
 * numbers are not maintained here — they are read out of the kiosk.
 *
 *   node sync-tuning.mjs [path/to/frontend/components/avatar/tuning.ts]
 *
 * It works by turning that file into plain JavaScript — the exports it needs
 * are literal data, no logic — importing it, and writing the values out. Every
 * key it expects is checked, so a rename in the kiosk fails here loudly rather
 * than leaving the viewer quietly lying.
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(
  process.argv[2] ??
    join(here, "..", "Mari-Interactive-Kiosk-main", "frontend", "components", "avatar", "tuning.ts"),
);
const target = join(here, "src", "kiosk-tuning.generated.js");

/**
 * The per-rig fields the viewer uses: the framing and light half, and the
 * material half that AvatarModel applies by material name. The only thing left
 * behind is `a2f`, which is lipsync calibration and has nothing to drive here.
 */
const RIG_FIELDS = [
  "fallbackHeight",
  "headTargetY",
  "widthSqueeze",
  "lensMm",
  "cameraDistanceM",
  "backLight",
  "lightThemeLighting",
  "darkThemeLighting",
  "skinMaterials",
  "skinEmissive",
  "skinRoughness",
  "materialTint",
  "faceMaterial",
  "alphaTest",
  "materialRoughness",
  "materialSpecular",
];

/**
 * The makeup pass's constants, which live in AvatarModel.tsx rather than in
 * tuning.ts because they describe the pass, not a rig. Lifted by name so they
 * cannot drift either — a rename fails the sync.
 */
const MODEL_CONSTANTS = [
  "MAKEUP_DESATURATION",
  "MAKEUP_MAX_HUE_DEG",
  "MAKEUP_MIN_SATURATION",
];

function readModelConstants(path) {
  const code = readFileSync(path, "utf8");
  const out = {};
  for (const name of MODEL_CONSTANTS) {
    const match = code.match(new RegExp(`const ${name}\\s*=\\s*([0-9.]+)\\s*;`));
    if (!match) throw new Error(`${path} no longer defines ${name}`);
    out[name] = Number(match[1]);
  }
  const box = code.match(/const FACE_UV_BOX\s*=\s*(\{[^}]*\})\s*;/);
  if (!box) throw new Error(`${path} no longer defines FACE_UV_BOX`);
  out.FACE_UV_BOX = JSON.parse(box[1].replace(/([a-z0-9]+):/gi, '"$1":').replace(/,\s*\}/, "}"));
  return out;
}

function toJavaScript(typescript) {
  let code = typescript;
  // Type-only imports and aliases have no runtime meaning.
  code = code.replace(/^\s*import\s+type\s[^;]+;$/gm, "");
  code = code.replace(/^\s*type\s+\w+\s*=[^;]+;$/gm, "");
  // `export interface X { ... }` — brace-matched, because these contain braces.
  code = stripBlocks(code, /export\s+interface\s+\w+\s*\{/g);
  // Annotations on the exported constants, and the `as Vec3` casts inside them.
  code = code.replace(/export\s+const\s+(\w+)\s*:\s*[^=]+=/g, "export const $1 =");
  code = code.replace(/\s+as\s+(Vec3|const)\b/g, "");
  return code;
}

/** Removes each `<header>{ ... }` block, matching braces so nested ones survive. */
function stripBlocks(code, header) {
  let out = code;
  for (;;) {
    header.lastIndex = 0;
    const match = header.exec(out);
    if (!match) return out;
    let depth = 0;
    let i = match.index + match[0].length - 1;
    for (; i < out.length; i += 1) {
      if (out[i] === "{") depth += 1;
      else if (out[i] === "}" && (depth -= 1) === 0) break;
    }
    out = out.slice(0, match.index) + out.slice(i + 1);
  }
}

function demand(value, what) {
  if (value === undefined) throw new Error(`${source} no longer exports ${what}`);
  return value;
}

function numbers(object, keys, what) {
  for (const key of keys) {
    if (typeof object?.[key] !== "number") {
      throw new Error(`${what}.${key} is ${object?.[key]}, expected a number`);
    }
  }
  return object;
}

const temp = join(mkdtempSync(join(tmpdir(), "mari-tuning-")), "tuning.mjs");
writeFileSync(temp, toJavaScript(readFileSync(source, "utf8")));
const kiosk = await import(pathToFileURL(temp).href);

const CAMERA = numbers(demand(kiosk.CAMERA, "CAMERA"), ["frameHeightM", "headRoom", "lensMm", "sensorMm"], "CAMERA");
numbers(CAMERA.sway, ["amplitude", "speed"], "CAMERA.sway");
const LIGHT_COLORS = demand(kiosk.LIGHT_COLORS, "LIGHT_COLORS");
const LIGHT_PLACEMENT = demand(kiosk.LIGHT_PLACEMENT, "LIGHT_PLACEMENT");
const LIGHT_STATES = demand(kiosk.LIGHT_STATES, "LIGHT_STATES");
const ENVIRONMENT = demand(kiosk.ENVIRONMENT, "ENVIRONMENT");
const DARK_LIGHTING = demand(kiosk.DARK_LIGHTING, "DARK_LIGHTING");
const RIG_TUNING = demand(kiosk.RIG_TUNING, "RIG_TUNING");

for (const name of ["key", "fill", "top", "rim", "kick", "face"]) {
  if (!LIGHT_PLACEMENT[name]) throw new Error(`LIGHT_PLACEMENT.${name} is gone`);
  if (!LIGHT_COLORS[name]) throw new Error(`LIGHT_COLORS.${name} is gone`);
}

const makeup = readModelConstants(join(dirname(source), "AvatarModel.tsx"));

const presenters = {};
for (const [id, rig] of Object.entries(RIG_TUNING)) {
  const picked = {};
  for (const field of RIG_FIELDS) {
    if (!(field in rig)) throw new Error(`RIG_TUNING.${id}.${field} is gone`);
    picked[field] = rig[field];
  }
  numbers(picked, ["fallbackHeight", "headTargetY", "widthSqueeze", "lensMm", "skinEmissive"], `RIG_TUNING.${id}`);
  // A Set does not survive JSON; the viewer reads it back as an array.
  picked.skinMaterials = [...picked.skinMaterials];
  presenters[id] = picked;
}

const json = (value) => JSON.stringify(value, null, 2).replace(/\n/g, "\n");
const generated = `// GENERATED — do not edit. Run \`node sync-tuning.mjs\` to refresh.
//
// Every value below is read straight out of the kiosk's
// frontend/components/avatar/tuning.ts, which is the only place they are
// maintained. See ../sync-tuning.mjs, and src/tuning.js for what they mean.
//
// Source: ${source}
// Synced: ${new Date().toISOString().slice(0, 10)}

export const CAMERA = ${json(CAMERA)};

export const LIGHT_COLORS = ${json(LIGHT_COLORS)};

export const LIGHT_PLACEMENT = ${json(LIGHT_PLACEMENT)};

export const LIGHT_STATES = ${json(LIGHT_STATES)};

export const ENVIRONMENT = ${json(ENVIRONMENT)};

export const DARK_LIGHTING = ${json(DARK_LIGHTING)};

export const RIG_TUNING = ${json(presenters)};

export const MAKEUP = ${json(makeup)};
`;

const before = (() => {
  try {
    return readFileSync(target, "utf8");
  } catch {
    return "";
  }
})();
writeFileSync(target, generated);

const strip = (text) => text.replace(/^\/\/ Synced:.*$/m, "");
if (strip(before) === strip(generated)) {
  console.log("Already in sync with", source);
} else {
  console.log("Updated", target, "from", source);
  console.log(`  frame height ${CAMERA.frameHeightM}m, head room ${CAMERA.headRoom}`);
  for (const [id, rig] of Object.entries(presenters)) {
    console.log(
      `  ${id}: ${rig.lensMm}mm, ` +
        `${rig.cameraDistanceM === null ? "distance from lens" : `${rig.cameraDistanceM}m`}, ` +
        `rig height ${rig.fallbackHeight}m`,
    );
  }
  console.log("Reload the viewer in the browser to pick it up.");
}
