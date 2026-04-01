import { initConfig } from "./a5e.mjs";

export const MODULE_ID = "enhancedcombathud-a5e";

Hooks.on("setup", () => {
    game.settings.register(MODULE_ID, "drawerFontSize", {
        name: "Drawer Font Size",
        hint: "Font size of the Skills/Saves panel (10-22px)",
        scope: "client",
        config: true,
        type: Number,
        range: { min: 10, max: 22, step: 1 },
        default: 13,
        onChange: (val) => updateDrawerStyles(val),
    });

    initConfig();
});

// Підтримка v12 (renderApplication) і v13 (renderApplicationV2)
Hooks.on("renderApplication",   () => applyStyles());
Hooks.on("renderApplicationV2", () => applyStyles());
Hooks.on("argonInit",           () => applyStyles());

function applyStyles() {
    updateDrawerStyles(game.settings.get(MODULE_ID, "drawerFontSize"));
}

export function updateDrawerStyles(fontSize) {
    let style = document.getElementById("a5e-hud-styles");
    if (!style) {
        style = document.createElement("style");
        style.id = "a5e-hud-styles";
        document.head.appendChild(style);
    }
    const width = Math.round(375 * (fontSize / 13));
    style.textContent = `
        .ability-menu,
        .ability-menu .collapsible-panel {
            width: ${width}px !important;
            min-width: ${width}px !important;
            font-size: ${fontSize}px !important;
        }
        .ability-menu * {
            font-size: ${fontSize}px !important;
        }
    `;
}
