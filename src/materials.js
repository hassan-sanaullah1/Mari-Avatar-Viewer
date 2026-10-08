/**
 * The kiosk's material pass, applied by material name.
 *
 * This is AvatarModel.tsx's material effect, ported. It is keyed to the names
 * inside the two shipped rigs — the skin materials get an emissive lift, the
 * male rig's garment gets its albedo scaled down, its hair gets its specular
 * capped, and the female rig's face texture gets its makeup toned — so on an
 * export that renamed its materials, parts of it simply find nothing. That is
 * worth knowing rather than hiding, so the pass reports what it matched and the
 * viewer shows it in the Checks panel.
 *
 * Everything it changes is snapshotted first, so the viewer can switch the pass
 * off and show the materials exactly as authored. The kiosk disposes the
 * original face texture once it has toned it; this keeps it, because that
 * toggle has to be able to put it back.
 */

import * as THREE from "three";
import { MAKEUP } from "./kiosk-tuning.generated.js";

/** Hue in degrees and saturation, from 0-255 RGB. Value is not needed. */
function hueSaturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return [0, 0];

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;

  return [hue, max === 0 ? 0 : delta / max];
}

/**
 * Tones the painted-on makeup, returning a new texture.
 *
 * The makeup separates from skin by HUE, not by saturation: of the chromatic
 * pixels on the face sheet 86% sit at hue 20-30°, the orange-tan skin base, and
 * the makeup is the red/pink tail below 20°. Keying on that tail hits the lips
 * and cheeks and almost nothing else. The UV box excludes the garment and hair
 * blocks parked in the corners of the same sheet, which are also deep red.
 */
function desaturateMakeup(source, amount) {
  const image = source.image;
  if (!image || !image.width || !image.height) return null;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.data;
  const box = MAKEUP.FACE_UV_BOX;

  for (let i = 0; i < pixels.length; i += 4) {
    const pixel = i / 4;
    const u = (pixel % canvas.width) / canvas.width;
    const v = Math.floor(pixel / canvas.width) / canvas.height;
    if (u < box.x0 || u > box.x1) continue;
    if (v < box.y0 || v > box.y1) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const [hue, saturation] = hueSaturation(r, g, b);
    if (hue >= MAKEUP.MAKEUP_MAX_HUE_DEG || saturation <= MAKEUP.MAKEUP_MIN_SATURATION) continue;

    const redness =
      Math.min(1, (MAKEUP.MAKEUP_MAX_HUE_DEG - hue) / MAKEUP.MAKEUP_MAX_HUE_DEG) *
      Math.min(1, (saturation - MAKEUP.MAKEUP_MIN_SATURATION) / 0.15);
    const keep = 1 - amount * redness;

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    pixels[i] = luma + (r - luma) * keep;
    pixels[i + 1] = luma + (g - luma) * keep;
    pixels[i + 2] = luma + (b - luma) * keep;
  }
  context.putImageData(data, 0, 0);

  const result = new THREE.CanvasTexture(canvas);
  // Copied off the original: the glTF loader has already set the flipY and
  // colour space the UVs were authored against, and a fresh CanvasTexture
  // defaults differently on both counts.
  result.flipY = source.flipY;
  result.colorSpace = source.colorSpace;
  result.wrapS = source.wrapS;
  result.wrapT = source.wrapT;
  result.channel = source.channel;
  result.needsUpdate = true;
  return result;
}

/** Everything the pass touches, remembered the first time it sees a material. */
function snapshot(material) {
  if (material.userData.authored) return material.userData.authored;
  material.userData.authored = {
    map: material.map,
    anisotropy: material.map?.anisotropy ?? 1,
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    emissiveMap: material.emissiveMap,
    emissiveIntensity: material.emissiveIntensity,
    roughness: material.roughness,
    specularColor: material.specularColor?.getHex(),
    alphaTest: material.alphaTest,
    depthWrite: material.depthWrite,
  };
  return material.userData.authored;
}

function restore(material) {
  const authored = material.userData.authored;
  if (!authored) return;
  if (material.map !== authored.map) material.map = authored.map;
  if (material.map) material.map.anisotropy = authored.anisotropy;
  material.color.setHex(authored.color);
  material.emissive.setHex(authored.emissive);
  material.emissiveMap = authored.emissiveMap;
  material.emissiveIntensity = authored.emissiveIntensity;
  material.roughness = authored.roughness;
  if (material.specularColor && authored.specularColor !== undefined) {
    material.specularColor.setHex(authored.specularColor);
  }
  material.alphaTest = authored.alphaTest;
  material.depthWrite = authored.depthWrite;
  material.needsUpdate = true;
}

/**
 * Applies (or, with `enabled` false, undoes) the kiosk's pass over a loaded rig.
 *
 * Returns which of the kiosk's material names this rig actually has, so the
 * viewer can say what will and will not carry over to the kiosk.
 */
export function applyKioskMaterials(root, { config, renderer, enabled }) {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const skin = new Set(config.skinMaterials);
  const report = {
    skin: { matched: [], missing: [...skin] },
    tint: { matched: [], missing: Object.keys(config.materialTint) },
    face: { name: config.faceMaterial, matched: false },
    transparent: 0,
  };
  const seen = new Set();

  root.traverse((child) => {
    if (!child.isMesh) return;
    for (const material of [].concat(child.material)) {
      if (!material.isMeshStandardMaterial || seen.has(material)) continue;
      seen.add(material);
      snapshot(material);

      if (!enabled) {
        restore(material);
        continue;
      }

      // The makeup goes first: the emissive lift below points at the same
      // texture, so it has to pick up the toned copy or the lips would be
      // lifted at full chroma.
      if (config.faceMaterial && material.name === config.faceMaterial && material.map) {
        report.face.matched = true;
        if (!material.userData.tonedMap) {
          material.userData.tonedMap =
            desaturateMakeup(material.userData.authored.map, MAKEUP.MAKEUP_DESATURATION) ?? null;
        }
        if (material.userData.tonedMap) material.map = material.userData.tonedMap;
      }

      if (material.map) {
        material.map.anisotropy = maxAnisotropy;
        material.map.needsUpdate = true;
      }

      // Face and hands only. Driving the emissive from the diffuse map keeps the
      // skin's own shading; a flat emissive colour fills the shadow side of the
      // face and flattens it.
      if (skin.has(material.name)) {
        report.skin.matched.push(material.name);
        report.skin.missing = report.skin.missing.filter((n) => n !== material.name);
        material.emissiveMap = material.map;
        material.emissive.setRGB(1, 1, 1);
        material.emissiveIntensity = config.skinEmissive;
        // Only where the export left roughnessFactor out.
        if (config.skinRoughness !== null) material.roughness = config.skinRoughness;
      }

      // Albedo scale, matching one rig's exposure to the other's under the one
      // shared light rig. Always from the authored colour, never compounding —
      // the kiosk needs a WeakSet for this; here the snapshot does the job.
      const tint = config.materialTint[material.name];
      if (tint !== undefined) {
        report.tint.matched.push(material.name);
        report.tint.missing = report.tint.missing.filter((n) => n !== material.name);
        material.color.setHex(material.userData.authored.color).multiplyScalar(tint);
      }

      // Roughness the export left out, for materials outside skinMaterials.
      // glTF defaults a missing roughnessFactor to 1.0, fully matte, and a fully
      // matte surface returns no specular — which is how the cyan rim and green
      // kick read as coloured edges on cloth.
      const roughness = config.materialRoughness[material.name];
      if (roughness !== undefined) material.roughness = roughness;

      // Specular the export pushed past 1 — a reflection brighter than the light
      // that caused it.
      const specular = config.materialSpecular[material.name];
      if (specular !== undefined && material.specularColor) {
        material.specularColor.setScalar(specular);
      }

      if (material.transparent) {
        report.transparent += 1;
        // Two cuts, because these cards fail two different ways. A card whose
        // base colour is black contributes nothing but darkness wherever its
        // alpha survives (eyelashes, the scalp under the hair): their
        // mip-averaged haze IS the artefact, so cut hard and keep the dense
        // core. Cards carrying real colour shred into spikes at that cut and
        // only need the faintest texels removed.
        const color = material.color;
        const isMaskOnly = color.r + color.g + color.b < 0.01;
        material.alphaTest = config.alphaTest[material.name] ?? (isMaskOnly ? 0.35 : 0.08);
        material.depthWrite = false;
      }

      material.needsUpdate = true;
    }
  });

  return report;
}
