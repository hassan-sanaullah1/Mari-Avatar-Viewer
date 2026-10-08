/**
 * The kiosk's camera and light rig.
 *
 * None of these numbers are maintained here. They are read out of the kiosk's
 * own frontend/components/avatar/tuning.ts by ../sync-tuning.mjs and written to
 * ./kiosk-tuning.generated.js; this file only re-exports them, attaches the
 * labels the viewer's UI needs, and explains what they are. Run
 *
 *   node sync-tuning.mjs
 *
 * after anyone retunes the kiosk, or the viewer will quietly show a studio the
 * kiosk no longer has.
 *
 * What is deliberately NOT taken across: the per-material fixes (skin emissive,
 * albedo tints, roughness and specular overrides). Those are keyed to the
 * material names inside the two shipped rigs and would do nothing for a new
 * export. The generic parts of that pass — alpha-card cutoff and texture
 * anisotropy — are in viewer.js and can be switched off.
 */

import {
  CAMERA,
  DARK_LIGHTING,
  ENVIRONMENT,
  LIGHT_COLORS,
  LIGHT_PLACEMENT,
  LIGHT_STATES,
  RIG_TUNING,
} from "./kiosk-tuning.generated.js";

export {
  /** Frame height, head room, the baseline lens, the sensor and the slow sway. */
  CAMERA,
  /** The one palette. Fixed: a conversation state changes brightness, never hue. */
  LIGHT_COLORS,
  /** Where each of the six lights stands and how wide it throws. */
  LIGHT_PLACEMENT,
  /** How bright each light is in each conversation state. */
  LIGHT_STATES,
  /** The reflection panels. Reflections only — they are never drawn. */
  ENVIRONMENT,
  /** The rig as authored, before the light theme existed. */
  DARK_LIGHTING,
};

/** What to call each presenter in this viewer's UI — the kiosk's labels are per-language. */
const LABELS = { female: "Female presenter", male: "Male presenter" };

/**
 * The per-rig half: how the shot is framed on each presenter and how the studio
 * is lit for them. `fallbackHeight` is only used until the uploaded .glb reports
 * its own height, exactly as on the kiosk.
 */
export const PRESENTERS = Object.fromEntries(
  Object.entries(RIG_TUNING).map(([id, rig]) => [id, { label: LABELS[id] ?? id, ...rig }]),
);

/**
 * The kiosk's backdrop artwork, copied into ./assets and chosen by theme and
 * screen shape exactly as app/page.module.css chooses it — which index.html
 * does in CSS, so nothing reads this at runtime. It is here because the
 * lighting only reads correctly against it: the cyan rim and green kick in the
 * rig above are these two halves of the artwork thrown back onto the
 * presenter's silhouette.
 */
export const BACKDROP = {
  landscape: { dark: "assets/bg-desktop-dark.png", light: "assets/bg-desktop-light.png" },
  portrait: { dark: "assets/bg-mobile-dark.png", light: "assets/bg-mobile-light.png" },
};
