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

// <style> живе в <head> постійно — досить застосувати один раз (+ onChange налаштування)
Hooks.once("ready",   () => applyStyles());
Hooks.on("argonInit", () => applyStyles());

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
    // Ядро Argon: портрет 375px, праворуч колонка 115px (шкала руху / кнопки
    // відпочинку, .hidden коли її немає). Панель рівно до правого краю цієї
    // колонки; шрифт на ширину не впливає, інакше панель лізе на панель дій.
    // ">" у :has — не прибирати: ядро додає панелі прямо в корінь HUD, а
    // пошук лише серед дітей не змушує браузер перевіряти селектор на кожне
    // перемальовування кнопок і квадратиків руху всередині HUD
    style.textContent = `
        .ability-menu,
        .ability-menu .collapsible-panel {
            width: 375px !important;
            min-width: 375px !important;
            font-size: ${fontSize}px !important;
        }
        .extended-combat-hud:has(> .movement-hud:not(.hidden)) > .ability-menu,
        .extended-combat-hud:has(> .movement-hud:not(.hidden)) > .ability-menu .collapsible-panel {
            width: 490px !important;
            min-width: 490px !important;
        }
        .ability-menu * {
            font-size: ${fontSize}px !important;
        }
    `;
}
