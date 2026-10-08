# Technical notes

The plain-language setup guide is [README.md](README.md). This file is the detail
behind it — for whoever maintains the kiosk, not for the model designer.

## What it is

A static page that puts an arbitrary `.glb` into the kiosk's studio: the kiosk's
camera and lens, its six-light rig, its reflection panels, its backdrop artwork, its
stage box and its per-material pass. No build step, no npm install — three.js is
vendored under `vendor/`, and `serve.py` (via `start.sh` / `start.bat`) serves the
folder because a `file://` page cannot load ES modules.

There is no speech, lipsync, backend or UI chrome, and the A2F calibration is skipped
since nothing drives it.

## What it mirrors, and how it stays mirrored

| Viewer | Kiosk source |
|---|---|
| `src/kiosk-tuning.generated.js` | `frontend/components/avatar/tuning.ts` — camera, lights, environment, per-rig framing and material tuning |
| the same file's `MAKEUP` | the makeup constants in `frontend/components/avatar/AvatarModel.tsx` |
| `src/viewer.js` — `applyFraming`, the light rig, the environment | `frontend/components/avatar/AvatarScene.tsx` |
| `src/materials.js` | AvatarModel's material effect, including the makeup hue pass |
| `index.html` — `#screen`, `#bg`, `#frame` | `app/page.module.css` and `components/AvatarStage.module.css`, including the 6:5 portrait switch |
| `assets/bg-*.png` | `frontend/public/bg-*.png` |

**Nothing is hand-copied.** A hand-copy drifted twice in this viewer's first hour —
`frameHeightM` moved 1.15 → 1.45 → 1.15, and the male rig went 170mm/10m →
135mm/4.92m — and the viewer silently drew the presenter at the wrong size both
times. So after any retune of the kiosk:

```sh
node sync-tuning.mjs            # or: node sync-tuning.mjs path/to/tuning.ts
```

It strips the types off `tuning.ts`, imports it, checks every key it expects is still
there, and regenerates the data file. A rename in the kiosk fails it loudly rather
than leaving the viewer quietly lying. Then reload the page.

`serve.py` re-runs it on its own when it notices the kiosk's `tuning.ts` is newer than
the generated file and Node is available, so a reload is usually enough. On the
designer's machine neither the kiosk nor Node is present, and it serves the generated
file as shipped.

## What is deliberately not mirrored

- **The backdrop artwork is there, but the dock, chat panel and language bar are
  not.** The composition behind the presenter is the kiosk's; the chrome on top of it
  is not.
- **A2F / lipsync tuning** — nothing drives morphs here.
- **The loading gate** (`data-ready`) — the viewer shows the model as soon as it is
  posed rather than hiding a T-pose behind an overlay.

## How the match was verified

Headless Chrome (`/usr/bin/google-chrome` — the Playwright browsers in
`frontend/node_modules` are not downloaded), kiosk on `:3000` against the viewer on
`:8080`, same model in both, same 1280×720 viewport, figure aligned by best integer
shift before sampling:

| region | kiosk RGB | viewer RGB | max delta |
|---|---|---|---|
| backdrop | — | — | **0.0** — pixel-identical |
| cheek | 155.9, 103.4, 78.8 | 154.4, 102.4, 77.9 | 1.4 |
| kameez | 119.3, 123.1, 110.9 | 118.6, 123.2, 110.7 | 0.6 |
| dupatta | 49.9, 78.3, 57.8 | 49.7, 78.3, 58.1 | 0.3 |

Out of 255; the residual is animation phase, not lighting. Re-run that comparison
after changing anything here — and check the **container** actually holds the values
you think it does (`docker exec … grep -rho "frameHeightM:[0-9.]*" .next/static`),
because a rebuild can lag the working tree.

## Gotchas found while building it

- **drei's `<Environment>` does not use `PMREMGenerator.fromScene`.** It renders the
  Lightformers through a half-float `CubeCamera` target and lets three's own cube-UV
  pass take it from there. The shorter route gave a visibly different rig.
- **`THREE.Clock` is deprecated** in three 0.183; the viewer keeps its own delta.
- **The kiosk's material pass is keyed by material name**, so most of it silently does
  nothing on a renamed export. The Checks panel reports what matched for that reason.
