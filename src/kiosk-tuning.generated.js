// GENERATED — do not edit. Run `node sync-tuning.mjs` to refresh.
//
// Every value below is read straight out of the kiosk's
// frontend/components/avatar/tuning.ts, which is the only place they are
// maintained. See ../sync-tuning.mjs, and src/tuning.js for what they mean.
//
// Source: /home/ubuntu/Desktop/Mari-Interactive-Kiosk-main/frontend/components/avatar/tuning.ts
// Synced: 2026-10-08

export const CAMERA = {
  "frameHeightM": 1.15,
  "headRoom": 0.045,
  "lensMm": 85,
  "sensorMm": 36,
  "sway": {
    "amplitude": 0.015,
    "speed": 0.08
  }
};

export const LIGHT_COLORS = {
  "key": "#ffe4c9",
  "fill": "#c9d6ff",
  "rim": "#4fd8e8",
  "kick": "#3fd39a",
  "top": "#e8daf5",
  "face": "#fff2e0"
};

export const LIGHT_PLACEMENT = {
  "key": {
    "position": [
      2,
      3,
      2
    ],
    "intensity": 1.4
  },
  "fill": {
    "position": [
      -2,
      2,
      -1
    ],
    "intensity": 0.4
  },
  "top": {
    "position": [
      0,
      3,
      1.5
    ],
    "angle": 0.4,
    "penumbra": 1,
    "intensity": 0.9
  },
  "rim": {
    "position": [
      -2.2,
      2.2,
      -1.8
    ],
    "angle": 0.7,
    "penumbra": 0.9,
    "intensity": 1.4
  },
  "kick": {
    "position": [
      2.4,
      2,
      -1.6
    ],
    "angle": 0.7,
    "penumbra": 0.9,
    "intensity": 0.8
  },
  "face": {
    "position": [
      0,
      2.2,
      1
    ],
    "angle": 0.18,
    "penumbra": 0.6,
    "intensity": 1.6,
    "distance": 1.6,
    "decay": 2
  }
};

export const LIGHT_STATES = {
  "idle": {
    "key": 1.4,
    "fill": 0.4,
    "rim": 2,
    "kick": 5,
    "top": 0.9
  },
  "listening": {
    "key": 1.8,
    "fill": 0.5,
    "rim": 2,
    "kick": 5,
    "top": 1.1
  },
  "thinking": {
    "key": 1.2,
    "fill": 0.5,
    "rim": 2,
    "kick": 5,
    "top": 0.8
  },
  "speaking": {
    "key": 1.8,
    "fill": 0.5,
    "rim": 2,
    "kick": 5,
    "top": 1.2
  }
};

export const ENVIRONMENT = {
  "resolution": 256,
  "lightformers": [
    {
      "intensity": 2,
      "position": [
        0,
        2,
        3
      ],
      "scale": [
        4,
        1,
        1
      ],
      "color": "#ffe0cc"
    },
    {
      "intensity": 1,
      "position": [
        -3,
        1,
        -1
      ],
      "scale": [
        3,
        2,
        1
      ],
      "color": "#c9d6ff"
    },
    {
      "intensity": 0.5,
      "position": [
        3,
        0,
        -2
      ],
      "scale": [
        2,
        3,
        1
      ],
      "color": "#ffd6e0"
    }
  ]
};

export const DARK_LIGHTING = {
  "exposure": 1,
  "ambient": 0.3,
  "fill": 1,
  "environment": 1
};

export const RIG_TUNING = {
  "female": {
    "fallbackHeight": 1.68,
    "headTargetY": 1.45,
    "widthSqueeze": 1,
    "lensMm": 85,
    "cameraDistanceM": null,
    "backLight": {
      "rim": 1,
      "kick": 1
    },
    "lightThemeLighting": {
      "exposure": 1.35,
      "ambient": 0.9,
      "fill": 2.3,
      "environment": 1.3
    },
    "darkThemeLighting": {
      "exposure": 1,
      "ambient": 0.3,
      "fill": 1,
      "environment": 1
    },
    "skinMaterials": [
      "lambert11",
      "lambert13",
      "lambert12"
    ],
    "skinEmissive": 0.25,
    "skinRoughness": null,
    "materialTint": {},
    "faceMaterial": "lambert12",
    "alphaTest": {},
    "materialRoughness": {},
    "materialSpecular": {}
  },
  "male": {
    "fallbackHeight": 1.85,
    "headTargetY": 1.6,
    "widthSqueeze": 0.93,
    "lensMm": 135,
    "cameraDistanceM": 4.92,
    "backLight": {
      "rim": 0,
      "kick": 0
    },
    "lightThemeLighting": {
      "exposure": 1.3,
      "ambient": 0.95,
      "fill": 2.6,
      "environment": 1.3
    },
    "darkThemeLighting": {
      "exposure": 1,
      "ambient": 0.45,
      "fill": 1.35,
      "environment": 1
    },
    "skinMaterials": [
      "lambert5",
      "Std_Skin_Arm",
      "Std_Skin_Leg"
    ],
    "skinEmissive": 0.08,
    "skinRoughness": null,
    "materialTint": {
      "pasted__pasted__lambert6": 0.62,
      "lambert5": 0.95,
      "Std_Skin_Arm": 0.95,
      "Std_Skin_Leg": 0.95
    },
    "faceMaterial": null,
    "alphaTest": {
      "standardSurface2": 0.08
    },
    "materialRoughness": {},
    "materialSpecular": {
      "standardSurface2": 0.6
    }
  }
};

export const MAKEUP = {
  "MAKEUP_DESATURATION": 0.2,
  "MAKEUP_MAX_HUE_DEG": 20,
  "MAKEUP_MIN_SATURATION": 0.22,
  "FACE_UV_BOX": {
    "x0": 0.12,
    "x1": 0.88,
    "y0": 0.05,
    "y1": 0.72
  }
};
