// Generated from production geometry by scripts/generate-weapon-icons.mjs.
export const WEAPON_INDICATOR_ICONS = {
    "PISTOL": {
        "label": "Pistol",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 41.2 23.578\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M0 0.2L38 0.2L38 11.2L0 11.2Z\"/><path d=\"M2.969 9.522L9.031 6.022L17.031 19.878L10.969 23.378Z\"/><path d=\"M5 0L41 0L41 3L5 3Z\"/></svg>"
    },
    "SHOTGUN": {
        "label": "Shotgun",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 85.226 26.896\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M5.026 1L50.026 1L50.026 13L5.026 13Z\"/><path d=\"M30.026 3L85.026 3L85.026 7L30.026 7Z\"/><path d=\"M0 16.304L19.053 5.304L25.053 15.696L6 26.696Z\"/><path d=\"M30.026 7L55.026 7L55.026 15L30.026 15Z\"/><path d=\"M11.526 0L53.526 0L53.526 4L11.526 4Z\"/></svg>"
    },
    "AR": {
        "label": "Assault rifle",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 98.7 32.629\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M0 0.2L52 0.2L52 13.2L0 13.2Z\"/><path d=\"M33.5 3.2L98.5 3.2L98.5 6.2L33.5 6.2Z\"/><path d=\"M7.219 11.955L13.281 8.455L20.781 21.445L14.719 24.945Z\"/><path d=\"M24.807 30.358L29.466 12.971L37.193 15.042L32.534 32.429Z\"/><path d=\"M8 0L56 0L56 3L8 3Z\"/></svg>"
    },
    "SNIPER": {
        "label": "Sniper rifle",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 199.2 28.878\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M33 5.5L71 5.5L71 16.5L33 16.5Z\"/><path d=\"M35.969 14.822L42.031 11.322L50.031 25.178L43.969 28.678Z\"/><path d=\"M38 5.3L74 5.3L74 8.3L38 8.3Z\"/><path d=\"M71 8.3L185 8.3L185 13.7L71 13.7Z\"/><path d=\"M185 7.2L199 7.2L199 14.8L185 14.8Z\"/><path d=\"M187.25 8.5L189.75 8.5L189.75 13.5L187.25 13.5Z\"/><path d=\"M194.25 8.5L196.75 8.5L196.75 13.5L194.25 13.5Z\"/><path d=\"M1 9.5L33 9.5L33 20.5L1 20.5Z\"/><path d=\"M0 9.4L2 9.4L2 20.6L0 20.6Z\"/><path d=\"M44.5 0L69.5 0L69.5 4L44.5 4Z\"/><path d=\"M47.5 2.5L50.5 2.5L50.5 6.5L47.5 6.5Z\"/><path d=\"M63.5 2.5L66.5 2.5L66.5 6.5L63.5 6.5Z\"/><path d=\"M69.1 0.2L70.1 0.2L70.1 3.8L69.1 3.8Z\"/></svg>"
    },
    "MINIGUN": {
        "label": "Minigun",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 90.2 26.2\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M0 8L18 8L18 26L0 26Z\"/><path d=\"M0 2L4 2L4 14L0 14Z\"/><path d=\"M2 0L17 0L17 4L2 4Z\"/><path d=\"M18 15L90 15L90 19L18 19Z\"/><path d=\"M18 8.938L90 8.938L90 12.938L18 12.938Z\"/><path d=\"M18 21.062L90 21.062L90 25.062L18 25.062Z\"/><path d=\"M53.25 8L54.75 8L54.75 26L53.25 26Z\"/><path d=\"M54.2 12.5L56.2 12.5L56.2 21.5L54.2 21.5Z\"/></svg>"
    },
    "ROCKET": {
        "label": "Mecha rocket",
        "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-0.1 -0.1 320.2 190.2\" fill=\"#fff\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M0 0L240 19L240 171L0 190Z\"/><path d=\"M240 19L320 95L240 171Z\"/></svg>"
    }
} as const;
export type WeaponIndicatorKind = keyof typeof WEAPON_INDICATOR_ICONS;
