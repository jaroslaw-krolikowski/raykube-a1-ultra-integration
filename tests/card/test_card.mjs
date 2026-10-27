// Browser test of raykube-lock-card with a mocked hass object.
// Run: node tests/card/test_card.mjs [screenshot_dir]   (needs playwright + chromium)
import { chromium } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = process.argv[2];
const LOCK = "lock.raykube_a1_ultra_d9f494_zamek";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + path.join(here, "harness.html"));

// Service calls only; logbook reloads (ws) on every state change are expected.
const calls = () => page.evaluate(() => window.calls.splice(0).filter((c) => c[0] !== "ws"));
const setLock = (state, attributes = {}) => page.evaluate(([id, s, attrs]) => {
  const hass = window.makeHass();
  hass.states[id] = { ...hass.states[id], state: s, last_changed: new Date().toISOString(),
    attributes: { ...hass.states[id].attributes, ...attrs },
    context: { id: String(Math.random()), user_id: null, parent_id: null } };
  window.states = hass.states;
  window.card.hass = hass;
}, [LOCK, state, attributes]);
const toasts = () => page.evaluate(() => window.toasts.splice(0));
const tile = page.locator("raykube-lock-card ha-card");
const action = page.locator("raykube-lock-card .action");
const tapTile = async () => {
  const box = await tile.boundingBox();
  await page.mouse.click(box.x + 60, box.y + box.height / 2);
};

// Compact tile, locked: the action offers "Otwórz"
await tile.waitFor();
assert.equal(await page.locator("raykube-lock-card .name").textContent(), "Drzwi wejściowe");
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Zamknięty");
assert.match(await page.locator("raykube-lock-card .meta").textContent(), /·15 min/);
assert.equal((await action.textContent()).trim(), "Otwórz");
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "1-tile-locked.png") });

// Battery icon on the tile only when low
assert.equal(await page.locator("raykube-lock-card .battery").isHidden(), true);
await page.evaluate(() => {
  const hass = window.makeHass();
  hass.states["sensor.bateria"] = { state: "low", attributes: {} };
  window.card.hass = hass;
});
assert.equal(await page.locator("raykube-lock-card .battery").isVisible(), true);
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "1b-tile-low-battery.png") });
await page.evaluate(() => {
  const hass = window.makeHass();
  hass.states["sensor.bateria"] = { state: "high", attributes: {} };
  window.card.hass = hass;
});

// A tap on the tile itself never locks or unlocks: it opens the details
await tapTile();
assert.deepEqual(await calls(), []);
await page.locator("raykube-lock-panel").waitFor();
await page.locator("raykube-lock-panel").locator('[data-act="close"]').click();
assert.equal(await page.locator("raykube-lock-panel").count(), 0);

// The button unlocks only after a confirming second tap
await action.click();
assert.deepEqual(await calls(), []);
assert.equal((await action.textContent()).trim(), "Potwierdź");
assert.equal(await action.getAttribute("aria-label"), "Potwierdź otwarcie");
assert.match(await action.getAttribute("class"), /btn-destructive/);
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "1c-tile-confirm.png") });
await action.click();
assert.deepEqual(await calls(), [["lock", "unlock", { entity_id: LOCK }]]);
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Otwieranie…");
// Locking is always possible: while the unlock is on its way the button locks.
assert.equal(await action.isDisabled(), false);
assert.equal((await action.textContent()).trim(), "Zamknij");
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "2-tile-pending.png") });
await action.click();
assert.deepEqual(await calls(), [["lock", "lock", { entity_id: LOCK }]]);
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Zamykanie…");
assert.equal(await action.isDisabled(), true);
await action.click({ force: true }); // a second lock is ignored while one is on its way
assert.deepEqual(await calls(), []);
assert.equal(await page.locator("raykube-lock-panel").count(), 0); // and does not open the panel
await setLock("locking"); // HA tracks the command from here
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Zamykanie…");
// The lock did not confirm: HA shows the last reported state and the card warns.
await setLock("unlocked", { last_command: "lock", command_confirmed: false });
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Otwarty");
assert.match(await page.locator("raykube-lock-card .meta .warn").textContent(), /niepotwierdzone/);
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "2b-tile-unconfirmed.png") });
await page.locator("raykube-lock-card .more").click();
assert.match(await page.locator("raykube-lock-panel .badge").textContent(), /nie potwierdził zamknięcia/);
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: path.join(shots, "2c-panel-unconfirmed.png") });
await page.locator('raykube-lock-panel [data-act="close"]').click();
await setLock("unlocked", { command_confirmed: true });
assert.equal(await page.locator("raykube-lock-card .meta .warn").count(), 0);
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Otwarty");
assert.equal((await action.textContent()).trim(), "Zamknij");
await page.waitForTimeout(300);
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "3-tile-unlocked.png") });

// Locking needs no confirmation
await action.click();
assert.deepEqual(await calls(), [["lock", "lock", { entity_id: LOCK }]]);
await setLock("locked");

// No second unlock for 30 s after a command: the button counts down
await setLock("locked", { unlock_blocked_until: new Date(Date.now() + 25000).toISOString() });
assert.equal(await action.isDisabled(), true);
assert.match((await action.textContent()).trim(), /^Za (24|25) s$/);
await action.click({ force: true });
assert.deepEqual(await calls(), []);
if (shots) await page.locator("#host").screenshot({ path: path.join(shots, "3b-tile-unlock-wait.png") });
await page.locator("raykube-lock-card .more").click();
const waitPanel = page.locator("raykube-lock-panel");
assert.equal(await waitPanel.locator('[data-act="unlock"]').isDisabled(), true);
assert.equal(await waitPanel.locator('[data-act="lock"]').isDisabled(), false); // locking never waits
assert.match(await waitPanel.locator('[data-act="unlock"]').textContent(), /Za (24|25) s/);
await waitPanel.locator('[data-act="close"]').click();
await setLock("locked", { unlock_blocked_until: null });
assert.equal(await action.isDisabled(), false);
assert.equal((await action.textContent()).trim(), "Otwórz");

// Long press opens the panel (and the click right after does not close it)
const box = await tile.boundingBox();
await page.mouse.move(box.x + 60, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
await page.mouse.click(10, 10);
assert.deepEqual(await calls().then((c) => c.filter((x) => x[0] === "lock")), []);
const panel = page.locator("raykube-lock-panel");
await panel.waitFor();
await page.waitForTimeout(300);
assert.equal(await panel.locator(".status .state").textContent(), "Zamknięty");
assert.match(await panel.locator(".badge").textContent(), /na zamku · przed chwilą/);
const stats = await panel.locator(".stat").allTextContents();
assert.equal(stats.length, 3);
assert.match(stats.join("|"), /Bateria\s*Wysoki/);
assert.match(await panel.locator(".stat").first().getAttribute("class"), /\bgood\b/); // green
assert.match(stats.join("|"), /Zamykanie\s*30 s/);
assert.match(stats.join("|"), /Uzbrojenie\s*Wył/);
const events = await panel.locator(".event").allTextContents();
assert.equal(events.length, 4);
assert.match(events[0], /Zamknięty\s*na zamku/);
assert.match(events[2], /Zamknięty\s*automatyzacja/);
assert.match(events[3], /Otwarty\s*z Home Assistant/);
if (shots) await page.screenshot({ path: path.join(shots, "4-panel.png") });

// Panel buttons: the next action is the primary one
assert.match(await panel.locator('[data-act="unlock"]').getAttribute("class"), /btn-default/);
assert.match(await panel.locator('[data-act="lock"]').getAttribute("class"), /btn-outline/);
await panel.locator('[data-act="unlock"]').click();
assert.deepEqual(await calls(), []); // first tap only asks for confirmation
assert.equal((await panel.locator('[data-act="unlock"]').textContent()).trim(), "Potwierdź otwarcie");
await panel.locator('[data-act="unlock"]').click();
assert.deepEqual(await calls(), [["lock", "unlock", { entity_id: LOCK }]]);
assert.equal(await panel.locator(".status .state").textContent(), "Otwieranie…");
await setLock("unlocked");
assert.equal(await panel.locator(".status .state").textContent(), "Otwarty");
assert.match(await panel.locator('[data-act="lock"]').getAttribute("class"), /btn-default/);
await page.waitForTimeout(300); // button transitions
if (shots) await page.screenshot({ path: path.join(shots, "5-panel-unlocked.png") });

// Settings
await panel.locator('[data-act="auto_lock"]').click();
await panel.locator('[data-act="mute"]').click();
await panel.locator('[data-act="arming"]').click();
await panel.locator('[data-act="refresh"]').click();
assert.deepEqual(await calls(), [
  ["switch", "turn_off", { entity_id: "switch.auto" }],
  ["switch", "turn_off", { entity_id: "switch.mute" }],
  ["input_boolean", "turn_on", { entity_id: "input_boolean.zamek_uzbrojony" }],
  ["button", "press", { entity_id: "button.refresh" }],
]);
await page.waitForTimeout(50);
assert.deepEqual(await toasts(), ["Odświeżam stan zamka…", "Zamek odpowiedział, stan odświeżony"]);
await panel.locator('[data-act="auto_lock_time"]').fill("45");
await panel.locator('[data-act="auto_lock_time"]').press("Enter");
await panel.locator(".status").click();
assert.deepEqual(await calls(), [["number", "set_value", { entity_id: "number.czas", value: 45 }]]);
const calibrate = panel.locator('[data-act="calibrate"]');
await calibrate.click();
assert.deepEqual(await calls(), []);
assert.equal((await calibrate.textContent()).trim(), "Potwierdź");
assert.match(await panel.locator(".row.hint.warn").textContent(), /tylko przy drzwiach/);
if (shots) await page.screenshot({ path: path.join(shots, "6-panel-calibrate-confirm.png") });
await calibrate.click();
assert.deepEqual(await calls(), [["tuya_local_ble", "calibrate", { entity_id: LOCK }]]);
await page.waitForTimeout(50);
assert.deepEqual(await toasts(), ["Kalibracja uruchomiona. Zamek porusza ryglem."]);
assert.equal(await panel.locator(".row.hint.warn").count(), 0);
// Cooldown reported by the lock entity: the button waits.
await setLock("unlocked", { calibration_blocked_until: new Date(Date.now() + 90000).toISOString() });
assert.equal(await calibrate.isDisabled(), true);
assert.match((await calibrate.textContent()).trim(), /^Za (89|90) s$/);
await calibrate.click({ force: true });
assert.deepEqual(await calls(), []);
await setLock("unlocked", { calibration_blocked_until: null });
assert.equal(await calibrate.isDisabled(), false);

// Errors: the integration's message with the code on the last line;
// anything else gets a readable text instead of the raw error.
await page.evaluate(() => {
  window.failNext = {
    code: "home_assistant_error", translation_domain: "tuya_local_ble",
    translation_key: "lock_unreachable", message: "Nie udało się połączyć z zamkiem.",
  };
});
await panel.locator('[data-act="mute"]').click();
await page.waitForTimeout(50);
assert.deepEqual(await toasts(), ["Nie udało się połączyć z zamkiem.\n(kod błędu: lock_unreachable)"]);
await page.evaluate(() => { window.failNext = { code: "unknown_error", message: "BleakError: org.bluez.Error.Failed" }; });
await panel.locator('[data-act="mute"]').click();
await page.waitForTimeout(50);
const [raw] = await toasts();
assert.equal(raw, "Nie udało się wykonać komendy. Sprawdź zamek na miejscu.\n(kod błędu: unknown_error)");
await page.evaluate(() => { window.failNext = null; });
await calls();

// Battery colours: medium amber, low red
for (const [level, tone] of [["medium", "warn"], ["low", "bad"], ["poweroff", "bad"]]) {
  await page.evaluate((lvl) => {
    const hass = window.makeHass();
    hass.states["sensor.bateria"] = { state: lvl, attributes: {} };
    window.card.hass = hass;
  }, level);
  assert.match(await panel.locator(".stat").first().getAttribute("class"), new RegExp(`\\b${tone}\\b`));
}
if (shots) await page.screenshot({ path: path.join(shots, "5b-panel-battery-low.png") });
await page.evaluate(() => {
  const hass = window.makeHass();
  hass.states["sensor.bateria"] = { state: "high", attributes: {} };
  window.card.hass = hass;
});

// Close with the X
await panel.locator('[data-act="close"]').click();
assert.equal(await page.locator("raykube-lock-panel").count(), 0);

// confirm_unlock: false unlocks on the first tap of the button
await setLock("locked");
await page.evaluate(() => {
  window.card.setConfig({ entity: "lock.raykube_a1_ultra_d9f494_zamek", name: "Drzwi wejściowe", confirm_unlock: false });
  window.card.hass = window.makeHass();
});
await setLock("locked");
await action.click();
assert.deepEqual(await calls(), [["lock", "unlock", { entity_id: LOCK }]]);

// After an HA restart nothing is known yet: tap locks (never unlocks), the
// panel says "unknown" instead of pretending the settings are off.
await setLock("unlocked"); // settles the unlock sent above
await page.evaluate((id) => {
  const hass = window.makeHass();
  for (const e of [id, "switch.auto", "number.czas", "switch.mute"]) {
    hass.states[e] = { ...hass.states[e], state: "unknown" };
  }
  window.card.hass = hass;
}, LOCK);
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Stan nieznany");
assert.equal((await action.textContent()).trim(), "Zamknij");
await action.click();
assert.deepEqual(await calls(), [["lock", "lock", { entity_id: LOCK }]]);
await page.locator("raykube-lock-card .more").click();
const unknownPanel = page.locator("raykube-lock-panel");
await unknownPanel.locator(".stats").waitFor();
assert.match((await unknownPanel.locator(".stat").allTextContents()).join("|"), /Zamykanie\s*Nieznany/);
assert.equal(await unknownPanel.locator('[data-act="auto_lock"]').getAttribute("aria-checked"), "mixed");
assert.equal(await unknownPanel.locator('[data-act="mute"]').getAttribute("aria-checked"), "mixed");
assert.equal(await unknownPanel.locator('[data-act="auto_lock_time"]').inputValue(), "");
assert.match(await unknownPanel.locator(".row.hint").textContent(), /Naciśnij Odśwież/);
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: path.join(shots, "7-panel-unknown.png") });
await unknownPanel.locator('[data-act="close"]').click();

// English UI follows the language of Home Assistant (default config again)
await page.evaluate((id) => {
  window.card.setConfig({ entity: id });
  const hass = window.makeHass();
  hass.language = "en";
  hass.locale = { language: "en" };
  hass.states[id] = { ...hass.states[id], state: "locked" };
  window.card.hass = hass;
}, LOCK);
assert.equal(await page.locator("raykube-lock-card .meta .state").textContent(), "Locked");
assert.equal((await action.textContent()).trim(), "Unlock");
await action.click();
assert.deepEqual(await calls(), []);
assert.equal((await action.textContent()).trim(), "Confirm");
await page.locator("raykube-lock-card .more").click();
await page.locator("raykube-lock-panel .stats").waitFor();
assert.equal(await page.locator("raykube-lock-panel .settings-title").textContent(), "Settings");
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: path.join(shots, "8-panel-english.png") });
await page.locator('raykube-lock-panel [data-act="close"]').click();

// Chip for floor plans: name + state, a tap opens the details and never locks/unlocks
await page.evaluate((id) => {
  const chip = document.createElement("raykube-lock-chip");
  chip.setConfig({ entity: id, name: "Drzwi" });
  const hass = window.makeHass();
  hass.states[id] = { ...hass.states[id], state: "locked" };
  chip.hass = hass;
  document.getElementById("chip-host").appendChild(chip);
  window.chip = chip;
}, LOCK);
const chip = page.locator("raykube-lock-chip .chip");
assert.equal(await page.locator("raykube-lock-chip .name").textContent(), "Drzwi");
assert.equal(await page.locator("raykube-lock-chip .state").textContent(), "Zamknięty");
assert.match(await chip.getAttribute("class"), /tone-locked/);
await page.waitForTimeout(200);
if (shots) await page.locator("#plan").screenshot({ path: path.join(shots, "9-chip-locked.png") });
await page.evaluate((id) => {
  const hass = window.makeHass();
  hass.states[id] = { ...hass.states[id], state: "unlocked" };
  window.chip.hass = hass;
}, LOCK);
assert.equal(await page.locator("raykube-lock-chip .state").textContent(), "Otwarty");
assert.match(await chip.getAttribute("class"), /tone-unlocked/);
if (shots) await page.locator("#plan").screenshot({ path: path.join(shots, "9b-chip-unlocked.png") });
await chip.click();
assert.deepEqual(await calls(), []);
await page.locator("raykube-lock-panel .stats").waitFor();
await page.locator('raykube-lock-panel [data-act="lock"]').click();
assert.deepEqual(await calls(), [["lock", "lock", { entity_id: LOCK }]]);
assert.equal(await page.locator("raykube-lock-chip .state").textContent(), "Zamykanie…");
await page.locator('raykube-lock-panel [data-act="close"]').click();
assert.equal(await page.locator("raykube-lock-panel").count(), 0);

// Bad config is rejected
const err = await page.evaluate(() => {
  try { document.createElement("raykube-lock-card").setConfig({ entity: "switch.x" }); return null; }
  catch (e) { return e.message; }
});
assert.match(err, /lock\./);

assert.deepEqual(errors, []);
await browser.close();
console.log("card tests passed");
