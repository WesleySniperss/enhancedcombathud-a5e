import { MODULE_ID } from "./main.mjs";

// ─── Утиліти ──────────────────────────────────────────────────────────────────

const getActivationType = (item) => {
    const actions = item?.system?.actions;
    if (!actions) return null;
    const first = Object.values(actions)[0];
    return first?.activation?.type ?? null;
};

function getDamageTypeIcon(damageType) {
    switch ((damageType ?? "").toLowerCase()) {
        case "acid":         return '<i class="fas fa-flask"></i>';
        case "bludgeoning":  return '<i class="fas fa-hammer"></i>';
        case "cold":         return '<i class="fas fa-snowflake"></i>';
        case "fire":         return '<i class="fas fa-fire"></i>';
        case "force":        return '<i class="fas fa-hand-sparkles"></i>';
        case "lightning":    return '<i class="fas fa-bolt"></i>';
        case "necrotic":     return '<i class="fas fa-skull"></i>';
        case "piercing":     return '<i class="fas fa-crosshairs"></i>';
        case "poison":       return '<i class="fas fa-skull-crossbones"></i>';
        case "psychic":      return '<i class="fas fa-brain"></i>';
        case "radiant":      return '<i class="fas fa-sun"></i>';
        case "slashing":     return '<i class="fas fa-cut"></i>';
        case "thunder":      return '<i class="fas fa-bell"></i>';
        case "healing":      return '<i class="fas fa-heart"></i>';
        default:             return '<i class="fas fa-sparkles"></i>';
    }
}

function getProficiencyIcon(prof) {
    if (prof >= 2)    return '<i style="margin-right:1ch;pointer-events:none" class="fas fa-check-double"></i>';
    if (prof === 1)   return '<i style="margin-right:1ch;pointer-events:none" class="fas fa-check"></i>';
    if (prof === 0.5) return '<i style="margin-right:1ch;pointer-events:none" class="fas fa-adjust"></i>';
    return '<i style="margin-right:1ch;pointer-events:none" class="far fa-circle"></i>';
}

function addSign(val) { return val >= 0 ? `+${val}` : `${val}`; }

// ─── Ініціалізація ─────────────────────────────────────────────────────────────

export function initConfig() {

    Hooks.on("updateItem", (item) => {
        if (item.parent === ui.ARGON?._actor && ui.ARGON?.rendered)
            ui.ARGON.components.portrait.refresh();
    });

    Hooks.on("argonInit", (CoreHUD) => {
        if (game.system.id !== "a5e") return;

        const ARGON = CoreHUD.ARGON;

        const actionTypes = {
            action:   ["action", ""],
            bonus:    ["bonusAction"],
            reaction: ["reaction"],
            free:     ["free"],
        };

        const itemTypes = {
            spell:    ["spell"],
            feature:  ["feature"],
            object:   ["object"],
            maneuver: ["maneuver"],
        };

        // ── Tooltip ───────────────────────────────────────────────────────────
        async function getTooltipDetails(item) {
            if (!item?.system) return {};
            const title    = item.name;
            const raw      = item.system.description?.value ?? "";
            const details  = [];
            const props    = [];
            let subtitle   = "";

            // A5E зберігає range/target/damage всередині system.actions[id]
            const firstAction = Object.values(item.system.actions ?? {})[0];
            const firstRange  = firstAction ? Object.values(firstAction.ranges ?? {})[0] : null;
            if (firstRange?.range)
                details.push({ label: "enhancedcombathud-a5e.tooltip.range.name",
                               value: firstRange.range });
            if (firstAction?.target?.type)
                details.push({ label: "enhancedcombathud-a5e.tooltip.target.name",
                               value: firstAction.target.type });

            switch (item.type) {
                case "weapon":
                    subtitle = item.system.weaponType ?? "";
                    break;
                case "spell":
                    subtitle = `Level ${item.system.level ?? 0}`;
                    if (item.system.schools) props.push(Object.keys(item.system.schools)[0] ?? "");
                    break;
                case "maneuver":
                    subtitle = `Degree ${item.system.degree ?? 1}`;
                    if (item.system.exertionCost)
                        details.push({ label: "enhancedcombathud-a5e.tooltip.exertion.name",
                                       value: item.system.exertionCost });
                    break;
                case "feature":
                    subtitle = item.system.featureType ?? "";
                    break;
            }

            // Rolls (damage) живуть у actions[id].rolls[id]
            if (firstAction?.rolls) {
                const rollParts = Object.values(firstAction.rolls)
                    .filter(r => r.type === "damage" || r.damageType)
                    .map(r => `${r.formula ?? ""} ${getDamageTypeIcon(r.damageType ?? "")}`)
                    .join(" + ");
                if (rollParts.trim())
                    details.push({ label: "enhancedcombathud-a5e.tooltip.damage.name", value: rollParts });
            }

            const description = raw ? await TextEditor.enrichHTML(raw, { relativeTo: item }) : "";
            return { title, description, subtitle, details,
                     properties: props.map(p => ({ label: p, secondary: true })),
                     propertiesLabel: "enhancedcombathud-a5e.tooltip.properties.name" };
        }

        // ── Portrait ──────────────────────────────────────────────────────────
        class A5ePortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
            get description() {
                const { type, system } = this.actor;
                if (type === "npc") {
                    const cr = system.details?.cr ?? 0;
                    const crStr = (cr >= 1 || cr <= 0) ? cr : `1/${1 / cr}`;
                    return `CR ${crStr} ${system.details?.creatureType ?? ""}`;
                }
                if (type === "character") {
                    return `Level ${system.details?.level ?? 0} ${system.details?.heritage ?? ""}`;
                }
                return "";
            }
            get isDead()     { return this.isDying && this.actor.type !== "character"; }
            get isDying()    { return (this.actor.system.attributes?.hp?.value ?? 1) <= 0; }
            get successes()  { return this.actor.system.attributes?.death?.success ?? 0; }
            get failures()   { return this.actor.system.attributes?.death?.failure ?? 0; }

            async _onDeathSave(event) {
                this.actor.rollDeathSavingThrow?.({ event });
            }

            async getStatBlocks() {
                const hp    = this.actor.system.attributes?.hp ?? {};
                const ac    = this.actor.system.attributes?.ac?.value ?? 10;
                const hpVal = (hp.value ?? 0) + (hp.temp ?? 0);
                const hpMax = (hp.max   ?? 0) + (hp.tempmax ?? 0);
                const hpColor = hp.temp ? "#6698f3" : "rgb(0 255 170)";
                return [
                    [
                        { text: `${hpVal}`, color: hpColor },
                        { text: "/" },
                        { text: `${hpMax}` },
                        { text: "HP" },
                    ],
                    [
                        { text: "AC" },
                        { text: `${ac}`, color: "var(--ech-movement-baseMovement-background)" },
                    ],
                ];
            }
        }

        // ── Drawer ────────────────────────────────────────────────────────────
        class A5eDrawerButton extends ARGON.DRAWER.DrawerButton {
            constructor(buttons, item, type) { super(buttons); this.item = item; this.type = type; }
            get hasTooltip() { return false; }
        }

        class A5eDrawerPanel extends ARGON.DRAWER.DrawerPanel {
            get title() {
                return `${game.i18n.localize("enhancedcombathud-a5e.hud.saves.name")} / ${game.i18n.localize("enhancedcombathud-a5e.hud.skills.name")}`;
            }
            get categories() {
                const abilities = this.actor.system.abilities ?? {};
                const skills    = this.actor.system.skills    ?? {};

                const abilityButtons = Object.entries(abilities).map(([key, data]) => {
                    const label = CONFIG.A5E?.abilities?.[key] ?? key.toUpperCase();
                    const mod   = data.check?.deterministicBonus ?? data.check?.mod ?? data.mod ?? 0;
                    const save  = data.save?.deterministicBonus ?? data.save?.mod ?? mod;
                    return new A5eDrawerButton([
                        { label, onClick: (ev) => this.actor.rollAbilityCheck?.(key, { event: ev }) },
                        { label: addSign(mod),  onClick: (ev) => this.actor.rollAbilityCheck?.(key, { event: ev }) },
                        { label: addSign(save), onClick: (ev) => this.actor.rollSavingThrow?.(key,  { event: ev }) },
                    ], key, "ability");
                });

                const skillButtons = Object.entries(skills).map(([key, data]) => {
                    const label = CONFIG.A5E?.skills?.[key]?.label
                        ?? key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                    const prof  = data.proficient ?? 0;
                    const total = data.total ?? 0;
                    return new A5eDrawerButton([
                        { label: getProficiencyIcon(prof) + label,
                          onClick: (ev) => this.actor.rollSkillCheck?.(key, { event: ev }) },
                        { label: addSign(total), style: "display:flex;justify-content:flex-end" },
                    ], key, "skill");
                });

                return [
                    { gridCols: "5fr 2fr 2fr",
                      captions: [{ label: "Ability", align: "left" }, { label: "Check", align: "center" }, { label: "Save", align: "center" }],
                      align: ["left", "center", "center"], buttons: abilityButtons },
                    { gridCols: "7fr 2fr",
                      captions: [{ label: "Skills", align: "left" }, { label: "" }],
                      buttons: skillButtons },
                ];
            }
        }

        // ── Item Button ───────────────────────────────────────────────────────
        class A5eItemButton extends ARGON.MAIN.BUTTONS.ItemButton {
            get hasTooltip() { return true; }
            get ranges()  {
                const r = this.item?.system?.range;
                return { normal: r?.value ?? null, long: r?.long ?? null };
            }
            get targets() {
                const t = this.item?.system?.target;
                if (!t) return null;
                if (["creature","ally","enemy"].includes(t.type)) return t.quantity ?? 1;
                return null;
            }
            get quantity() {
                if (!this.item) return null;
                // A5E: uses живе і на рівні item, і в actions[id].uses
                const uses = this.item.system.uses;
                if (uses?.max) return uses.max - (uses.value ?? 0);
                const firstAction = Object.values(this.item.system.actions ?? {})[0];
                const actionUses = firstAction?.uses;
                if (actionUses?.max) return actionUses.max - (actionUses.value ?? 0);
                if (this.item.system.quantity != null) return this.item.system.quantity;
                return null;
            }
            async getTooltipData() { return await getTooltipDetails(this.item); }

            async _onLeftClick(event) {
                ui.ARGON.interceptNextDialog(event.currentTarget);
                const used = await (this.item.activate?.({ event }) ?? this.item.use?.({ event }));
                if (used) A5eItemButton.consumeActionEconomy(this.item);
            }
            async _onRightClick(event) { this.item?.sheet?.render(true); }

            static consumeActionEconomy(item) {
                const act = getActivationType(item);
                if (!act) return;
                const p = ui.ARGON?.components?.main ?? [];
                if (actionTypes.action.includes(act)   && p[0]) { p[0].isActionUsed = true; p[0].updateActionUse(); }
                else if (actionTypes.bonus.includes(act)    && p[1]) { p[1].isActionUsed = true; p[1].updateActionUse(); }
                else if (actionTypes.reaction.includes(act) && p[2]) { p[2].isActionUsed = true; p[2].updateActionUse(); }
                else if (actionTypes.free.includes(act)     && p[3]) { p[3].isActionUsed = true; p[3].updateActionUse(); }
            }
        }

        // ── Button Panel Button ───────────────────────────────────────────────
        class A5eButtonPanelButton extends ARGON.MAIN.BUTTONS.ButtonPanelButton {
            constructor({ type, items, color, actionType = null }) {
                super(); this.type = type; this.items = items; this.color = color; this.actionType = actionType;
            }
            get hasContents()  { return this.items.length > 0; }
            get colorScheme()  { return this.color; }
            get id()           { return `${this.type}-${this.color}`; }
            get label() {
                const base = {
                    spell:    "enhancedcombathud-a5e.hud.castSpell.name",
                    feature:  "enhancedcombathud-a5e.hud.useFeature.name",
                    object:   "enhancedcombathud-a5e.hud.useItem.name",
                    maneuver: "enhancedcombathud-a5e.hud.useManeuver.name",
                }[this.type];
                // Для feature/object додаємо тип дії в дужках щоб уникнути дублікатів
                if (this.actionType && ["feature", "object"].includes(this.type)) {
                    const suffix = {
                        action:      "(Action)",
                        bonusAction: "(Bonus)",
                        reaction:    "(Reaction)",
                        free:        "(Free)",
                    }[this.actionType];
                    if (suffix) {
                        // Повертаємо i18n ключ з суфіксом через кастомний геттер
                        const baseLabel = game.i18n.localize(base);
                        return `${baseLabel} ${suffix}`;
                    }
                }
                return base;
            }
            get icon() {
                return { spell: "modules/enhancedcombathud/icons/spell-book.webp",
                         feature: "modules/enhancedcombathud/icons/mighty-force.webp",
                         object: "modules/enhancedcombathud/icons/drink-me.webp",
                         maneuver: "modules/enhancedcombathud/icons/mighty-force.webp" }[this.type];
            }

            async _getPanel() {
                const AccPanel = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanel;
                const AccCat   = ARGON.MAIN.BUTTON_PANELS.ACCORDION.AccordionPanelCategory;
                const BtnPanel = ARGON.MAIN.BUTTON_PANELS.ButtonPanel;

                if (this.type === "spell") {
                    const cantrips = this.items.filter(i => i.system?.level === 0);
                    const byLevel  = {};
                    for (const i of this.items) {
                        const lvl = i.system?.level ?? 0;
                        if (lvl === 0) continue;
                        (byLevel[lvl] ??= []).push(i);
                    }
                    const cats = [];
                    if (cantrips.length)
                        cats.push(new AccCat({ label: game.i18n.localize("enhancedcombathud-a5e.hud.spells.cantrip"),
                                               buttons: cantrips.map(i => new A5eItemButton({ item: i })),
                                               uses: { max: Infinity, value: Infinity } }));
                    for (const [lvl, items] of Object.entries(byLevel).sort((a,b) => +a[0]-+b[0])) {
                        const level = lvl; // захоплюємо значення в замиканні
                        cats.push(new AccCat({ label: `${game.i18n.localize("enhancedcombathud-a5e.hud.spells.level")} ${lvl}`,
                                               buttons: items.map(i => new A5eItemButton({ item: i })),
                                               // Функція читає слоти КОЖНОГО РАЗУ з актора — реактивно
                                               uses: () => {
                                                   const s = this.actor.system.spellResources?.slots?.[level] ?? { current: 0, max: 0 };
                                                   return { value: s.current, max: s.max };
                                               } }));
                    }
                    return new AccPanel({ id: this.id, accordionPanelCategories: cats });
                }

                if (this.type === "maneuver") {
                    const byDeg = {};
                    for (const i of this.items) (byDeg[i.system?.degree ?? 0] ??= []).push(i);
                    const degrees = Object.keys(byDeg).map(Number);
                    const allZero = degrees.every(d => d === 0);
                    if (allZero || degrees.length === 1) {
                        return new BtnPanel({ id: this.id, buttons: this.items.map(i => new A5eItemButton({ item: i })) });
                    }
                    const cats = Object.entries(byDeg).sort((a,b) => +a[0]-+b[0])
                        .map(([d, items]) => new AccCat({
                            label: `${game.i18n.localize("enhancedcombathud-a5e.hud.maneuver.degree")} ${d}`,
                            buttons: items.map(i => new A5eItemButton({ item: i })),
                            // Реактивно читаємо exertion кожного разу
                            uses: () => {
                                const ex = this.actor.system.exertion ?? { current: 0, max: 0 };
                                return { value: ex.current, max: ex.max };
                            } }));
                    return new AccPanel({ id: this.id, accordionPanelCategories: cats });
                }

                return new BtnPanel({ id: this.id, buttons: this.items.map(i => new A5eItemButton({ item: i })) });
            }
        }

        // ── Action Panels ─────────────────────────────────────────────────────
        function buildButtons(actor, activations, color, weaponSet = null, panelType = null) {
            const buttons = [];
            // Weapon sets вимкнені — в A5E вони не потрібні
            for (const [type, types] of Object.entries(itemTypes)) {
                const items = actor.items.filter(i => types.includes(i.type) && activations.includes(getActivationType(i)));
                if (!items.length) continue;
                const btn = new A5eButtonPanelButton({ type, items, color, actionType: panelType });
                if (btn.hasContents) buttons.push(btn);
            }
            return buttons;
        }

        class A5eActionPanel extends ARGON.MAIN.ActionPanel {
            get label()          { return "enhancedcombathud-a5e.hud.action.name"; }
            get maxActions()     { return this.actor?.inCombat ? 1 : null; }
            get currentActions() { return this.isActionUsed ? 0 : 1; }
            _onNewRound()        { this.isActionUsed = false; this.updateActionUse(); }
            async _getButtons()  { return buildButtons(this.actor, actionTypes.action, 0, true, "action"); }
        }

        class A5eBonusPanel extends ARGON.MAIN.ActionPanel {
            get label()          { return "enhancedcombathud-a5e.hud.bonusAction.name"; }
            get maxActions()     { return this.actor?.inCombat ? 1 : null; }
            get currentActions() { return this.isActionUsed ? 0 : 1; }
            _onNewRound()        { this.isActionUsed = false; this.updateActionUse(); }
            async _getButtons()  { return buildButtons(this.actor, actionTypes.bonus, 1, false, "bonus"); }
        }

        class A5eReactionPanel extends ARGON.MAIN.ActionPanel {
            get label()          { return "enhancedcombathud-a5e.hud.reaction.name"; }
            get maxActions()     { return this.actor?.inCombat ? 1 : null; }
            get currentActions() { return this.isActionUsed ? 0 : 1; }
            _onNewRound()        { this.isActionUsed = false; this.updateActionUse(); }
            async _getButtons()  { return buildButtons(this.actor, actionTypes.reaction, 3, null, "reaction"); }
        }

        class A5eFreePanel extends ARGON.MAIN.ActionPanel {
            get label()          { return "enhancedcombathud-a5e.hud.freeAction.name"; }
            get maxActions()     { return null; }
            get currentActions() { return null; }
            async _getButtons()  { return buildButtons(this.actor, actionTypes.free, 2, null, "free"); }
        }

        // ── Movement Hud ──────────────────────────────────────────────────────
        class A5eMovementHud extends ARGON.MovementHud {
            get visible() { return game.combat?.started ?? false; }

            get movementMax() {
                if (!this.actor) return 0;
                const mv = this.actor.system.attributes?.movement ?? {};

                // A5E зберігає { walk: { distance: 30, unit: "feet" } }
                let walkSpeed = 0;
                if (typeof mv.walk === "number") {
                    walkSpeed = mv.walk;
                } else if (typeof mv.walk === "object" && mv.walk !== null) {
                    walkSpeed = mv.walk.distance ?? 0;
                }

                // В A5E одиниця завжди "feet", 1 клітинка = 5 футів
                // grid distance може бути 1 (не 5), тому ділимо на 5 напряму
                const unit = mv.walk?.unit ?? "feet";
                const feetPerSquare = unit === "feet" ? 5 : 1;

                return Math.round(walkSpeed / feetPerSquare);
            }
        }

        // ── Button Hud (rest) ─────────────────────────────────────────────────
        class A5eButtonHud extends ARGON.ButtonHud {
            get visible() { return !(game.combat?.started ?? false); }
            async _getButtons() {
                return [
                    { label: "enhancedcombathud-a5e.hud.longRest.name",
                      onClick: () => this.actor.rest?.({ restType: "long" }) ?? this.actor.longRest?.(),
                      icon: "fas fa-bed" },
                    { label: "enhancedcombathud-a5e.hud.shortRest.name",
                      onClick: () => this.actor.rest?.({ restType: "short" }) ?? this.actor.shortRest?.(),
                      icon: "fas fa-coffee" },
                ];
            }
        }

        // ── Weapon Sets ───────────────────────────────────────────────────────
        class A5eWeaponSets extends ARGON.WeaponSets {
            async getDefaultSets() {
                const base = await super.getDefaultSets();
                if (this.actor.type !== "npc") return base;
                const w = this.actor.items.filter(i => i.type === "weapon");
                return {
                    1: { primary: w[0]?.uuid ?? null, secondary: w[1]?.uuid ?? null },
                    2: { primary: w[2]?.uuid ?? null, secondary: w[3]?.uuid ?? null },
                    3: { primary: w[4]?.uuid ?? null, secondary: w[5]?.uuid ?? null },
                };
            }
            async _getSets() {
                const sets = foundry.utils.mergeObject(
                    await this.getDefaultSets(),
                    foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {})
                );
                for (const slots of Object.values(sets)) {
                    slots.primary   = slots.primary   ? await fromUuid(slots.primary)   : null;
                    slots.secondary = slots.secondary ? await fromUuid(slots.secondary) : null;
                }
                return sets;
            }
            async _onSetChange({ sets, active }) {
                const updates = [];
                const activeItems   = Object.values(sets[active]).filter(Boolean);
                const inactiveItems = Object.values(sets).filter(s => s !== sets[active])
                    .flatMap(s => Object.values(s)).filter(Boolean).filter(i => !activeItems.includes(i));
                activeItems.forEach(i   => { if (!i.system?.equipped) updates.push({ _id: i.id, "system.equipped": true });  });
                inactiveItems.forEach(i => { if (i.system?.equipped)  updates.push({ _id: i.id, "system.equipped": false }); });
                if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
            }
        }

        // ── Реєстрація ────────────────────────────────────────────────────────
        CoreHUD.definePortraitPanel(A5ePortraitPanel);
        CoreHUD.defineDrawerPanel(A5eDrawerPanel);
        CoreHUD.defineMainPanels([A5eActionPanel, A5eBonusPanel, A5eReactionPanel, A5eFreePanel, ARGON.PREFAB.PassTurnPanel]);
        CoreHUD.defineMovementHud(A5eMovementHud);
        CoreHUD.defineButtonHud(A5eButtonHud);
        // Повністю прибираємо weapon sets
        class A5eEmptyWeaponSets extends ARGON.WeaponSets {
            get visible()          { return false; }
            get slots()            { return []; }
            async _getSets()       { return {}; }
            async getDefaultSets() { return {}; }
            async render(...args)  { return; }
        }
        CoreHUD.defineWeaponSets(A5eEmptyWeaponSets);
        CoreHUD.defineSupportedActorTypes(["character", "npc"]);

        console.log("Argon Combat HUD | A5E bridge loaded ✓");
    });
}
